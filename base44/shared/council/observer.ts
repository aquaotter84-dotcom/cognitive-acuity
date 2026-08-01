// Council operator — Observer (perception). Classifies the incoming request so the
// rest of the council can route and plan. Degrades gracefully: on any failure it
// returns a safe default classification so the core chat never breaks.

import { defineAgent } from "../runtime.ts";

const OPENAI_URL = "https://openrouter.ai/api/v1/chat/completions";

const TASK_TYPES = "conversation, question_answering, research, planning, coding, analysis, creative, decision_support, action_execution";

export const observerAgent = defineAgent({
  name: "observer",
  type: "stage",
  async handle(message, ctx) {
    const { userMessage } = message.content;
    const fallback = { task_type: "conversation", complexity: "simple", needs_decomposition: false, intent: "unclassified" };
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
          model: ctx.config.council.observerModel,
          messages: [
            {
              role: "system",
              content: `You are the Observer, the perception agent of the COGNOS council. Classify the user's request. Respond with JSON only: {"task_type": one of [${TASK_TYPES}], "complexity": "simple"|"moderate"|"complex", "needs_decomposition": boolean, "intent": string}. Set needs_decomposition=true only for genuinely multi-step or multi-domain tasks.`
            },
            { role: "user", content: userMessage }
          ],
          max_tokens: ctx.config.council.observerMaxTokens,
          response_format: { type: "json_object" }
        })
      });
      if (!resp.ok) {
        ctx.logger.warn("observer model call failed", { status: resp.status });
        return { ...message.content, classification: fallback };
      }
      const data = await resp.json();
      const classification = JSON.parse(data.choices[0].message.content);
      return { ...message.content, classification };
    } catch (e) {
      ctx.logger.warn("observer failed, using fallback classification", { error: String(e) });
      return { ...message.content, classification: fallback };
    }
  }
});