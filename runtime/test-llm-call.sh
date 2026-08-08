#!/usr/bin/env bash
set -euo pipefail

# Test script for the Cognos external runtime LLM endpoint.
# Requires COGNOS_RUNTIME_URL and COGNOS_RUNTIME_SECRET environment variables.
# Optional: jq for pretty JSON output.

if [ -z "${COGNOS_RUNTIME_URL:-}" ] || [ -z "${COGNOS_RUNTIME_SECRET:-}" ]; then
  echo "Please set COGNOS_RUNTIME_URL and COGNOS_RUNTIME_SECRET"
  echo "Example: export COGNOS_RUNTIME_URL=https://cognos-runtime.example.com"
  echo "         export COGNOS_RUNTIME_SECRET=your_secret"
  exit 1
fi

PAYLOAD=$(cat <<'JSON'
{
  "messages": [{"role": "user", "content": "Hello from Cognos runtime test"}],
  "model": "gpt_5_4"
}
JSON
)

curl -sS -X POST "${COGNOS_RUNTIME_URL%/}/api/llm" \
  -H "Content-Type: application/json" \
  -H "X-Cognos-Runtime-Secret: ${COGNOS_RUNTIME_SECRET}" \
  -d "$PAYLOAD" | (command -v jq >/dev/null 2>&1 && jq . || cat)
