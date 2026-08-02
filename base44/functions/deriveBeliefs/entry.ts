// Phase 13 — Cognitive Physics: Belief Derivation Engine.
// Phase 14 — Dynamic Systems: derivation records transitions + relationship dynamics.
//
// Laws 1–6 still in force (beliefs are derived, falsifiable, traceable). Phase 14 layers:
//   - Change is fundamental: the system stores transitions, never conclusions.
//   - State is temporary: the current derivation is one equilibrium; history is persisted.
//   - Every change is reversible: a BeliefSnapshot chain lets the ledger replay itself.
//
// Relationship Dynamics Engine v2 (deterministic cascade, no LLM):
//   After the LLM emits falsifiable beliefs, a deterministic pass infers a tiny
//   belief↔belief ontology (supports / contradicts / depends_on) from shared and
//   conflicting evidence, then iteratively propagates each belief's confidence along
//   those edges using the neighbours' LIVE (already-propagated) confidence — so a
//   shift in one belief cascades through the graph to its neighbours, then to theirs.
//   Bounded by max passes + clamping; converges for the tiny v1 ontology. Every
//   resulting adjustment and every relationship formed/broken is recorded as a
//   ChangeEvent carrying structured cause_metadata (with cascade_depth) — so the
//   ledger alone can answer "why did this belief change, and what did it move?".

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { createLogger } from "../../shared/logging.ts";
import { getSystemConfig } from "../../shared/config.ts";
import { callLLM } from "../../shared/llm.ts";
import { CognosError, wrapHandler } from "../../shared/errors.ts";

const rootLogger = createLogger("deriveBeliefs");

const PROPAGATION_FACTOR = 0.25;
const RELATIONSHIP_SIGN = { supports: 1, depends_on: 1, contradicts: -1 };
const REVISION_THRESHOLD = 0.05;

const BELIEF_SCHEMA = {
  type: "object",
  properties: {
    identity: {
      type: "string",
      description: "A concise synthesized statement of who this user is, inferred ONLY from the supplied evidence."
    },
    beliefs: {
      type: "array",
      items: {
        type: "object",
        properties: {
          claim: { type: "string", description: "The belief stated as a single falsifiable proposition." },
          category: { type: "string", description: "One of: identity, preference, goal, knowledge, behavior" },
          confidence: { type: "number", description: "0.0 to 1.0 — high only with direct/repeated evidence; low for inferred/assumed." },
          supporting_evidence: {
            type: "array",
            items: { type: "object", properties: { id: { type: "string" }, quote: { type: "string" } } },
            description: "Evidence records that support this belief, with the evidence id and a short quote."
          },
          contradicting_evidence: {
            type: "array",
            items: { type: "object", properties: { id: { type: "string" }, quote: { type: "string" } } },
            description: "Evidence records that contradict or weaken this belief (may be empty)."
          },
          rationale: { type: "string", description: "Why this belief is held, given the evidence." },
          last_challenged: { type: "string", description: "ISO timestamp of the supporting evidence's last_confirmed, or 'untested'." }
        }
      }
    }
  }
};

// --- Phase 14: transition + relationship detection ---------------------

function normalizeClaim(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

function claimKey(claim) {
  const n = normalizeClaim(claim);
  let h = 5381;
  for (let i = 0; i < n.length; i++) h = ((h << 5) + h + n.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

function relKey(r) {
  return `${r.source}|${r.type}|${r.target}`;
}

// Tiny ontology v1 — inferred deterministically from evidence overlap.
function inferRelationships(beliefs) {
  const rels = [];
  const add = (source, target, type, weight, via, sLabel, tLabel) => rels.push({
    source, target, type,
    weight: Math.max(0, Math.min(1, Number(weight.toFixed(3)))),
    via: (via || []).slice(0, 4),
    source_label: sLabel,
    target_label: tLabel
  });

  for (let i = 0; i < beliefs.length; i++) {
    for (let j = i + 1; j < beliefs.length; j++) {
      const A = beliefs[i], B = beliefs[j];
      const aSup = new Set(A.supporting || []);
      const bSup = new Set(B.supporting || []);
      const aCon = new Set(A.contradicting || []);
      const bCon = new Set(B.contradicting || []);
      const shared = [...aSup].filter(x => bSup.has(x));
      const conflict = [...aSup].filter(x => bCon.has(x)).concat([...bSup].filter(x => aCon.has(x)));
      const denom = aSup.size + bSup.size + 1;

      if (conflict.length) {
        const w = conflict.length / denom;
        add(A.key, B.key, 'contradicts', w, conflict, A.claim, B.claim);
        add(B.key, A.key, 'contradicts', w, conflict, B.claim, A.claim);
      } else if (shared.length) {
        const union = new Set([...aSup, ...bSup]).size || 1;
        const bSubA = bSup.size > 0 && bSup.size < aSup.size && [...bSup].every(x => aSup.has(x));
        const aSubB = aSup.size > 0 && aSup.size < bSup.size && [...aSup].every(x => bSup.has(x));
        if (bSubA) {
          add(A.key, B.key, 'depends_on', bSup.size / aSup.size, shared, A.claim, B.claim);
        } else if (aSubB) {
          add(B.key, A.key, 'depends_on', aSup.size / bSup.size, shared, B.claim, A.claim);
        } else {
          const w = shared.length / union;
          add(A.key, B.key, 'supports', w, shared, A.claim, B.claim);
          add(B.key, A.key, 'supports', w, shared, B.claim, A.claim);
        }
      }
    }
  }
  return rels;
}

// Iterative deterministic cascade. Each pass recomputes every belief's confidence
// from its BASE plus the sum of incoming edge contributions, where each contribution
// uses the influencer's CURRENT (already-propagated) confidence — so influence
// ripples through the graph across passes until it converges (or maxPasses). v1 used
// a single pass with base confidence and no cascade; v2 makes "one belief
// influencing another" genuinely transitive while staying bounded and deterministic.
function propagate(beliefs, rels, maxPasses = 6, epsilon = 0.005) {
  const byKey = new Map(beliefs.map(b => [b.key, b]));
  for (const b of beliefs) { b.drivers = []; b.confidence = b.base; }
  if (!rels.length) {
    for (const b of beliefs) b.confidence = Number(Math.max(0.05, Math.min(0.99, b.base)).toFixed(3));
    return { beliefs, passes: 0 };
  }
  let passes = 0;
  while (passes < maxPasses) {
    const next = new Map();
    for (const b of beliefs) next.set(b.key, b.base);
    for (const r of rels) {
      const src = byKey.get(r.source);
      const tgt = byKey.get(r.target);
      if (!src || !tgt) continue;
      const contrib = RELATIONSHIP_SIGN[r.type] * r.weight * (tgt.confidence ?? tgt.base) * PROPAGATION_FACTOR;
      next.set(src.key, (next.get(src.key) ?? src.base) + contrib);
    }
    let maxDelta = 0;
    for (const b of beliefs) {
      const nv = Number(Math.max(0.05, Math.min(0.99, next.get(b.key) ?? b.base)).toFixed(3));
      maxDelta = Math.max(maxDelta, Math.abs(nv - b.confidence));
      b.confidence = nv;
    }
    passes++;
    if (maxDelta < epsilon) break;
  }
  // Record direct (depth-1) drivers using each influencer's FINAL confidence, so
  // the ledger explains the cascaded result. (Transitive depth is implicit in the
  // iterated confidence; the driver list keeps the immediate cause legible.)
  for (const r of rels) {
    const src = byKey.get(r.source);
    const tgt = byKey.get(r.target);
    if (!src || !tgt) continue;
    const contribution = RELATIONSHIP_SIGN[r.type] * r.weight * (tgt.confidence ?? tgt.base) * PROPAGATION_FACTOR;
    src.drivers.push({
      subject_id: tgt.key,
      subject_label: tgt.claim,
      relationship: r.type,
      weight: r.weight,
      related_confidence: Number((tgt.confidence ?? tgt.base).toFixed(3)),
      contribution: Number(contribution.toFixed(4)),
      cascade_depth: 1,
      via: r.via
    });
  }
  for (const b of beliefs) b.drivers.sort((a, c) => Math.abs(c.contribution) - Math.abs(a.contribution));
  return { beliefs, passes };
}

function summarizeDrivers(drivers) {
  if (!drivers || !drivers.length) return 'none';
  return drivers.slice(0, 3).map(d => {
    const lbl = String(d.subject_label || '').slice(0, 38);
    const sign = d.contribution >= 0 ? '+' : '';
    return `${d.relationship} "${lbl}" (${sign}${d.contribution})`;
  }).join('; ');
}

function diffBeliefs(prev, curr) {
  const out = [];
  const prevMap = new Map((prev || []).map(b => [b.key, b]));
  const currMap = new Map((curr || []).map(b => [b.key, b]));
  for (const [key, b] of currMap) {
    const propDelta = Number(((b.confidence ?? 0) - (b.base ?? 0)).toFixed(3));
    if (!prevMap.has(key)) {
      out.push({
        event_type: 'belief_emerged', subject_type: 'belief', subject_id: key, subject_label: b.claim,
        from_state: null,
        to_state: { confidence: b.confidence, base: b.base },
        delta: b.confidence ?? 0,
        cause: `emerged from current evidence; propagation ${propDelta >= 0 ? '+' : ''}${propDelta} (${summarizeDrivers(b.drivers)})`,
        cause_metadata: { base: b.base, confidence: b.confidence, propagation_delta: propDelta, drivers: b.drivers || [] }
      });
    } else {
      const p = prevMap.get(key);
      const d = Number(((b.confidence ?? 0) - (p.confidence ?? 0)).toFixed(3));
      if (Math.abs(d) >= REVISION_THRESHOLD) {
        const baseDelta = Number(((b.base ?? 0) - (p.base ?? 0)).toFixed(3));
        const cause = `base ${(p.base ?? 0).toFixed(2)}→${(b.base ?? 0).toFixed(2)} (${baseDelta >= 0 ? '+' : ''}${baseDelta}); propagation ${propDelta >= 0 ? '+' : ''}${propDelta} (${summarizeDrivers(b.drivers)})`;
        out.push({
          event_type: 'belief_revised', subject_type: 'belief', subject_id: key, subject_label: b.claim,
          from_state: { confidence: p.confidence, base: p.base },
          to_state: { confidence: b.confidence, base: b.base },
          delta: d, cause,
          cause_metadata: {
            base_prev: p.base, base_now: b.base, base_delta: baseDelta,
            propagation_delta: propDelta, drivers: b.drivers || []
          }
        });
      }
    }
  }
  for (const [key, p] of prevMap) {
    if (!currMap.has(key)) {
      out.push({
        event_type: 'belief_collapsed', subject_type: 'belief', subject_id: key, subject_label: p.claim,
        from_state: { confidence: p.confidence, base: p.base }, to_state: null,
        delta: -(p.confidence ?? 0), cause: 'no longer supported by current evidence',
        cause_metadata: null
      });
    }
  }
  return out;
}

function diffRelationships(prev, curr) {
  const out = [];
  const prevMap = new Map((prev || []).map(r => [relKey(r), r]));
  const currMap = new Map((curr || []).map(r => [relKey(r), r]));
  for (const [k, r] of currMap) {
    if (!prevMap.has(k)) {
      out.push({
        event_type: 'relationship_formed', subject_type: 'relationship', subject_id: k,
        subject_label: `"${String(r.source_label || '').slice(0, 36)}" ${r.type} "${String(r.target_label || '').slice(0, 36)}"`,
        from_state: null, to_state: { weight: r.weight, type: r.type },
        delta: r.weight, cause: 'deterministic inference from shared/conflicting evidence',
        cause_metadata: { source: r.source, target: r.target, type: r.type, weight: r.weight, via: r.via }
      });
    }
  }
  for (const [k, r] of prevMap) {
    if (!currMap.has(k)) {
      out.push({
        event_type: 'relationship_broken', subject_type: 'relationship', subject_id: k,
        subject_label: `"${String(r.source_label || '').slice(0, 36)}" ${r.type} "${String(r.target_label || '').slice(0, 36)}"`,
        from_state: { weight: r.weight, type: r.type }, to_state: null,
        delta: -r.weight, cause: 'evidence overlap changed',
        cause_metadata: { source: r.source, target: r.target, type: r.type, weight: r.weight, via: r.via }
      });
    }
  }
  return out;
}

function diffEvidence(prev, curr) {
  const out = [];
  const prevMap = new Map((prev || []).map(e => [e.id, e]));
  const currMap = new Map((curr || []).map(e => [e.id, e]));
  for (const [id, e] of currMap) {
    if (!prevMap.has(id)) {
      out.push({ event_type: 'evidence_added', subject_type: 'memory', subject_id: id, subject_label: e.content_preview || id, from_state: null, to_state: { importance: e.importance, evidence_level: e.evidence_level }, delta: 1, cause: 'new evidence in workspace', cause_metadata: null });
    } else {
      const p = prevMap.get(id);
      if ((p.importance ?? 0) !== (e.importance ?? 0) || (p.evidence_level || '') !== (e.evidence_level || '')) {
        out.push({ event_type: 'evidence_reweighted', subject_type: 'memory', subject_id: id, subject_label: e.content_preview || id, from_state: { importance: p.importance, evidence_level: p.evidence_level }, to_state: { importance: e.importance, evidence_level: e.evidence_level }, delta: (e.importance ?? 0) - (p.importance ?? 0), cause: 'evidence attributes changed', cause_metadata: null });
      }
    }
  }
  for (const [id, p] of prevMap) {
    if (!currMap.has(id)) {
      out.push({ event_type: 'evidence_removed', subject_type: 'memory', subject_id: id, subject_label: p.content_preview || id, from_state: { importance: p.importance, evidence_level: p.evidence_level }, to_state: null, delta: -1, cause: 'evidence disabled or deleted', cause_metadata: null });
    }
  }
  return out;
}

function diffIdentity(prevIdentity, currIdentity, hadPrev) {
  if (!currIdentity) return null;
  if (!hadPrev) return { event_type: 'identity_established', subject_type: 'identity', subject_id: 'identity', subject_label: 'Identity', from_state: null, to_state: { identity: currIdentity }, delta: 1, cause: 'initial derivation', cause_metadata: null };
  if (prevIdentity && prevIdentity !== currIdentity) return { event_type: 'identity_revised', subject_type: 'identity', subject_id: 'identity', subject_label: 'Identity', from_state: { identity: prevIdentity }, to_state: { identity: currIdentity }, delta: 0, cause: 'identity shifted with new evidence', cause_metadata: null };
  return null;
}

async function handle(req) {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) throw new CognosError("Unauthorized", { code: "AUTH", category: "auth", status: 401 });

  const body = await req.json();
  const { workspaceId } = body;
  if (!workspaceId) throw new CognosError("Missing workspaceId", { code: "VALIDATION", category: "input", status: 400 });

  const config = getSystemConfig();
  const logger = rootLogger.child("engine");
  const ctx = { base44, config, logger, timings: {} };

  const evidence = await base44.entities.Memory.filter(
    { workspace_id: workspaceId, is_enabled: true },
    '-importance',
    100
  );

  if (!evidence || evidence.length === 0) {
    return Response.json({
      identity: null, beliefs: [], evidenceCount: 0, derivedAt: new Date().toISOString(),
      transitions: { evidence: 0, beliefs: 0, relationships: 0, identity: 0, total: 0 },
      note: "No evidence available yet — beliefs cannot be derived until COGNOS has gathered memories from your conversations."
    });
  }

  const inventory = evidence.map(m => ({
    id: m.id, content: m.content,
    evidence_level: m.evidence_level || 'inferred', volatility: m.volatility || 'medium',
    last_confirmed: m.last_confirmed || null, importance: m.importance || 5
  }));

  let lastSnap = null;
  try {
    const prev = await base44.entities.BeliefSnapshot.filter({ workspace_id: workspaceId }, '-derived_at', 1);
    lastSnap = prev && prev[0] ? prev[0] : null;
  } catch (e) {
    logger.warn("snapshot load failed", { error: String(e) });
  }

  const result = await callLLM(ctx, {
    model: ctx.config.models.memory,
    responseJsonSchema: BELIEF_SCHEMA,
    messages: [
      {
        role: "system",
        content: `You are the Belief Derivation engine of COGNOS, operating under the Seven Laws of Cognition. You receive a set of EVIDENCE records (each with an id, content, evidence_level, volatility, last_confirmed, importance). Your job is to DERIVE falsifiable beliefs from this evidence — never to accept anything as permanent truth.

For each belief:
- State the claim as a single falsifiable proposition.
- Set confidence (0.0–1.0): high ONLY when backed by direct or repeated evidence; modest for inferred evidence; low for assumed. Recent evidence weighs more; repeated evidence strengthens confidence; contradictions weaken it.
- List supporting_evidence and contradicting_evidence with the evidence id and a short quote. Be honest about contradictions — if evidence is missing, do not fabricate it.
- Give a rationale grounded in the evidence.
- Set last_challenged to the latest last_confirmed among the supporting evidence, or "untested".
- Assign a category: identity, preference, goal, knowledge, or behavior.

Also produce "identity": a concise synthesized statement of who this user is, inferred ONLY from the supplied evidence. If the evidence is thin, say so honestly rather than inventing traits.

Prefer a few well-supported beliefs over many speculative ones. If the evidence is insufficient to support any belief, return an empty beliefs array and a cautious identity. Nothing is sacred; everything is revisable.`
      },
      { role: "user", content: `EVIDENCE INVENTORY (JSON):\n${JSON.stringify(inventory)}` }
    ]
  });

  const rawBeliefs = Array.isArray(result?.beliefs) ? result.beliefs.filter(b => b && b.claim) : [];
  const identity = result?.identity || null;

  // Enrich with the keys + evidence-id sets the deterministic engine needs.
  const beliefs = rawBeliefs.map(b => ({
    ...b,
    key: claimKey(b.claim),
    base: typeof b.confidence === 'number' ? b.confidence : 0.5,
    supporting: (b.supporting_evidence || []).map(x => x.id).filter(Boolean),
    contradicting: (b.contradicting_evidence || []).map(x => x.id).filter(Boolean)
  }));

  // --- Relationship Dynamics Engine v2 (deterministic cascade) ---
  const relationships = inferRelationships(beliefs);
  const propagation = propagate(beliefs, relationships);

  // --- Transition detection across the ledger ---
  const currentManifest = evidence.map(m => ({
    id: m.id, importance: m.importance || 5,
    evidence_level: m.evidence_level || 'inferred',
    content_preview: String(m.content || '').slice(0, 80)
  }));
  const evTransitions = diffEvidence(lastSnap?.evidence_manifest || [], currentManifest);
  const relTransitions = diffRelationships(lastSnap?.relationships || [], relationships);
  const beliefTransitions = diffBeliefs(lastSnap?.beliefs || [], beliefs);
  const idTransition = diffIdentity(lastSnap?.identity || null, identity, !!lastSnap);
  const transitions = [...evTransitions, ...relTransitions, ...beliefTransitions];
  if (idTransition) transitions.push(idTransition);

  let memberIds = [user.id];
  try {
    const ws = await base44.entities.Workspace.get(workspaceId);
    if (ws && ws.member_ids && ws.member_ids.length) memberIds = ws.member_ids;
  } catch (e) {
    logger.warn("workspace lookup failed", { error: String(e) });
  }

  let snapId = null;
  try {
    const snap = await base44.entities.BeliefSnapshot.create({
      workspace_id: workspaceId, member_ids: memberIds,
      prior_snapshot_id: lastSnap?.id || null,
      identity, beliefs, relationships,
      evidence_manifest: currentManifest, evidence_count: evidence.length,
      derived_at: new Date().toISOString()
    });
    snapId = snap.id;
  } catch (e) {
    logger.warn("snapshot persist failed", { error: String(e) });
  }

  if (snapId && transitions.length) {
    try {
      await base44.entities.ChangeEvent.bulkCreate(
        transitions.map(t => ({ workspace_id: workspaceId, member_ids: memberIds, run_id: snapId, ...t }))
      );
    } catch (e) {
      logger.warn("change-event persist failed", { error: String(e) });
    }
  }

  try {
    await base44.entities.AuditEvent.create({
      user_id: user.id, workspace_id: workspaceId,
      event_type: 'memory_operation', agent_type: 'beliefDerivation',
      model_used: ctx.config.models.memory, task_type: 'analysis', status: 'success',
      description: `Derived ${beliefs.length} beliefs (${relationships.length} relationships) from ${evidence.length} evidence records. Recorded ${transitions.length} transitions.`
    });
  } catch (e) {
    logger.warn("belief derivation audit failed", { error: String(e) });
  }

  return Response.json({
    identity, beliefs, evidenceCount: evidence.length, derivedAt: new Date().toISOString(), runId: snapId,
    propagation_passes: propagation.passes,
    relationships: { count: relationships.length, supports: relationships.filter(r => r.type === 'supports').length, contradicts: relationships.filter(r => r.type === 'contradicts').length, depends_on: relationships.filter(r => r.type === 'depends_on').length },
    transitions: {
      evidence: evTransitions.length, relationships: relTransitions.length,
      beliefs: beliefTransitions.length, identity: idTransition ? 1 : 0,
      total: transitions.length
    }
  });
}

export default wrapHandler(handle, rootLogger);