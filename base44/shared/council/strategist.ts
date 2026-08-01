// Council operator — Strategist (planning). When the Observer flags a task as needing
// decomposition, asks a lightweight model to break the goal into 2-4 specialist
// sub-tasks and persists them on a new TaskContext. Rule-based pass-through otherwise.
// Phase 3: now populates TaskContext.sub_tasks for the specialist layer to execute.

import { defineAgent } from "../runtime.ts";
import { callLLM } from "../llm.ts";

const ALLOWED_AGENTS = ["research", "coding", "analysis", "planning", "creative", "decision_support", "question_answering", "action_execution"];

export const strategistAgent = defineAgent({
  name: "strategist",
  type: "stage",
  async handle(message, ctx) {
    const { classification, conversationId, workspaceId, userMessage } = message.content;
    if (!classification || !classification.needs_decomposition) {
      return { ...message.content, taskContext: null, plan: "direct" };
    }
    try {
      const raw = await callLLM(ctx, {
        model: ctx.config.council.strategistModel,
        maxTokens: ctx.config.council.strategistMaxTokens,
        jsonMode: true,
        messages: [
          {
            role: "system",
            content: `You are the Strategist of the COGNOS council. Decompose the user's goal into 2-4 focused sub-tasks, each assigned to a specialist. Respond with JSON only: {"sub_tasks":[{"id":"s1","agent":one of [${ALLOWED_AGENTS.join(", ")}],"description":"short","input":"the specific instruction for the specialist"}]}. Keep sub-tasks independent and non-overlapping.`
          },
          { role: "user", content: userMessage }
        ]
      });
      let sub_tasks = [];
      try {
        const parsed = JSON.parse(raw);
        sub_tasks = (parsed.sub_tasks || []).filter(s => s.agent && ALLOWED_AGENTS.includes(s.agent));
      } catch (e) {
        ctx.logger.warn("strategist could not parse decomposition", { error: String(e) });
      }
      if (sub_tasks.length === 0) {
        return { ...message.content, taskContext: null, plan: "direct" };
      }
      sub_tasks = sub_tasks.map((s, i) => ({
        id: s.id || `s${i + 1}`,
        agent: s.agent,
        description: s.description || "",
        input: s.input || s.description || "",
        status: "pending"
      }));
      const taskContext = await ctx.base44.entities.TaskContext.create({
        conversation_id: conversationId,
        workspace_id: workspaceId,
        goal: userMessage,
        task_type: classification.task_type,
        status: "in_progress",
        sub_tasks
      });
      return { ...message.content, taskContext, plan: "decomposed" };
    } catch (e) {
      ctx.logger.warn("strategist decomposition failed, falling back to direct", { error: String(e) });
      return { ...message.content, taskContext: null, plan: "direct" };
    }
  }
});