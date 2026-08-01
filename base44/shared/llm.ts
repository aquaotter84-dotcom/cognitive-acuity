// Shared LLM utilities — routes model calls through Base44's built-in InvokeLLM
// integration (platform-managed key), so the app needs no external API key or credits.
// Used by the council operators and the memory stage.
//
// InvokeLLM takes a single prompt string (not a message array), so chat messages are
// flattened. When responseJsonSchema is provided, InvokeLLM returns a parsed object;
// otherwise it returns a string.

import { withCharter } from "./council/charter.ts";

export async function callLLM(ctx, { messages, responseJsonSchema = null, model = null, file_urls = null, add_context_from_internet = null }) {
  const prompt = messages
    .map(m => (m.role === "system" ? m.content : `${m.role === "assistant" ? "Assistant" : "User"}: ${m.content}`))
    .join("\n\n");
  const args = { prompt };
  if (model) args.model = model;
  if (responseJsonSchema) args.response_json_schema = responseJsonSchema;
  if (file_urls) args.file_urls = file_urls;
  if (add_context_from_internet) args.add_context_from_internet = true;
  const res = await ctx.base44.asServiceRole.integrations.Core.InvokeLLM(args);
  return res;
}

const STYLE_DIRECTIVES = {
  balanced: "Communicate in a balanced, clear, neutral tone — helpful and direct.",
  casual: "Communicate in a casual, warm, conversational tone — friendly and approachable, like a thoughtful peer.",
  technical: "Communicate in a precise, technical tone — exact terminology, structured and detail-oriented.",
  strategic: "Communicate in a strategic, executive tone — frame decisions, trade-offs, and implications at a high level."
};

export function styleDirective(style) {
  return style && STYLE_DIRECTIVES[style] ? `\n\nCOMMUNICATION STYLE: ${STYLE_DIRECTIVES[style]}` : '';
}

export function buildContextSystemPrompt(workspace, memories, classification, base = 'You are COGNOS, an intelligent AI reasoning assistant. You provide thoughtful, accurate, and helpful responses. Use markdown formatting when appropriate for clarity.', style = null) {
  let systemPrompt = withCharter(base);
  if (workspace?.instructions) {
    systemPrompt += `\n\nWORKSPACE INSTRUCTIONS:\n${workspace.instructions}`;
  }
  if (memories && memories.length > 0) {
    systemPrompt += `\n\nRELEVANT MEMORIES:\n${memories.map(m => `- ${m.content}`).join('\n')}`;
  }
  if (classification?.task_type && classification.task_type !== 'conversation') {
    systemPrompt += `\n\nTASK CONTEXT: The Observer classified this as "${classification.task_type}" (${classification.complexity || 'unknown'} complexity). Tailor your reasoning approach accordingly.`;
  }
  systemPrompt += styleDirective(style);
  return systemPrompt;
}