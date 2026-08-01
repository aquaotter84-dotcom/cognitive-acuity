// Shared LLM utilities — routes model calls through Base44's built-in InvokeLLM
// integration (platform-managed key), so the app needs no external API key or credits.
// Used by the council operators and the memory stage.
//
// InvokeLLM takes a single prompt string (not a message array), so chat messages are
// flattened. When responseJsonSchema is provided, InvokeLLM returns a parsed object;
// otherwise it returns a string.

export async function callLLM(ctx, { messages, responseJsonSchema = null, model = null }) {
  const prompt = messages
    .map(m => (m.role === "system" ? m.content : `${m.role === "assistant" ? "Assistant" : "User"}: ${m.content}`))
    .join("\n\n");
  const args = { prompt };
  if (model) args.model = model;
  if (responseJsonSchema) args.response_json_schema = responseJsonSchema;
  const res = await ctx.base44.asServiceRole.integrations.Core.InvokeLLM(args);
  return res;
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