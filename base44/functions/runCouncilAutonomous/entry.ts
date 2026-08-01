// runCouncilAutonomous — Phase 11 (Autonomous Workflows). Runs the full council
// pipeline WITHOUT a live conversation: the council deliberates on a topic and
// persists an Insight. Reuses the same Observer → Strategist → Specialist →
// Synthesizer → Critic (revision loop) → Governor pipeline as chatOrchestrate.
//
// Invoked either with a specific workspaceId (manual, from the Insights UI) or
// with no args to deliberate for every workspace (the scheduled-workflow path).
// Uses the service role for reads/creates so it works without a user session and
// respects workspace membership via member_ids copied onto each Insight.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { createLogger } from "../../shared/logging.ts";
import { getSystemConfig } from "../../shared/config.ts";
import { createRegistry } from "../../shared/registry.ts";
import { createEventBus } from "../../shared/eventBus.ts";
import { createOrchestrator } from "../../shared/orchestrator.ts";
import { createMessage } from "../../shared/protocol.ts";
import { wrapHandler } from "../../shared/errors.ts";
import { registerCouncil } from "../../shared/council/index.ts";

const rootLogger = createLogger("runCouncilAutonomous");

function briefingTopic(workspaceName) {
  return `Produce a concise daily briefing for the "${workspaceName}" workspace. Review the recent activity and stored memory digest below, then surface: (1) anything that deserves the user's attention today, (2) any open follow-ups or stale threads worth closing, and (3) one recommended next step. Be specific and grounded in the provided context; do not invent details. Keep it under ~200 words, in markdown.`;
}

async function buildContext(base44, workspaceId, topic) {
  const workspace = await base44.asServiceRole.entities.Workspace.get(workspaceId);
  const memories = await base44.asServiceRole.entities.Memory.filter(
    { workspace_id: workspaceId, is_enabled: true },
    '-importance',
    12
  );
  const conversations = await base44.asServiceRole.entities.Conversation.filter(
    { workspace_id: workspaceId, is_archived: false },
    '-created_date',
    10
  );
  const recentActivity = (conversations || [])
    .map(c => {
      const parts = [c.title || 'Untitled'];
      if (c.summary) parts.push(c.summary);
      return `- ${parts.join(' — ')}`;
    })
    .join('\n') || '(no recent conversations)';
  const memoryDigest = (memories || []).map(m => `- ${m.content}`).join('\n') || '(no memories)';
  const userMessage = `${topic || briefingTopic(workspace.name)}\n\nRecent activity:\n${recentActivity}\n\nStored memory digest:\n${memoryDigest}`;
  return { workspace, memories, userMessage };
}

async function runForWorkspace(base44, workspaceId, topic, trigger, logger) {
  const config = getSystemConfig();
  const subLogger = logger.child("workspace");
  const registry = createRegistry();
  const eventBus = createEventBus(subLogger);
  const orchestrator = createOrchestrator({ registry, eventBus, logger: subLogger });
  registerCouncil(registry);
  const ctx = { base44, config, logger: subLogger };

  const { workspace, memories, userMessage } = await buildContext(base44, workspaceId, topic);

  // Observer (perception)
  const observerResult = await orchestrator.dispatch("observer", createMessage({
    type: "council.observe", from: "autonomous",
    content: { userMessage, workspaceId, conversationId: null, history: [], memories, workspace, style: undefined }
  }), ctx);

  // Strategist (planning)
  const strategistResult = await orchestrator.dispatch("strategist", createMessage({
    type: "council.plan", from: "autonomous", content: observerResult
  }), ctx);

  // Specialist (execution)
  const specialistResult = await orchestrator.dispatch("specialist", createMessage({
    type: "council.execute", from: "autonomous", content: strategistResult
  }), ctx);

  // Synthesizer (integration)
  let currentResponse = await orchestrator.dispatch("synthesizer", createMessage({
    type: "council.synthesize", from: "autonomous", content: specialistResult
  }), ctx);

  // Critic-driven revision loop
  let criticResult = await orchestrator.dispatch("critic", createMessage({
    type: "council.critique", from: "autonomous", content: currentResponse
  }), ctx);
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
    currentResponse = await orchestrator.dispatch("synthesizer", createMessage({
      type: "council.revise", from: "autonomous",
      content: { ...currentResponse, critique: criticResult.evaluation, revision: true }
    }), ctx);
    criticResult = await orchestrator.dispatch("critic", createMessage({
      type: "council.critique", from: "autonomous", content: currentResponse
    }), ctx);
  }

  // Governor (sovereignty)
  const governorResult = await orchestrator.dispatch("governor", createMessage({
    type: "council.govern", from: "autonomous", content: { responseText: currentResponse.responseText }
  }), ctx);

  const responseText = currentResponse.responseText || "";
  const title = (responseText.split('\n').map(l => l.trim()).find(Boolean) || topic || 'Autonomous insight')
    .replace(/^#+\s*/, '').slice(0, 100);
  const memberIds = workspace.member_ids && workspace.member_ids.length ? workspace.member_ids : [];

  const insight = await base44.asServiceRole.entities.Insight.create({
    workspace_id: workspaceId,
    title,
    content: responseText || '(no output)',
    trigger_type: trigger,
    topic: topic || 'daily_briefing',
    task_type: currentResponse.taskType || observerResult.classification?.task_type || 'analysis',
    model_used: currentResponse.modelUsed || config.models.primary,
    council: {
      classification: observerResult.classification,
      plan: strategistResult.plan,
      critic: criticResult.evaluation,
      revisions: { count: revisionCount, triggered: revisionTriggered, maxRevisions },
      governor: { approved: governorResult.approved, flags: governorResult.flags }
    },
    member_ids: memberIds,
    is_read: false
  });

  return {
    workspaceId,
    insightId: insight.id,
    title,
    trigger,
    criticScore: criticResult.evaluation?.score ?? null,
    governorApproved: governorResult.approved
  };
}

async function handle(req) {
  const base44 = createClientFromRequest(req);
  const body = await req.json().catch(() => ({}));
  const { workspaceId, topic, trigger } = body || {};

  let user = null;
  try { user = await base44.auth.me(); } catch {}

  // Single-workspace (manual) path: deliberate for one workspace.
  if (workspaceId) {
    const result = await runForWorkspace(base44, workspaceId, topic, trigger || 'manual', rootLogger);
    return Response.json({ processed: [result] });
  }

  // Broadcast (no workspaceId): scheduled path. Requires admin if a user session exists.
  if (user && user.role !== 'admin') {
    return Response.json({ error: "Admin role required to broadcast across all workspaces" }, { status: 403 });
  }
  const workspaces = await base44.asServiceRole.entities.Workspace.list();
  const results = [];
  for (const ws of workspaces) {
    try {
      results.push(await runForWorkspace(base44, ws.id, undefined, 'scheduled', rootLogger));
    } catch (e) {
      rootLogger.warn("autonomous run failed for workspace", { workspaceId: ws.id, error: String(e) });
      results.push({ workspaceId: ws.id, error: String(e) });
    }
  }
  return Response.json({ processed: results });
}

export default wrapHandler(handle, rootLogger);