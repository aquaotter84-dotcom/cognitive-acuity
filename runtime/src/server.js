import http from "node:http";
import { runCouncil } from "./council.js";

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
      if (typeof input.userMessage !== "string" || !input.userMessage.trim()) {
        return sendJson(res, 400, { error: "userMessage is required" });
      }

      const result = await runCouncil({
        userMessage: input.userMessage,
        history: Array.isArray(input.history) ? input.history : [],
        memories: Array.isArray(input.memories) ? input.memories : [],
        workspace: input.workspace ?? null,
        style: input.style ?? null
      });

      return sendJson(res, 200, result);
    }

    return sendJson(res, 404, { error: "Not found" });
  } catch (error) {
    console.error(error);
    return sendJson(res, 500, { error: String(error?.message || error) });
  }
});

server.listen(port, () => {
  console.log(`Cognos runtime listening on :${port}`);
});
