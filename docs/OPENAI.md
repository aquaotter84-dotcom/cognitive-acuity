# OpenAI Proxy — Setup & Usage

## Where to store the key
- In Base44 dashboard: open your project, go to Settings → Secrets (or Environment / Secrets) and add a secret named `OPENAI_API_KEY` with your OpenAI key.
- For local development only, copy `.env.example` to `.env` and add your key (do not commit `.env`).

## Deploy
This handler is written as a serverless function (default export). On Base44, Vercel, or Netlify it should be callable at `/api/openai` after deployment.

## How to call (frontend)
Use the helper in `src/utils/openaiClient.js` or call `/api/openai` directly with a JSON POST body:

POST /api/openai
Body: { "prompt": "...", "model": "gpt-4o-mini", "max_tokens": 300 }

Response: { "output": "...", "raw": {...} }

## Security recommendations
- Never commit `OPENAI_API_KEY` to source control.
- Restrict who can edit project secrets in the Base44 dashboard.
- Add server-side input validation, quota checks, and rate-limiting.
- Mask or redact PII from logs and stored records.
- Rotate keys periodically and monitor usage.

## Local testing
You can run a tiny local server during development that mounts this handler. Example using Express (local dev only):

1. Install dependencies: `npm install express dotenv`
2. Create `local-server.js`:

```js
import express from 'express';
import handler from './api/openai.js';
import dotenv from 'dotenv';

dotenv.config();
const app = express();
app.use(express.json());
app.post('/api/openai', (req, res) => handler(req, res));
app.listen(3000, () => console.log('Local proxy listening on http://localhost:3000'));
```

3. `cp .env.example .env` and add `OPENAI_API_KEY` for local testing only.
4. Run: `node --experimental-specifier-resolution=node local-server.js`

Do NOT use the real key in CI or public logs.
