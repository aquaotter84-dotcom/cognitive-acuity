// Memory consolidation — Phase 5. Merges near-duplicate / overlapping memories within
// a workspace into a single semantic memory and deletes the redundant originals.
// Invoked either with a specific workspaceId (user-scope) or with no args to
// consolidate every workspace (the scheduled workflow path). Uses the service role
// so it can read/write memories across the workspace regardless of RLS.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { createLogger } from "../../shared/logging.ts";
import { callLLM } from "../../shared/llm.ts";
import { wrapHandler } from "../../shared/errors.ts";

const logger = createLogger("consolidateMemories");

// Evidence and volatility ranking — when merging overlapping memories, the merged
// record inherits the strongest evidence and highest volatility of its sources, and
// the latest last_confirmed timestamp. Keeps consolidated memory auditable.
const EVIDENCE_RANK = { direct: 3, repeated: 2, inferred: 1, assumed: 0 };
const VOLATILITY_RANK = { high: 2, medium: 1, low: 0 };

function pickStrongest(items, field, rank, fallback) {
  let best = fallback;
  let bestRank = -1;
  for (const m of items) {
    const v = m[field];
    const r = v != null ? (rank[v] ?? -1) : -1;
    if (v && r > bestRank) { best = v; bestRank = r; }
  }
  return best;
}

function pickLatestDate(items, field) {
  const dates = items.map(m => m[field]).filter(Boolean).sort();
  return dates.length ? dates[dates.length - 1] : null;
}

const CONSOLIDATION_SCHEMA = {
  type: "object",
  properties: {
    groups: {
      type: "array",
      items: {
        type: "object",
        properties: {
          ids: { type: "array", items: { type: "string" } },
          merged_content: { type: "string" },
          importance: { type: "integer" },
          memory_type: { type: "string" }
        }
      }
    }
  }
};

async function consolidateWorkspace(base44, workspaceId) {
  const memories = await base44.asServiceRole.entities.Memory.filter(
    { workspace_id: workspaceId, is_enabled: true },
    '-importance',
    100
  );
  if (!memories || memories.length < 3) {
    return { workspaceId, skipped: true, reason: "too_few_memories", count: (memories || []).length };
  }
  const inventory = memories.map(m => ({
    id: m.id, content: m.content, importance: m.importance, memory_type: m.memory_type
  }));

  let plan;
  try {
    plan = await callLLM({ base44, logger }, {
      model: "gpt_5_mini",
      responseJsonSchema: CONSOLIDATION_SCHEMA,
      messages: [
        {
          role: "system",
          content: "You are a memory consolidation agent. Group memories that are near-duplicates or overlap (the same fact or preference). Only group memories that genuinely overlap. For each group of 2 or more overlapping memories, provide the ids, a merged_content that combines their information without losing detail, an importance (the max of the group's importances), and memory_type ('semantic' for stable facts, 'episodic' for events). Do not include non-overlapping memories in any group — they stay as-is."
        },
        { role: "user", content: `Memories (JSON):\n${JSON.stringify(inventory)}` }
      ]
    });
  } catch (e) {
    return { workspaceId, skipped: true, reason: "llm_failed", error: String(e) };
  }

  const validIds = new Set(inventory.map(m => m.id));
  const groups = (plan && Array.isArray(plan.groups))
    ? plan.groups.filter(g => Array.isArray(g.ids) && g.ids.length >= 2 && g.merged_content)
    : [];

  if (groups.length === 0) {
    return { workspaceId, merged: 0, disabled: 0, created: 0 };
  }

  let merged = 0, disabled = 0, created = 0;
  for (const g of groups) {
    const ids = g.ids.filter(id => validIds.has(id));
    if (ids.length < 2) continue;
    const sources = memories.filter(m => ids.includes(m.id));
    const evidence_level = pickStrongest(sources, "evidence_level", EVIDENCE_RANK, "inferred");
    const volatility = pickStrongest(sources, "volatility", VOLATILITY_RANK, "medium");
    const last_confirmed = pickLatestDate(sources, "last_confirmed");
    await base44.asServiceRole.entities.Memory.create({
      workspace_id: workspaceId,
      content: String(g.merged_content).trim(),
      memory_type: g.memory_type === "episodic" ? "episodic" : "semantic",
      source: "consolidation",
      importance: g.importance || 5,
      evidence_level,
      volatility,
      last_confirmed,
      is_enabled: true
    });
    created++;
    for (const id of ids) {
      try {
        await base44.asServiceRole.entities.Memory.delete(id);
        disabled++;
      } catch (e) {
        logger.warn("delete failed", { id, error: String(e) });
      }
    }
    merged++;
  }
  return { workspaceId, merged, disabled, created };
}

async function handle(req) {
  const base44 = createClientFromRequest(req);
  const body = await req.json().catch(() => ({}));
  const { workspaceId } = body || {};

  // Direct invocation by a non-admin requesting all workspaces is not allowed;
  // the scheduled workflow path has no user session and consolidates everything.
  let user = null;
  try { user = await base44.auth.me(); } catch {}
  if (user && user.role !== 'admin' && !workspaceId) {
    return Response.json({ error: "Admin role required to consolidate all workspaces" }, { status: 403 });
  }

  if (workspaceId) {
    return Response.json({ processed: [await consolidateWorkspace(base44, workspaceId)] });
  }
  const workspaces = await base44.asServiceRole.entities.Workspace.list();
  const results = [];
  for (const ws of workspaces) {
    results.push(await consolidateWorkspace(base44, ws.id));
  }
  return Response.json({ processed: results });
}

export default wrapHandler(handle, logger);