// runCouncil — the single cognitive pipeline. Replaces the per-request
// registry/orchestrator/eventBus/protocol/runtime dispatch scaffold: the
// operators are plain async functions called directly, with per-stage timing
// recorded into ctx.timings (the same shape the Council trace UI reads).
//
// Pipeline (convergence phase):
//   Observer  →  (webSearch ∥ Strategist)  →  Specialist  →  Synthesizer
//                                                       ↕  Critic (revision loop)
//                                                         →  Governor
//
// webSearch and Strategist both depend only on the Observer's classification,
// so they run concurrently. The Critic↔Synthesizer loop is the real "council"
// — judge and reasoner iterate — with revision failures contained (the
// previous response is kept if a revision call throws).

import { observerAgent } from "./observer.ts";
import { strategistAgent } from "./strategist.ts";
import { specialistAgent } from "./specialist.ts";
import { synthesizerAgent } from "./synthesizer.ts";
import { criticAgent } from "./critic.ts";
import { governorAgent } from "./governor.ts";
import { webSearchAgent } from "./webSearch.ts";

let counter = 0;
// Minimal envelope the operators read (.content). Kept as a helper so the
// operator contract (handle(message, ctx)) stays unchanged.
function msg(content) {
  return {
    id: `msg_${Date.now()}_${counter++}`,
    type: "council",
    from: "pipeline",
    to: "*",
    content,
    metadata: {},
    timestamp: new Date().toISOString()
  };
}

function recordTiming(ctx, stage, ms, status) {
  if (!ctx.timings) ctx.timings = {};
  const prev = ctx.timings[stage] || { totalMs: 0, runs: 0, lastStatus: "success" };
  prev.totalMs += ms;
  prev.runs += 1;
  prev.lastStatus = status;
  ctx.timings[stage] = prev;
}

async function timed(ctx, stage, fn) {
  const t0 = Date.now();
  try {
    const r = await fn();
    const ms = Date.now() - t0;
    recordTiming(ctx, stage, ms, "success");
    ctx.logger?.debug?.("stage.timing", { stage, ms });
    return r;
  } catch (e) {
    const ms = Date.now() - t0;
    recordTiming(ctx, stage, ms, "error");
    ctx.logger?.debug?.("stage.timing", { stage, ms, error: String(e) });
    throw e;
  }
}

// runCouncil(ctx, input) → result. Both chatOrchestrate and runCouncilAutonomous
// assemble context (history/memories/workspace) their own way and call this.
// ctx: { base44, config, logger, timings: {} }
// input: { userMessage, conversationId, workspaceId, history, memories, workspace, style, attachments, webSearch }
export async function runCouncil(ctx, input) {
  const baseContent = {
    userMessage: input.userMessage,
    conversationId: input.conversationId,
    workspaceId: input.workspaceId,
    history: input.history,
    memories: input.memories,
    workspace: input.workspace,
    style: input.style,
    attachments: input.attachments || [],
    webSearch: !!input.webSearch
  };

  // 1. Observer (perception)
  const observerResult = await timed(ctx, "observer", () =>
    observerAgent.handle(msg(baseContent), ctx)
  );

  // 2. webSearch ∥ Strategist — both depend only on the Observer's classification.
  const [webSearchResult, strategistResult] = await Promise.all([
    timed(ctx, "webSearch", () => webSearchAgent.handle(msg(observerResult), ctx)),
    timed(ctx, "strategist", () => strategistAgent.handle(msg(observerResult), ctx))
  ]);

  // Merge pulled web facts into the strategist's output so the Specialist
  // reasons over them (previously threaded serially through the strategist).
  const specialistInput = { ...strategistResult };
  if (webSearchResult.searchResults) {
    specialistInput.searchResults = webSearchResult.searchResults;
    specialistInput.searchQuery = webSearchResult.searchQuery;
    specialistInput.webSearchModel = webSearchResult.webSearchModel;
  }

  // 3. Specialist (execution: direct response or parallel sub-tasks)
  const specialistResult = await timed(ctx, "specialist", () =>
    specialistAgent.handle(msg(specialistInput), ctx)
  );

  // 4. Synthesizer (integration / direct pass-through)
  let currentResponse = await timed(ctx, "synthesizer", () =>
    synthesizerAgent.handle(msg(specialistResult), ctx)
  );

  // 5. Critic-driven revision loop (judge ↔ reasoner). Contained: if a revision
  // call throws, keep the previous response instead of aborting the whole turn.
  let criticResult = await timed(ctx, "critic", () =>
    criticAgent.handle(msg(currentResponse), ctx)
  );
  const maxRevisions = ctx.config.council.maxRevisions || 0;
  const threshold = ctx.config.council.revisionScoreThreshold || 0;
  let revisionCount = 0;
  let revisionTriggered = false;
  while (
    maxRevisions > 0 &&
    revisionCount < maxRevisions &&
    criticResult.evaluation &&
    !criticResult.evaluation.skipped &&
    criticResult.evaluation.needs_revision === true &&
    typeof criticResult.evaluation.score === "number" &&
    criticResult.evaluation.score < threshold
  ) {
    revisionTriggered = true;
    revisionCount++;
    try {
      currentResponse = await timed(ctx, "synthesizer", () =>
        synthesizerAgent.handle(msg({ ...currentResponse, critique: criticResult.evaluation, revision: true }), ctx)
      );
    } catch (e) {
      ctx.logger?.warn?.("revision synthesizer failed, keeping previous response", { error: String(e) });
      break;
    }
    criticResult = await timed(ctx, "critic", () =>
      criticAgent.handle(msg(currentResponse), ctx)
    );
  }

  // 6. Governor (sovereignty) — synchronous rule gate, no model call.
  const governorResult = await timed(ctx, "governor", () =>
    governorAgent.handle(msg({ responseText: currentResponse.responseText }), ctx)
  );

  return {
    responseText: currentResponse.responseText,
    taskType: currentResponse.taskType,
    modelUsed: currentResponse.modelUsed,
    classification: observerResult.classification,
    plan: strategistResult.plan,
    taskContext: strategistResult.taskContext,
    subTaskOutputs: specialistResult.subTaskOutputs || null,
    searchQuery: webSearchResult.searchQuery || null,
    searchResults: webSearchResult.searchResults || null,
    webSearchModel: webSearchResult.webSearchModel || null,
    critic: criticResult.evaluation,
    revisions: { count: revisionCount, triggered: revisionTriggered, maxRevisions },
    governor: { approved: governorResult.approved, flags: governorResult.flags },
    stageTimings: ctx.timings || {}
  };
}