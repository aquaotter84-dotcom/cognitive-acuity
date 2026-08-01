// Shared LLM utilities — central OpenRouter call + context system-prompt builder.
// Used by the council specialist and synthesizer so the model-call contract lives
// in one place rather than being copied between stages.

import { CognosError } from "./errors.ts";

const OPENAI_URL = "https://openrouter.ai/api/v1/chat/completions";

export async function callLLM(ctx, { model, messages, maxTokens, jsonMode = false }) {
  const body = { model, messages, max_tokens: maxTokens };
  if (jsonMode) body.response_format = { type: "json_object" };
  const resp = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${ctx.apiKey}`,
      "HTTP-Referer": "https://cognos.app",
      "X-Title": "COGNOS"
    },
    body: JSON.stringify(body)
  });
  if (!resp.ok) {
    const errText = await resp.text();
    throw new CognosError(`Model API error (${resp.status}): ${errText}`, { code: "LLM_ERROR", category: "model", status: 502 });
  }
  const data = await resp.json();
  return data.choices[0].message.content;
}

export function buildContextSystemPrompt(workspace, memories, classification, base = 'You are COGNOS, an intelligent AI reasoning assistant. You provide thoughtful, accurate, and helpful responses. Use markdown formatting when appropriate for clarity.') {
  let systemPrompt = base;
  if (workspace?.instructions) {
    systemPrompt += `\n\nWORKSPACE INSTRUCTIONS:\n${workspace.instructions}`;
  }
  if (memories && memories.length > 0) {
    systemPrompt += `\n\nRELEVANT MEMORIES:\n${memories.map(m => `- ${m.content}`).join('\n')}`;
  }
  if (classification?.task_type && classification.task_type !== 'conversation') {
    systemPrompt += `\n\nTASK CONTEXT: The Observer classified this as "${classification.task_type}" (${classification.complexity || 'unknown'} complexity). Tailor your reasoning approach accordingly.`;
  }
  return systemPrompt;
}