export async function callLLM({ messages, responseJsonSchema = null, model = null }) {
  const apiKey = process.env.BLUESMINDS_API_KEY;
  const apiUrl = process.env.BLUESMINDS_API_URL || "https://api.bluesminds.com/v1/chat/completions";
  const selectedModel = model || process.env.BLUESMINDS_MODEL || "gpt_5_4";

  if (!apiKey) throw new Error("BLUESMINDS_API_KEY is not configured");

  const payload = {
    model: selectedModel,
    messages,
    ...(responseJsonSchema ? { response_format: { type: "json_schema", json_schema: responseJsonSchema } } : {})
  };

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`BluesMinds returned invalid JSON (${response.status})`);
  }

  if (!response.ok) {
    throw new Error(`BluesMinds request failed (${response.status}): ${data?.error?.message || data?.error || "Unknown error"}`);
  }

  const content = data?.choices?.[0]?.message?.content ?? "";
  if (!responseJsonSchema) return content;
  if (typeof content !== "string") return content;

  try {
    return JSON.parse(content);
  } catch {
    throw new Error("BluesMinds returned JSON-schema content that could not be parsed");
  }
}

export function styleDirective(style) {
  if (!style) return "";
  return `\n\nStyle directive: ${style}`;
}

export function buildContextSystemPrompt(workspace, memories, classification) {
  const memoryText = (memories || []).map(m => `- ${m.content ?? m}`).join("\n") || "(none)";
  const workspaceText = workspace ? JSON.stringify(workspace) : "(none)";
  return `You are COGNOS, a council-based cognitive assistant. Be accurate, grounded, useful, and transparent about uncertainty.\n\nWorkspace context:\n${workspaceText}\n\nRelevant memories:\n${memoryText}\n\nTask classification:\n${JSON.stringify(classification || {})}`;
}
