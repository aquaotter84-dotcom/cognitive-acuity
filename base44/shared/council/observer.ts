// Council operator — Observer (perception). Classifies the incoming request so the
// rest of the council can route and plan. Degrades gracefully: on any failure it
// returns a safe default classification so the core chat never breaks.

import { defineAgent } from "../runtime.ts";
import { callLLM } from "../llm.ts";

const TASK_TYPES = "conversation, question_answering, research, planning, coding, analysis, creative, decision_support, action_execution";

const OBSERVER_SCHEMA = {
  type: "object",
  properties: {
    task_type: { type: "string" },
    complexity: { type: "string" },
    needs_decomposition: { type: "boolean" },
    intent: { type: "string" }
  }
};

export const observerAgent = defineAgent({
  name: "observer",
  type: "stage",
  async handle(message, ctx) {
    const { userMessage } = message.content;
    const fallback = { task_type: "conversation", complexity: "simple", needs_decomposition: false, intent: "unclassified" };
    try {
      const classification = await callLLM(ctx, {
        model: ctx.config.council.observerModel,
        responseJsonSchema: OBSERVER_SCHEMA,
        messages: [
          {
            role: "system",
            content: `You are the Observer, the perception agent of the COGNOS council. Classify the user's request. Set task_type to one of [${TASK_TYPES}], complexity to "simple", "moderate", or "complex", needs_decomposition to true only for genuinely multi-step or multi-domain tasks, and intent to a short description.`
          },
          { role: "user", content: userMessage }
        ]
      });
      if (!classification || typeof classification !== "object" || !classification.task_type) {
        return { ...message.content, classification: fallback };
      }
      return { ...message.content, classification };
    } catch (e) {
      ctx.logger.warn("observer failed, using fallback classification", { error: String(e) });
      return { ...message.content, classification: fallback };
    }
  }
});