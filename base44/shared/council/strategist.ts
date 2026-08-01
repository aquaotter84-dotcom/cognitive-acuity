// Council operator — Strategist (planning). Decides whether the classified task needs
// decomposition. When it does, it opens a TaskContext record to track the council's
// work; otherwise it passes through. Rule-based (no model call) for Phase 2.

import { defineAgent } from "../runtime.ts";

export const strategistAgent = defineAgent({
  name: "strategist",
  type: "stage",
  async handle(message, ctx) {
    const { classification, conversationId, workspaceId, userMessage } = message.content;
    if (!classification || !classification.needs_decomposition) {
      return { ...message.content, taskContext: null, plan: "direct" };
    }
    try {
      const taskContext = await ctx.base44.entities.TaskContext.create({
        conversation_id: conversationId,
        workspace_id: workspaceId,
        goal: userMessage,
        task_type: classification.task_type,
        status: "in_progress"
      });
      return { ...message.content, taskContext, plan: "decomposed" };
    } catch (e) {
      ctx.logger.warn("strategist could not create task context", { error: String(e) });
      return { ...message.content, taskContext: null, plan: "direct" };
    }
  }
});