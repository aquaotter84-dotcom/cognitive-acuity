// runCouncilAutonomous — Phase 11 (Autonomous Workflows). Runs the shared
// council pipeline WITHOUT a live conversation: the council deliberates on a
// topic and persists an Insight. Reuses runCouncil (the same pipeline as
// chatOrchestrate) — one orchestration engine, two entrypoints.
//
// Invoked either with a specific workspaceId (manual, from the Insights UI) or
// with no args to deliberate for every workspace (the scheduled-workflow path).
// Uses the service role for reads/creates so it works without a user session and
// respects workspace membership via member_ids copied onto each Insight.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { createLogger } from "../../shared/logging.ts";
import { getSystemConfig } from "../../shared/config.ts";
import { wrapHandler } from "../../shared/errors.ts";
import { runCouncil } from "../../shared/council/pipeline.ts";

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
  const ctx = { base44, config, logger: subLogger, timings: {} };

  const { workspace, memories, userMessage } = await buildContext(base44, workspaceId, topic);

  const result = await runCouncil(ctx, {
    userMessage,
    conversationId: null,
    workspaceId,
    history: [],
    memories,
    workspace,
    style: undefined,
    attachments: [],
    webSearch: false
  });

  const responseText = result.responseText || "";
  const title = (responseText.split('\n').map(l => l.trim()).find(Boolean) || topic || 'Autonomous insight')
    .replace(/^#+\s*/, '').slice(0, 100);
  const memberIds = workspace.member_ids && workspace.member_ids.length ? workspace.member_ids : [];

  const insight = await base44.asServiceRole.entities.Insight.create({
    workspace_id: workspaceId,
    title,
    content: responseText || '(no output)',
    trigger_type: trigger,
    topic: topic || 'daily_briefing',
    task_type: result.taskType || result.classification?.task_type || 'analysis',
    model_used: result.modelUsed || config.models.primary,
    council: {
      classification: result.classification,
      plan: result.plan,
      critic: result.critic,
      revisions: result.revisions,
      governor: { approved: result.governor.approved, flags: result.governor.flags }
    },
    member_ids: memberIds,
    is_read: false
  });

  return {
    workspaceId,
    insightId: insight.id,
    title,
    trigger,
    criticScore: result.critic?.score ?? null,
    governorApproved: result.governor.approved
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