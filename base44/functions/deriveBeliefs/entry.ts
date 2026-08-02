// Phase 13 — Cognitive Physics: Belief Derivation Engine.
//
// Law 1 (Everything is evidence): Memory rows are treated as evidence, not truth.
// Law 2 (State is derived): Beliefs are computed on demand — never stored as fact.
// Law 3 (Every belief is falsifiable): each belief carries supporting/contradicting
//   evidence, confidence, rationale, and last-challenged timestamp.
// Law 6 (Every decision is traceable): beliefs reference the evidence ids they came from.
//
// This function reads a workspace's evidence (Memory records, with their evidence_level,
// volatility, last_confirmed, importance) and synthesizes falsifiable, traceable beliefs
// plus a reconstructed identity ("Who is this user?"). The result is returned, not
// persisted — beliefs are conclusions, not database rows.

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
  // User-scoped (not service-role) so derivation reads the same evidence the user
  // sees in chat — same data context, respecting Memory RLS.
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
      description: `Derived ${beliefs.length} falsifiable beliefs from ${evidence.length} evidence records.`
    });
  } catch (e) {
    logger.warn("belief derivation audit failed", { error: String(e) });
  }

  return Response.json({
    identity,
    beliefs,
    evidenceCount: evidence.length,
    derivedAt: new Date().toISOString()
  });
}

export default wrapHandler(handle, rootLogger);