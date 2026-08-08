import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';

async function handle(req: Request) {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return Response.json({ error: "messages is required" }, { status: 400 });
  }

  const runtimeUrl = secrets.get('COGNOS_EXTERNAL_RUNTIME_URL');
  const runtimeSecret = secrets.get('COGNOS_RUNTIME_SECRET');
  if (!runtimeUrl) {
    return Response.json({ error: "COGNOS_EXTERNAL_RUNTIME_URL is not configured" }, { status: 500 });
  }

  const endpoint = `${runtimeUrl.replace(/\/$/, '')}/api/llm`;
  const upstream = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(runtimeSecret ? { 'X-Cognos-Runtime-Secret': runtimeSecret } : {})
    },
    body: JSON.stringify({
      model: body.model,
      messages: body.messages,
      file_urls: body.file_urls,
      responseJsonSchema: body.responseJsonSchema
    })
  });

  const text = await upstream.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { error: text }; }
  return Response.json(data, { status: upstream.status });
}

export default handle;
