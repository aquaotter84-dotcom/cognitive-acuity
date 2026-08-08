import http from "node:http";

const port = Number(process.env.PORT || 3000);

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  let body = "";
  for await (const chunk of req) body += chunk;
  if (!body) return {};
  return JSON.parse(body);
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/health") {
      return sendJson(res, 200, { status: "ok", service: "cognos-runtime" });
    }

    if (req.method === "POST" && req.url === "/api/council") {
      const input = await readJson(req);

      return sendJson(res, 501, {
        error: "Council runtime not wired yet",
        next: "Connect the existing COGNOS shared/council pipeline without modifying the Base44 implementation.",
        received: {
          hasUserMessage: typeof input.userMessage === "string",
          historyCount: Array.isArray(input.history) ? input.history.length : 0,
          memoryCount: Array.isArray(input.memories) ? input.memories.length : 0
        }
      });
    }

    return sendJson(res, 404, { error: "Not found" });
  } catch (error) {
    return sendJson(res, 400, { error: String(error?.message || error) });
  }
});

server.listen(port, () => {
  console.log(`Cognos runtime listening on :${port}`);
});
