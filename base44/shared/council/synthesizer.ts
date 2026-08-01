// Council operator — Synthesizer (integration). Combines specialist sub-task outputs
// into a single coherent final response. No-op pass-through on the direct path
// (no decomposition), so the orchestrator pipeline stays uniform.

import { defineAgent } from "../runtime.ts";
import { callLLM, buildContextSystemPrompt } from "../llm.ts";

const SYNTH_BASE = "You are the Synthesizer of the COGNOS council. Integrate the specialist outputs below into a single coherent, well-structured response to the user's original request. Resolve overlaps, remove redundancy, and present a unified answer in markdown. Do not introduce claims beyond what the specialists provided.";

export const synthesizerAgent = defineAgent({
  name: "synthesizer",
  type: "stage",
  async handle(message, ctx) {
    const { needsSynthesis, subTaskOutputs, userMessage, history, workspace, memories, classification } = message.content;

    if (!needsSynthesis) {
      return { ...message.content };
    }

    const specialistBrief = subTaskOutputs
      .map((o, i) => `### Sub-task ${i + 1}: ${o.description || o.agent}\n${o.output || "(no output)"}`)
      .join("\n\n");

    const systemPrompt = buildContextSystemPrompt(workspace, memories, classification, SYNTH_BASE);
    const chatMessages = [
      { role: "system", content: systemPrompt },
      ...history.map(msg => ({ role: msg.role, content: msg.content })),
      { role: "user", content: `Original request:\n${userMessage}\n\nSpecialist outputs:\n${specialistBrief}` }
    ];
    const responseText = await callLLM(ctx, {
      model: ctx.config.models.primary,
      messages: chatMessages
    });
    return {
      ...message.content,
      responseText,
      taskType: classification?.task_type || "conversation",
      modelUsed: ctx.config.models.primary
    };
  }
});