import { createClientFromRequest } from "@base44/sdk";

const BLUESMINDS_API_URL = process.env.BLUESMINDS_API_URL || "https://api.bluesminds.com/v1/chat/completions";
const BLUESMINDS_MODEL = process.env.BLUESMINDS_MODEL;
const BLUESMINDS_API_KEY = process.env.BLUESMINDS_API_KEY;

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export default async function handler(req) {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  if (!BLUESMINDS_API_KEY) {
    return jsonResponse({ error: "BluesMinds API key is not configured" }, 500);
  }

  if (!BLUESMINDS_MODEL) {
    return jsonResponse({ error: "BluesMinds model is not configured" }, 500);
  }

  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { messages, temperature, max_tokens, response_format } = body || {};

    if (!Array.isArray(messages) || messages.length === 0) {
      return jsonResponse({ error: "messages must be a non-empty array" }, 400);
    }

    const upstream = await fetch(BLUESMINDS_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${BLUESMINDS_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: BLUESMINDS_MODEL,
        messages,
        ...(temperature !== undefined ? { temperature } : {}),
        ...(max_tokens !== undefined ? { max_tokens } : {}),
        ...(response_format !== undefined ? { response_format } : {}),
      }),
    });

    const text = await upstream.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text || "BluesMinds returned a non-JSON response" };
    }

    if (!upstream.ok) {
      return jsonResponse(
        { error: "BluesMinds request failed", upstream_status: upstream.status, details: data },
        upstream.status
      );
    }

    return jsonResponse(data, 200);
  } catch (error) {
    return jsonResponse({ error: error?.message || "Unexpected BluesMinds gateway error" }, 500);
  }
}
