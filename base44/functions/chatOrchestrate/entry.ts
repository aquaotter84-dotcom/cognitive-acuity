import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Phase 1 nervous system
import { createLogger } from "../../shared/logging.ts";
import { getSystemConfig } from "../../shared/config.ts";
import { createRegistry } from "../../shared/registry.ts";
import { createEventBus } from "../../shared/eventBus.ts";
import { createOrchestrator } from "../../shared/orchestrator.ts";
import { defineAgent } from "../../shared/runtime.ts";
import { createMessage } from "../../shared/protocol.ts";
import { CognosError, wrapHandler } from "../../shared/errors.ts";
import { registerCouncil } from "../../shared/council/index.ts";
import { callLLM } from "../../shared/llm.ts";

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

// Phase 7 — relevance-based memory retrieval. When the workspace has more enabled
// memories than the context budget, a lightweight model ranks the pool by relevance
// to the current message and the top-N are used. Falls back to importance order.
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

const SUMMARIZE_SCHEMA = {
  type: "object",
  properties: { summary: { type: "string" } }
};

// Phase 9 — conversation summarization. After each exchange, a lightweight model
// writes a 1-2 sentence running summary onto the Conversation so the workspace
// retains context continuity. Best-effort; never fails the request.
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

async function handle(req) {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) throw new CognosError("Unauthorized", { code: "AUTH", category: "auth", status: 401 });

  const body = await req.json();
  const { conversationId, workspaceId, userMessage, style, attachments, webSearch } = body;
  if (!conversationId || !workspaceId || !userMessage) {
    throw new CognosError("Missing required fields", { code: "VALIDATION", category: "input", status: 400 });
  }

  // --- Nervous system setup ---
  const config = getSystemConfig();
  const logger = rootLogger.child("orchestrator");
  const registry = createRegistry();
  const eventBus = createEventBus(logger);
  const orchestrator = createOrchestrator({ registry, eventBus, logger });

  eventBus.subscribe("orchestration.stage.start", (e) => logger.info("stage.start", e));
  eventBus.subscribe("orchestration.stage.complete", (e) => logger.info("stage.complete", e));

  // --- Stage: context assembly ---
  const contextAgent = defineAgent({
    name: "contextAssembly",
    type: "stage",
    async handle(message, ctx) {
      const { conversationId, workspaceId, userMessage } = message.content;
      const messages = await ctx.base44.entities.Message.filter(
        { conversation_id: conversationId },
        '-created_date',
        ctx.config.orchestrator.maxHistoryMessages
      );
      const history = [...messages].reverse();
      const poolSize = ctx.config.orchestrator.memoryPoolSize || ctx.config.orchestrator.maxMemories;
      const pool = await ctx.base44.entities.Memory.filter(
        { workspace_id: workspaceId, is_enabled: true },
        '-importance',
        poolSize
      );
      const memories = await selectRelevantMemories(ctx, userMessage, pool, ctx.config.orchestrator.maxMemories);
      const workspace = await ctx.base44.entities.Workspace.get(workspaceId);
      return { ...message.content, history, memories, workspace };
    }
  });

  // --- Stage: LLM response — moved to the council specialist + synthesizer (Phase 3) ---

  // --- Stage: memory extraction (best-effort) ---
  const memoryAgent = defineAgent({
    name: "memoryExtraction",
    type: "post",
    async handle(message, ctx) {
      const { workspaceId, conversationId, userMessage, responseText, memberIds } = message.content;
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
              member_ids: memberIds && memberIds.length ? memberIds : [user.id]
            }));
          if (records.length > 0) {
            await ctx.base44.entities.Memory.bulkCreate(records);
          }
        }
      } catch (e) {
        ctx.logger.warn("memory extraction failed", { error: String(e) });
      }
    }
  });

  // --- Stage: audit log (best-effort) ---
  const auditAgent = defineAgent({
    name: "auditLog",
    type: "post",
    async handle(message, ctx) {
      const { userId, workspaceId, conversationId, modelUsed, taskType, latencyMs, status } = message.content;
      try {
        await ctx.base44.entities.AuditEvent.create({
          user_id: userId,
          workspace_id: workspaceId,
          conversation_id: conversationId,
          event_type: 'agent_invocation',
          agent_type: 'orchestrator',
          model_used: modelUsed,
          task_type: taskType,
          latency_ms: latencyMs,
          status: status
        });
      } catch (e) {
        ctx.logger.warn("audit log failed", { error: String(e) });
      }
    }
  });

  registry.register(contextAgent.name, contextAgent);
  registry.register(memoryAgent.name, memoryAgent);
  registry.register(auditAgent.name, auditAgent);
  registerCouncil(registry);

  const ctx = { base44, config, logger, timings: {} };

  const startTime = Date.now();

  // --- Orchestrate the pipeline ---
  const contextMsg = createMessage({
    type: "context.request",
    from: "orchestrator",
    content: { conversationId, workspaceId, userMessage, style, attachments: attachments || [], webSearch: !!webSearch }
  });
  const contextResult = await orchestrator.dispatch("contextAssembly", contextMsg, ctx);

  // --- Phase 2: cognitive layer — perception & planning ---
  const observerMsg = createMessage({
    type: "council.observe",
    from: "orchestrator",
    content: contextResult
  });
  const observerResult = await orchestrator.dispatch("observer", observerMsg, ctx);

  // --- Web search tool — pulls current facts when the Observer flags it (or the user toggle is on) ---
  const webSearchMsg = createMessage({
    type: "council.search",
    from: "orchestrator",
    content: observerResult
  });
  const webSearchResult = await orchestrator.dispatch("webSearch", webSearchMsg, ctx);

  const strategistMsg = createMessage({
    type: "council.plan",
    from: "orchestrator",
    content: webSearchResult
  });
  const strategistResult = await orchestrator.dispatch("strategist", strategistMsg, ctx);

  // --- Phase 3: specialist layer — execute sub-tasks or direct response ---
  const specialistMsg = createMessage({
    type: "council.execute",
    from: "orchestrator",
    content: strategistResult
  });
  const specialistResult = await orchestrator.dispatch("specialist", specialistMsg, ctx);

  // --- Phase 3: synthesis — combine specialist outputs (no-op for direct path) ---
  const synthMsg = createMessage({
    type: "council.synthesize",
    from: "orchestrator",
    content: specialistResult
  });
  const synthResult = await orchestrator.dispatch("synthesizer", synthMsg, ctx);

  // --- Phase 4: critic-driven revision loop ---
  // The Critic evaluates the synthesized response; if it flags the response as
  // needing revision (needs_revision && score below threshold), the Synthesizer
  // revises with the critique and is re-evaluated. Capped at maxRevisions.
  let currentResponse = synthResult;
  let criticResult = await orchestrator.dispatch("critic", createMessage({
    type: "council.critique", from: "orchestrator", content: currentResponse
  }), ctx);

  // Phase 13 — Law 4 (adaptive reasoning) & economic intelligence: the problem
  // determines the reasoning. Simple requests skip the costly critic revision loop;
  // only moderate/complex tasks warrant it. The Strategist already passes through
  // (plan: "direct") when the Observer flags no decomposition needed, so the simple
  // path collapses to observer → specialist → synthesizer → governor.
  const isSimple = observerResult.classification?.complexity === 'simple';
  const maxRevisions = isSimple ? 0 : (ctx.config.council.maxRevisions || 0);
  const revisionScoreThreshold = ctx.config.council.revisionScoreThreshold || 0;
  let revisionCount = 0;
  let revisionTriggered = false;

  while (
    maxRevisions > 0 &&
    revisionCount < maxRevisions &&
    criticResult.evaluation &&
    !criticResult.evaluation.skipped &&
    criticResult.evaluation.needs_revision === true &&
    typeof criticResult.evaluation.score === "number" &&
    criticResult.evaluation.score < revisionScoreThreshold
  ) {
    revisionTriggered = true;
    revisionCount++;
    const reviseMsg = createMessage({
      type: "council.revise",
      from: "orchestrator",
      content: { ...currentResponse, critique: criticResult.evaluation, revision: true }
    });
    currentResponse = await orchestrator.dispatch("synthesizer", reviseMsg, ctx);
    criticResult = await orchestrator.dispatch("critic", createMessage({
      type: "council.critique", from: "orchestrator", content: currentResponse
    }), ctx);
  }

  const latencyMs = Date.now() - startTime;
  logger.info("stage.timings", { latencyMs, stageTimings: ctx.timings });

  // --- Phase 2: cognitive layer — governance ---
  const governorMsg = createMessage({
    type: "council.govern",
    from: "orchestrator",
    content: { responseText: currentResponse.responseText }
  });
  const governorResult = await orchestrator.dispatch("governor", governorMsg, ctx);

  // --- Post-response stages (best-effort, run concurrently) ---
  // Memory extraction, audit logging, and summarization do not affect the
  // response text. Running them concurrently (instead of serially) cuts the
  // post-response tail to the slowest of the three, while still awaiting the
  // batch so all three are guaranteed to complete before the function returns
  // (memories, audit, and summary are core COGNOS functionality — not dropped).
  const memMsg = createMessage({
    type: "memory.request",
    from: "orchestrator",
    content: { workspaceId, conversationId, userMessage, responseText: currentResponse.responseText, memberIds: contextResult.workspace?.member_ids || [] }
  });
  const auditMsg = createMessage({
    type: "audit.request",
    from: "orchestrator",
    content: {
      userId: user.id,
      workspaceId,
      conversationId,
      modelUsed: currentResponse.modelUsed,
      taskType: currentResponse.taskType,
      latencyMs,
      status: "success"
    }
  });
  const summaryEnabled = ctx.config.orchestrator.summaryEnabled !== false;
  const [, , summaryResult] = await Promise.allSettled([
    orchestrator.dispatch("memoryExtraction", memMsg, ctx),
    orchestrator.dispatch("auditLog", auditMsg, ctx),
    summaryEnabled
      ? summarizeConversation(ctx, conversationId, contextResult.history, userMessage, currentResponse.responseText)
      : Promise.resolve(null)
  ]);
  const conversationSummary = summaryResult.status === "fulfilled" ? summaryResult.value : null;

  await eventBus.publish("orchestration.complete", { latencyMs });

  return Response.json({
    response: currentResponse.responseText,
    taskType: currentResponse.taskType,
    modelUsed: currentResponse.modelUsed,
    latencyMs,
    summary: conversationSummary,
    council: {
      memoriesUsed: (contextResult.memories || []).map(m => ({ id: m.id, preview: String(m.content || '').slice(0, 120), evidence: m.evidence_level || null, volatility: m.volatility || null })),
      classification: observerResult.classification,
      webSearch: webSearchResult.searchResults ? { query: webSearchResult.searchQuery, results: webSearchResult.searchResults, model: webSearchResult.webSearchModel } : null,
      plan: strategistResult.plan,
      taskContextId: strategistResult.taskContext?.id || null,
      subTasks: specialistResult.subTaskOutputs || null,
      critic: criticResult.evaluation,
      revisions: { count: revisionCount, triggered: revisionTriggered, maxRevisions },
      adaptive: { complexity: observerResult.classification?.complexity, path: isSimple ? 'direct' : 'full' },
      governor: { approved: governorResult.approved, flags: governorResult.flags },
      stageTimings: ctx.timings || {}
    }
  });
}

export default wrapHandler(handle, rootLogger);