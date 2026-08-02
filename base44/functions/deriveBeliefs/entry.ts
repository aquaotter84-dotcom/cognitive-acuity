// Phase 13 — Cognitive Physics: Belief Derivation Engine.
// Phase 14 — Dynamic Systems: derivation now records transitions, not conclusions.
//
// Law 1 (Everything is evidence): Memory rows are treated as evidence, not truth.
// Law 2 (State is derived): Beliefs are computed on demand — never stored as fact.
// Law 3 (Every belief is falsifiable): each belief carries supporting/contradicting
//   evidence, confidence, rationale, and last-challenged timestamp.
// Law 6 (Every decision is traceable): beliefs reference the evidence ids they came from.
//
// Phase 14 first principles layered on top:
//   - Change is fundamental: the system stores transitions, never conclusions.
//   - State is temporary: the current derivation is one equilibrium; history is persisted.
//   - Every change is reversible: a BeliefSnapshot chain lets the ledger replay itself.
//
// This function reads a workspace's evidence (Memory records), synthesizes falsifiable
// beliefs, then diffs the result against the last BeliefSnapshot and records every
// detected transition (evidence added/removed/reweighted, belief emerged/revised/
// collapsed, identity revised) to the ChangeEvent ledger. The returned beliefs are
// still conclusions-for-now; the ledger is the permanent, replayable record.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { createLogger } from "../../shared/logging.ts";
import { getSystemConfig } from "../../shared/config.ts";
import { callLLM } from "../../shared/llm.ts";
import { CognosError, wrapHandler } from "../../shared/errors.ts";

const rootLogger = createLogger("deriveBeliefs");

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
            items: {
              type: "object",
              properties: { id: { type: "string" }, quote: { type: "string" } }
            },
            description: "Evidence records that support this belief, with the evidence id and a short quote."
          },
          contradicting_evidence: {
            type: "array",
            items: {
              type: "object",
              properties: { id: { type: "string" }, quote: { type: "string" } }
            },
            description: "Evidence records that contradict or weaken this belief (may be empty)."
          },
          rationale: { type: "string", description: "Why this belief is held, given the evidence." },
          last_challenged: { type: "string", description: "ISO timestamp of the supporting evidence's last_confirmed, or 'untested'." }
        }
      }
    }
  }
};

// --- Phase 14: transition detection -------------------------------------

function normalizeClaim(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

function claimKey(claim) {
  const n = normalizeClaim(claim);
  let h = 5381;
  for (let i = 0; i < n.length; i++) h = ((h << 5) + h + n.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

function diffBeliefs(prev, curr) {
  const out = [];
  const prevMap = new Map((prev || []).map(b => [claimKey(b.claim), b]));
  const currMap = new Map((curr || []).map(b => [claimKey(b.claim), b]));
  for (const [key, b] of currMap) {
    if (!prevMap.has(key)) {
      out.push({ event_type: 'belief_emerged', subject_type: 'belief', subject_id: key, subject_label: b.claim, from_state: null, to_state: { confidence: b.confidence, category: b.category }, delta: b.confidence ?? 0, cause: 're-derivation' });
    } else {
      const p = prevMap.get(key);
      const d = (b.confidence ?? 0) - (p.confidence ?? 0);
      if (Math.abs(d) >= 0.1) {
        out.push({ event_type: 'belief_revised', subject_type: 'belief', subject_id: key, subject_label: b.claim, from_state: { confidence: p.confidence }, to_state: { confidence: b.confidence, category: b.category }, delta: d, cause: 're-derivation' });
      }
    }
  }
  for (const [key, p] of prevMap) {
    if (!currMap.has(key)) {
      out.push({ event_type: 'belief_collapsed', subject_type: 'belief', subject_id: key, subject_label: p.claim, from_state: { confidence: p.confidence }, to_state: null, delta: -(p.confidence ?? 0), cause: 'no longer supported by current evidence' });
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
      out.push({ event_type: 'evidence_added', subject_type: 'memory', subject_id: id, subject_label: e.content_preview || id, from_state: null, to_state: { importance: e.importance, evidence_level: e.evidence_level }, delta: 1, cause: 'new evidence in workspace' });
    } else {
      const p = prevMap.get(id);
      if ((p.importance ?? 0) !== (e.importance ?? 0) || (p.evidence_level || '') !== (e.evidence_level || '')) {
        out.push({ event_type: 'evidence_reweighted', subject_type: 'memory', subject_id: id, subject_label: e.content_preview || id, from_state: { importance: p.importance, evidence_level: p.evidence_level }, to_state: { importance: e.importance, evidence_level: e.evidence_level }, delta: (e.importance ?? 0) - (p.importance ?? 0), cause: 'evidence attributes changed' });
      }
    }
  }
  for (const [id, p] of prevMap) {
    if (!currMap.has(id)) {
      out.push({ event_type: 'evidence_removed', subject_type: 'memory', subject_id: id, subject_label: p.content_preview || id, from_state: { importance: p.importance, evidence_level: p.evidence_level }, to_state: null, delta: -1, cause: 'evidence disabled or deleted' });
    }
  }
  return out;
}

function diffIdentity(prevIdentity, currIdentity, hadPrev) {
  if (!currIdentity) return null;
  if (!hadPrev) return { event_type: 'identity_established', subject_type: 'identity', subject_id: 'identity', subject_label: 'Identity', from_state: null, to_state: { identity: currIdentity }, delta: 1, cause: 'initial derivation' };
  if (prevIdentity && prevIdentity !== currIdentity) return { event_type: 'identity_revised', subject_type: 'identity', subject_id: 'identity', subject_label: 'Identity', from_state: { identity: prevIdentity }, to_state: { identity: currIdentity }, delta: 0, cause: 'identity shifted with new evidence' };
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

  // --- Gather evidence (Memory as the evidence archive) ---
  const evidence = await base44.entities.Memory.filter(
    { workspace_id: workspaceId, is_enabled: true },
    '-importance',
    100
  );

  if (!evidence || evidence.length === 0) {
    return Response.json({
      identity: null,
      beliefs: [],
      evidenceCount: 0,
      derivedAt: new Date().toISOString(),
      transitions: { evidence: 0, beliefs: 0, identity: 0, total: 0 },
      note: "No evidence available yet — beliefs cannot be derived until COGNOS has gathered memories from your conversations."
    });
  }

  const inventory = evidence.map(m => ({
    id: m.id,
    content: m.content,
    evidence_level: m.evidence_level || 'inferred',
    volatility: m.volatility || 'medium',
    last_confirmed: m.last_confirmed || null,
    importance: m.importance || 5
  }));

  // --- Phase 14: load the last derivation snapshot to diff against ---
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

  const beliefs = Array.isArray(result?.beliefs) ? result.beliefs.filter(b => b && b.claim) : [];
  const identity = result?.identity || null;

  // --- Phase 14: detect transitions (change as the primary object) ---
  const currentManifest = evidence.map(m => ({
    id: m.id,
    importance: m.importance || 5,
    evidence_level: m.evidence_level || 'inferred',
    content_preview: String(m.content || '').slice(0, 80)
  }));
  const evTransitions = diffEvidence(lastSnap?.evidence_manifest || [], currentManifest);
  const beliefTransitions = diffBeliefs(lastSnap?.beliefs || [], beliefs);
  const idTransition = diffIdentity(lastSnap?.identity || null, identity, !!lastSnap);
  const transitions = [...evTransitions, ...beliefTransitions];
  if (idTransition) transitions.push(idTransition);

  // Workspace members for RLS scoping of snapshot + events.
  let memberIds = [user.id];
  try {
    const ws = await base44.entities.Workspace.get(workspaceId);
    if (ws && ws.member_ids && ws.member_ids.length) memberIds = ws.member_ids;
  } catch (e) {
    logger.warn("workspace lookup failed", { error: String(e) });
  }

  // --- Phase 14 Principle 6: persist the derivation snapshot (replayable history) ---
  let snapId = null;
  try {
    const snap = await base44.entities.BeliefSnapshot.create({
      workspace_id: workspaceId,
      member_ids: memberIds,
      prior_snapshot_id: lastSnap?.id || null,
      identity,
      beliefs,
      evidence_manifest: currentManifest,
      evidence_count: evidence.length,
      derived_at: new Date().toISOString()
    });
    snapId = snap.id;
  } catch (e) {
    logger.warn("snapshot persist failed", { error: String(e) });
  }

  // --- Phase 14 Principle 1: record every transition to the permanent ledger ---
  if (snapId && transitions.length) {
    try {
      await base44.entities.ChangeEvent.bulkCreate(
        transitions.map(t => ({ workspace_id: workspaceId, member_ids: memberIds, run_id: snapId, ...t }))
      );
    } catch (e) {
      logger.warn("change-event persist failed", { error: String(e) });
    }
  }

  // Best-effort audit trail: record that a derivation occurred.
  try {
    await base44.entities.AuditEvent.create({
      user_id: user.id,
      workspace_id: workspaceId,
      event_type: 'memory_operation',
      agent_type: 'beliefDerivation',
      model_used: ctx.config.models.memory,
      task_type: 'analysis',
      status: 'success',
      description: `Derived ${beliefs.length} falsifiable beliefs from ${evidence.length} evidence records. Recorded ${transitions.length} state transitions.`
    });
  } catch (e) {
    logger.warn("belief derivation audit failed", { error: String(e) });
  }

  return Response.json({
    identity,
    beliefs,
    evidenceCount: evidence.length,
    derivedAt: new Date().toISOString(),
    runId: snapId,
    transitions: {
      evidence: evTransitions.length,
      beliefs: beliefTransitions.length,
      identity: idTransition ? 1 : 0,
      total: transitions.length
    }
  });
}

export default wrapHandler(handle, rootLogger);