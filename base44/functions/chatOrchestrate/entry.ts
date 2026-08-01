import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from "base44:runtime";

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

const OPENAI_URL = 'https://openrouter.ai/api/v1/chat/completions';
const rootLogger = createLogger("chatOrchestrate");

async function handle(req) {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) throw new CognosError("Unauthorized", { code: "AUTH", category: "auth", status: 401 });

  const body = await req.json();
  const { conversationId, workspaceId, userMessage } = body;
  if (!conversationId || !workspaceId || !userMessage) {
    throw new CognosError("Missing required fields", { code: "VALIDATION", category: "input", status: 400 });
  }

  const apiKey = secrets.get("Api_key");
  if (!apiKey) throw new CognosError("API key not configured", { code: "CONFIG", category: "secrets", status: 500 });

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
      const memories = await ctx.base44.entities.Memory.filter(
        { workspace_id: workspaceId, is_enabled: true },
        '-importance',
        ctx.config.orchestrator.maxMemories
      );
      const workspace = await ctx.base44.entities.Workspace.get(workspaceId);
      return { conversationId, workspaceId, userMessage, history, memories, workspace };
    }
  });

  // --- Stage: LLM response — moved to the council specialist + synthesizer (Phase 3) ---

  // --- Stage: memory extraction (best-effort) ---
  const memoryAgent = defineAgent({
    name: "memoryExtraction",
    type: "post",
    async handle(message, ctx) {
      const { workspaceId, conversationId, userMessage, responseText } = message.content;
      try {
        const memResponse = await fetch(OPENAI_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${ctx.apiKey}`
          },
          body: JSON.stringify({
            model: ctx.config.models.memory,
            messages: [
              {
                role: 'system',
                content: 'You are a memory extraction agent. Analyze the conversation and extract any important facts, preferences, or information worth remembering for future conversations. Only extract genuinely useful, long-term information — not casual conversation. Return a JSON object with a "memories" array. Each memory has "content" (string), "memory_type" ("episodic" or "semantic"), and "importance" (1-10 integer). Return {"memories": []} if nothing is worth remembering.'
              },
              {
                role: 'user',
                content: `User: ${userMessage}\nAssistant: ${responseText}`
              }
            ],
            max_tokens: ctx.config.limits.memoryMaxTokens,
            response_format: { type: 'json_object' }
          })
        });
        if (!memResponse.ok) {
          ctx.logger.warn("memory extraction model call failed", { status: memResponse.status });
          return;
        }
        const memData = await memResponse.json();
        const memResult = JSON.parse(memData.choices[0].message.content);
        if (memResult?.memories && memResult.memories.length > 0) {
          const records = memResult.memories
            .filter(m => m.content && m.content.trim().length > 5)
            .map(m => ({
              workspace_id: workspaceId,
              content: m.content.trim(),
              memory_type: m.memory_type || 'episodic',
              source: conversationId,
              importance: m.importance || 5,
              is_enabled: true
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

  const ctx = { base44, apiKey, config, logger };

  const startTime = Date.now();

  // --- Orchestrate the pipeline ---
  const contextMsg = createMessage({
    type: "context.request",
    from: "orchestrator",
    content: { conversationId, workspaceId, userMessage }
  });
  const contextResult = await orchestrator.dispatch("contextAssembly", contextMsg, ctx);

  // --- Phase 2: cognitive layer — perception & planning ---
  const observerMsg = createMessage({
    type: "council.observe",
    from: "orchestrator",
    content: contextResult
  });
  const observerResult = await orchestrator.dispatch("observer", observerMsg, ctx);

  const strategistMsg = createMessage({
    type: "council.plan",
    from: "orchestrator",
    content: observerResult
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

  const latencyMs = Date.now() - startTime;

  // --- Phase 2: cognitive layer — critique & governance ---
  const criticMsg = createMessage({
    type: "council.critique",
    from: "orchestrator",
    content: synthResult
  });
  const criticResult = await orchestrator.dispatch("critic", criticMsg, ctx);

  const governorMsg = createMessage({
    type: "council.govern",
    from: "orchestrator",
    content: { responseText: synthResult.responseText }
  });
  const governorResult = await orchestrator.dispatch("governor", governorMsg, ctx);

  // --- Post-response stages (best-effort, awaited to preserve prior ordering) ---
  const memMsg = createMessage({
    type: "memory.request",
    from: "orchestrator",
    content: { workspaceId, conversationId, userMessage, responseText: synthResult.responseText }
  });
  await orchestrator.dispatch("memoryExtraction", memMsg, ctx);

  const auditMsg = createMessage({
    type: "audit.request",
    from: "orchestrator",
    content: {
      userId: user.id,
      workspaceId,
      conversationId,
      modelUsed: synthResult.modelUsed,
      taskType: synthResult.taskType,
      latencyMs,
      status: "success"
    }
  });
  await orchestrator.dispatch("auditLog", auditMsg, ctx);

  await eventBus.publish("orchestration.complete", { latencyMs });

  return Response.json({
    response: synthResult.responseText,
    taskType: synthResult.taskType,
    modelUsed: synthResult.modelUsed,
    latencyMs,
    council: {
      classification: observerResult.classification,
      plan: strategistResult.plan,
      taskContextId: strategistResult.taskContext?.id || null,
      subTasks: specialistResult.subTaskOutputs || null,
      critic: criticResult.evaluation,
      governor: { approved: governorResult.approved, flags: governorResult.flags }
    }
  });
}

export default wrapHandler(handle, rootLogger);