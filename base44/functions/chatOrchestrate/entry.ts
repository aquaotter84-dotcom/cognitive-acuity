import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

import { createLogger } from "../../shared/logging.ts";
import { getSystemConfig } from "../../shared/config.ts";
import { CognosError, wrapHandler } from "../../shared/errors.ts";
import { callLLM } from "../../shared/llm.ts";
import { runCouncil } from "../../shared/council/pipeline.ts";

const rootLogger = createLogger("chatOrchestrate");

const MEMORY_SCHEMA = {
  type: "object",
  properties: {
    memories: {
      type: "array",
      items: {
        type: "object",
        properties: {
          content: { type: "string" },
          memory_type: { type: "string" },
          importance: { type: "integer" },
          evidence_level: { type: "string" },
          volatility: { type: "string" }
        }
      }
    }
  }
};

const MEMORY_RELEVANCE_SCHEMA = {
  type: "object",
  properties: {
    relevant_ids: { type: "array", items: { type: "string" } }
  }
};

const SUMMARIZE_SCHEMA = {
  type: "object",
  properties: { summary: { type: "string" } }
};

// Phase 7 — relevance-based memory retrieval. When the workspace has more enabled
// memories than the context budget, a lightweight model ranks the pool by relevance
// to the current message and the top-N are used. Falls back to importance order.
// (When pool ≤ budget, no ranking call is made — the pool is used directly.)
async function selectRelevantMemories(ctx, userMessage, pool, maxMemories) {
  if (!pool || pool.length === 0) return [];
  if (pool.length <= maxMemories) return pool;
  try {
    const inventory = pool.map(m => ({ id: m.id, content: m.content }));
    const result = await callLLM(ctx, {
      model: ctx.config.models.memory,
      responseJsonSchema: MEMORY_RELEVANCE_SCHEMA,
      messages: [
        { role: "system", content: `You are a memory relevance agent. Given a user's message and a list of memories (with ids), return the ids of the memories most relevant to the message, in order of relevance, up to ${maxMemories}. Only include ids that genuinely relate to the message; if few are relevant, return fewer.` },
        { role: "user", content: `Message: ${userMessage}\n\nMemories (JSON):\n${JSON.stringify(inventory)}` }
      ]
    });
    if (result && Array.isArray(result.relevant_ids)) {
      const idSet = new Set(inventory.map(m => m.id));
      const seen = new Set();
      const selected = [];
      for (const id of result.relevant_ids) {
        if (!idSet.has(id) || seen.has(id)) continue;
        const m = pool.find(x => x.id === id);
        if (m) { selected.push(m); seen.add(m.id); }
        if (selected.length >= maxMemories) break;
      }
      // top up with highest-importance unused if the model returned fewer than the budget
      for (const m of pool) {
        if (seen.has(m.id)) continue;
        selected.push(m); seen.add(m.id);
        if (selected.length >= maxMemories) break;
      }
      return selected;
    }
  } catch (e) {
    ctx.logger.warn("memory relevance selection failed, using importance fallback", { error: String(e) });
  }
  return pool.slice(0, maxMemories);
}

// Phase 9 — conversation summarization. After each exchange, a lightweight model
// writes a 1-2 sentence running summary onto the Conversation. Best-effort.
async function summarizeConversation(ctx, conversationId, history, userMessage, responseText) {
  try {
    const transcript = [
      ...history.map(m => `${m.role}: ${m.content}`),
      `user: ${userMessage}`,
      `assistant: ${responseText}`
    ].join('\n');
    const result = await callLLM(ctx, {
      model: ctx.config.models.memory,
      responseJsonSchema: SUMMARIZE_SCHEMA,
      messages: [
        { role: "system", content: "Summarize the following conversation in 1-2 concise sentences. Capture what the user wanted and the outcome. Return only the summary text." },
        { role: "user", content: transcript }
      ]
    });
    const summary = result?.summary?.trim();
    if (summary) {
      await ctx.base44.entities.Conversation.update(conversationId, { summary });
      return summary;
    }
  } catch (e) {
    ctx.logger.warn("conversation summarization failed", { error: String(e) });
  }
  return null;
}

// Memory extraction (best-effort) — extracts durable facts/preferences from the
// exchange into Memory records. Failure never affects the response.
async function extractMemories(ctx, { workspaceId, conversationId, userMessage, responseText, memberIds, userId }) {
  try {
    const memResult = await callLLM(ctx, {
      model: ctx.config.models.memory,
      responseJsonSchema: MEMORY_SCHEMA,
      messages: [
        {
          role: "system",
          content: 'You are a memory extraction agent. Analyze the conversation and extract any important facts, preferences, or information worth remembering for future conversations. Only extract genuinely useful, long-term information — not casual conversation. For each memory, also classify: evidence_level — "direct" (the user explicitly stated it), "repeated" (stated across multiple exchanges), "inferred" (deduced from context), or "assumed" (guessed without a clear basis, use sparingly); and volatility — "low" (name, identity, stable facts), "medium" (job, role, preferences), or "high" (current project phase, living situation, in-progress state that changes often). Be honest about evidence: prefer "direct" only when the user clearly stated it, and "assumed" only when you are guessing. Return a memories array; each memory has content (string), memory_type ("episodic" or "semantic"), importance (1-10 integer), evidence_level (string), and volatility (string). Return an empty array if nothing is worth remembering.'
        },
        { role: "user", content: `User: ${userMessage}\nAssistant: ${responseText}` }
      ]
    });
    if (memResult?.memories && Array.isArray(memResult.memories) && memResult.memories.length > 0) {
      const records = memResult.memories
        .filter(m => m.content && String(m.content).trim().length > 5)
        .map(m => ({
          workspace_id: workspaceId,
          content: String(m.content).trim(),
          memory_type: m.memory_type || 'episodic',
          source: conversationId,
          importance: m.importance || 5,
          evidence_level: ['direct', 'repeated', 'inferred', 'assumed'].includes(m.evidence_level) ? m.evidence_level : 'inferred',
          volatility: ['low', 'medium', 'high'].includes(m.volatility) ? m.volatility : 'medium',
          last_confirmed: new Date().toISOString(),
          is_enabled: true,
          member_ids: memberIds && memberIds.length ? memberIds : [userId]
        }));
      if (records.length > 0) {
        await ctx.base44.entities.Memory.bulkCreate(records);
      }
    }
  } catch (e) {
    ctx.logger.warn("memory extraction failed", { error: String(e) });
  }
}

async function handle(req) {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) throw new CognosError("Unauthorized", { code: "AUTH", category: "auth", status: 401 });

  const body = await req.json();
  const { conversationId, workspaceId, userMessage, style, attachments, webSearch } = body;
  if (!conversationId || !workspaceId || !userMessage) {
    throw new CognosError("Missing required fields", { code: "VALIDATION", category: "input", status: 400 });
  }

  const config = getSystemConfig();
  const logger = rootLogger.child("orchestrator");
  const ctx = { base44, config, logger, timings: {} };
  const startTime = Date.now();

  // --- Context assembly (entrypoint-specific) ---
  const messages = await base44.entities.Message.filter(
    { conversation_id: conversationId }, '-created_date', config.orchestrator.maxHistoryMessages
  );
  const history = [...messages].reverse();
  const poolSize = config.orchestrator.memoryPoolSize || config.orchestrator.maxMemories;
  const pool = await base44.entities.Memory.filter(
    { workspace_id: workspaceId, is_enabled: true }, '-importance', poolSize
  );
  const memories = await selectRelevantMemories(ctx, userMessage, pool, config.orchestrator.maxMemories);
  const workspace = await base44.entities.Workspace.get(workspaceId);
  const memberIds = workspace?.member_ids?.length ? workspace.member_ids : [user.id];

  // --- Council pipeline ---
  let result, pipelineError = null;
  try {
    result = await runCouncil(ctx, {
      userMessage, conversationId, workspaceId, history, memories, workspace,
      style, attachments: attachments || [], webSearch: !!webSearch
    });
  } catch (e) {
    pipelineError = e;
  }

  const latencyMs = Date.now() - startTime;

  // --- Failure path: record an error audit row, then surface the error ---
  if (pipelineError) {
    try {
      await base44.entities.AuditEvent.create({
        user_id: user.id, workspace_id: workspaceId, conversation_id: conversationId,
        event_type: 'agent_invocation', agent_type: 'orchestrator',
        model_used: config.models.primary, task_type: 'error',
        latency_ms: latencyMs, status: 'error',
        error_message: String(pipelineError?.message || pipelineError),
        stage_timings: ctx.timings || {}
      });
    } catch (e) { logger.warn("audit log failed", { error: String(e) }); }
    throw pipelineError;
  }

  // --- Post-response stages (best-effort, concurrent) ---
  const summaryEnabled = config.orchestrator.summaryEnabled !== false;
  const [, , summaryResult] = await Promise.allSettled([
    extractMemories(ctx, { workspaceId, conversationId, userMessage, responseText: result.responseText, memberIds, userId: user.id }),
    base44.entities.AuditEvent.create({
      user_id: user.id, workspace_id: workspaceId, conversation_id: conversationId,
      event_type: 'agent_invocation', agent_type: 'orchestrator',
      model_used: result.modelUsed, task_type: result.taskType,
      latency_ms: latencyMs, status: 'success',
      stage_timings: result.stageTimings || {}
    }),
    summaryEnabled
      ? summarizeConversation(ctx, conversationId, history, userMessage, result.responseText)
      : Promise.resolve(null)
  ]);
  const conversationSummary = summaryResult.status === 'fulfilled' ? summaryResult.value : null;

  logger.info("stage.timings", { latencyMs, stageTimings: ctx.timings });

  return Response.json({
    response: result.responseText,
    taskType: result.taskType,
    modelUsed: result.modelUsed,
    latencyMs,
    summary: conversationSummary,
    council: {
      memoriesUsed: (memories || []).map(m => ({ id: m.id, preview: String(m.content || '').slice(0, 120), evidence: m.evidence_level || null, volatility: m.volatility || null })),
      classification: result.classification,
      webSearch: result.searchResults ? { query: result.searchQuery, results: result.searchResults, model: result.webSearchModel } : null,
      plan: result.plan,
      taskContextId: result.taskContext?.id || null,
      subTasks: result.subTaskOutputs,
      critic: result.critic,
      revisions: result.revisions,
      governor: result.governor,
      stageTimings: result.stageTimings
    }
  });
}

export default wrapHandler(handle, rootLogger);