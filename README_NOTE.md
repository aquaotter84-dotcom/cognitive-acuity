# OpenAI integration (proxy)

This folder contains a small serverless proxy and a client helper to call the OpenAI API without exposing your API key to the browser.

Files added in this branch:
- api/openai.js — serverless API handler. POST { prompt, model?, max_tokens? } -> returns { output, raw }
- src/utils/openaiClient.js — small frontend helper that calls the proxy
- .env.example — local env example
- docs/OPENAI.md — integration and deployment notes

Important: Do NOT commit your OpenAI API key. Add it to your Base44 project secrets as `OPENAI_API_KEY`.
