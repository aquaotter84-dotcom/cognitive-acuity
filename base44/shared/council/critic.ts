// Council operator — Critic (critique). Evaluates the generated response for quality
// and completeness. Best-effort: disabled via config or degrades to "skipped" on any
// failure. Marks the TaskContext complete when present.

import { defineAgent } from "../runtime.ts";
import { callLLM } from "../llm.ts";

const CRITIC_SCHEMA = {
  type: "object",
  properties: {
    score: { type: "integer" },
    reasoning: { type: "string" },
    needs_revision: { type: "boolean" }
  }
};

export const criticAgent = defineAgent({
  name: "critic",
  type: "post",
  async handle(message, ctx) {
    if (!ctx.config.council.criticEnabled) {
      return { evaluation: { skipped: true, reason: "disabled" } };
    }
    const { userMessage, responseText, taskContext } = message.content;
    try {
      const evaluation = await callLLM(ctx, {
        model: ctx.config.council.criticModel,
        responseJsonSchema: CRITIC_SCHEMA,
        messages: [
          {
            role: "system",
            content: "You are the Critic, the evaluation agent of the COGNOS council. Assess the assistant response to the user request. Set score to an integer 1-10, reasoning to a short explanation, and needs_revision to true only for clearly inadequate or incorrect responses."
          },
          { role: "user", content: `Request: ${userMessage}\n\nResponse: ${responseText}` }
        ]
      });
      if (!evaluation || typeof evaluation !== "object") {
        return { evaluation: { skipped: true, reason: "malformed" } };
      }
      if (taskContext?.id) {
        try {
          await ctx.base44.entities.TaskContext.update(taskContext.id, { status: "complete" });
        } catch (e) {
          ctx.logger.warn("critic could not close task context", { error: String(e) });
        }
      }
      return { evaluation };
    } catch (e) {
      ctx.logger.warn("critic failed", { error: String(e) });
      return { evaluation: { skipped: true, reason: "exception" } };
    }
  }
});