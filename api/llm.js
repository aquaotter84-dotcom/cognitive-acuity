const ALLOWED_METHODS = new Set(["POST"]);

function json(res, status, body) {
  res.status(status).json(body);
}

function buildMessages(messages, fileUrls) {
  const normalized = Array.isArray(messages) ? messages.map((m) => ({ ...m })) : [];
  if (!fileUrls?.length) return normalized;

  const imageParts = fileUrls.map((url) => ({
    type: "image_url",
    image_url: { url }
  }));

  let index = normalized.length - 1;
  while (index >= 0 && normalized[index]?.role !== "user") index -= 1;

  if (index < 0) {
    normalized.push({ role: "user", content: imageParts });
    return normalized;
  }

  const current = normalized[index];
  const text = typeof current.content === "string"
    ? [{ type: "text", text: current.content }]
    : Array.isArray(current.content) ? current.content : [];

  normalized[index] = {
    ...current,
    content: [...text, ...imageParts]
  };
  return normalized;
}

export default async function handler(req, res) {
  if (!ALLOWED_METHODS.has(req.method)) {
    res.setHeader("Allow", "POST");
    return json(res, 405, { error: "Method not allowed" });
  }

  const runtimeSecret = process.env.COGNOS_RUNTIME_SECRET;
  if (runtimeSecret) {
    const supplied = req.headers["x-cognos-runtime-secret"];
    if (supplied !== runtimeSecret) {
      return json(res, 401, { error: "Unauthorized" });
    }
  }

  const apiKey = process.env.BLUESMINDS_API_KEY;
  const apiUrl = process.env.BLUESMINDS_API_URL || "https://api.bluesminds.com/v1/chat/completions";
  const model = process.env.BLUESMINDS_MODEL;

  if (!apiKey || !model) {
    return json(res, 500, { error: "BluesMinds runtime is not configured" });
  }

  const body = req.body || {};
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return json(res, 400, { error: "messages is required" });
  }

  const payload = {
    model: body.model || model,
    messages: buildMessages(body.messages, body.file_urls),
    ...(body.responseJsonSchema
      ? {
          response_format: {
            type: "json_schema",
            json_schema: body.responseJsonSchema
          }
        }
      : {})
  };

  try {
    const upstream = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const text = await upstream.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return json(res, 502, { error: `BluesMinds returned invalid JSON (${upstream.status})` });
    }

    return json(res, upstream.status, data);
  } catch (error) {
    console.error("BluesMinds runtime request failed", error);
    return json(res, 502, { error: "Upstream LLM request failed" });
  }
}
