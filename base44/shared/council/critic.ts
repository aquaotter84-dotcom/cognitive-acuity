// Council operator — Critic (critique). Evaluates the generated response for quality
// and completeness. Best-effort: disabled via config or degrades to "skipped" on any
// failure. Marks the TaskContext complete when present.

import { defineAgent } from "../runtime.ts";

const OPENAI_URL = "https://openrouter.ai/api/v1/chat/completions";

export const criticAgent = defineAgent({
  name: "critic",
  type: "post",
  async handle(message, ctx) {
    if (!ctx.config.council.criticEnabled) {
      return { evaluation: { skipped: true, reason: "disabled" } };
    }
    const { userMessage, responseText, taskContext } = message.content;
    try {
      const resp = await fetch(OPENAI_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${ctx.apiKey}`,
          "HTTP-Referer": "https://cognos.app",
          "X-Title": "COGNOS"
        },
        body: JSON.stringify({
          model: ctx.config.council.criticModel,
          messages: [
            {
              role: "system",
              content: 'You are the Critic, the evaluation agent of the COGNOS council. Assess the assistant response to the user request. Respond with JSON only: {"score": integer 1-10, "reasoning": string, "needs_revision": boolean}. needs_revision=true only for clearly inadequate or incorrect responses.'
            },
            { role: "user", content: `Request: ${userMessage}\n\nResponse: ${responseText}` }
          ],
          max_tokens: ctx.config.council.criticMaxTokens,
          response_format: { type: "json_object" }
        })
      });
      if (!resp.ok) {
        ctx.logger.warn("critic model call failed", { status: resp.status });
        return { evaluation: { skipped: true, reason: "model_error" } };
      }
      const data = await resp.json();
      const evaluation = JSON.parse(data.choices[0].message.content);
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