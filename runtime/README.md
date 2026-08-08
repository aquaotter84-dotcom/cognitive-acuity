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

- `PORT` optional, defaults to `3000`.
- `BLUESMINDS_API_KEY` will be required when the LLM adapter is connected.
- `BLUESMINDS_API_URL` optional, defaults to `https://api.bluesminds.com/v1/chat/completions`.
- `BLUESMINDS_MODEL` will select the default model when the adapter is connected.
