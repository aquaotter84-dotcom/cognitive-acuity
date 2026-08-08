# Cognos External Runtime

This directory is a migration-safe runtime scaffold for moving Cognos cognitive execution outside Base44's integration-credit execution path.

## Current scope

- Does not modify the existing Base44 application.
- Does not connect to Base44 data yet.
- Does not contain or require any API key in source control.
- Provides `GET /health` for deployment checks.
- Provides a placeholder `POST /api/council` contract for the future external Council pipeline.

## Planned migration

1. Reuse the existing `base44/shared/` cognitive modules.
2. Replace Base44-specific secret/runtime dependencies with environment variables.
3. Keep direct BluesMinds HTTP calls through the existing LLM abstraction.
4. Accept conversation context over HTTP initially, avoiding a database migration.
5. Add authenticated Base44-to-runtime communication only after the standalone Council works.

## Environment

See `runtime/.env.example` for example variables. Key variables used by the runtime:

- `BLUESMINDS_API_KEY` — required. Your BluesMinds API key.
- `BLUESMINDS_MODEL` — required. Default model (e.g. `gpt_5_4`).
- `BLUESMINDS_API_URL` — optional. Defaults to `https://api.bluesminds.com/v1/chat/completions`.
- `COGNOS_RUNTIME_SECRET` — required. Random secret used to authenticate requests from Base44 or trusted clients.
- `PORT` — optional. Defaults to `3000`.

> Note: Do NOT commit real API keys to git. Use your host's secret manager (Vercel Environment Variables, AWS Secrets Manager, etc.).

## Quick start (local)

1. Install dependencies and start in dev:

```bash
cd runtime
npm install
npm run dev
```

2. Create a local `.env` file or export the variables in your shell based on `runtime/.env.example`.

3. Run the included test script (requires `COGNOS_RUNTIME_URL` and `COGNOS_RUNTIME_SECRET`):

```bash
export COGNOS_RUNTIME_URL=http://localhost:3000
export COGNOS_RUNTIME_SECRET=dev_secret
./runtime/test-llm-call.sh
```

If the runtime is configured with valid BluesMinds credentials, the script will print the JSON response returned from BluesMinds via the runtime's `/api/llm` endpoint.

## Base44 integration (how the bridge works)

- `base44/functions/externalLLM/entry.ts` is a Base44 function that authenticates Base44 users and forwards their requests to the external runtime.
- To enable Base44-to-runtime forwarding, set the following Base44 secrets (in your Base44 dashboard or `base44` secrets store):
  - `COGNOS_EXTERNAL_RUNTIME_URL` — the public URL of your deployed runtime (e.g. `https://cognos-runtime.example.com`).
  - `COGNOS_RUNTIME_SECRET` — the same secret you set for the runtime's `COGNOS_RUNTIME_SECRET` environment variable.

When those secrets are set, authenticated clients can call the Base44 function, which will proxy to your runtime without consuming Base44 LLM integration credits.

## Deployment tips

- Vercel: create a new project pointing at the `runtime/` directory or use the monorepo settings to set the root. Add environment variables to the Vercel project using the variable names above.
- Other hosts: ensure environment variables are set securely. Keep `COGNOS_RUNTIME_SECRET` and `BLUESMINDS_API_KEY` secret.

## Security & monitoring

- Do not expose `BLUESMINDS_API_KEY` to clients. Keep it server-side only.
- Monitor errors, latency, and any 429/limit responses from BluesMinds and implement exponential backoff if necessary.

## Files added in this PR

- `runtime/.env.example` — example environment variables.
- `runtime/test-llm-call.sh` — a simple test script to exercise `/api/llm`.
- small README additions documenting the .env and test script.
