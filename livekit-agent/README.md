# COGNOS Live Voice Agent

A thin real-time voice agent that keeps the seven-laws council as the brain.

```
Browser (LiveVoice.jsx)  ⇄  LiveKit Cloud (WebRTC)  ⇄  this Python agent
                                                          │
                                                          ▼
                                               chatOrchestrate (Base44)
                                               — the full Observer /
                                                 Strategist / Specialist /
                                                 Critic / Governor pipeline
```

The agent holds **no model of its own**. It runs STT (Deepgram) → calls
`chatOrchestrate` over HTTPS with an `X-Agent-Secret` → speaks the reply with
TTS (OpenAI). So the principled reasoning (truth, evidence, agency, dignity)
still governs every spoken response, exactly as in typed chat.

## Architecture split

| Piece | Lives in |
|---|---|
| `LiveVoice.jsx` + `livekit-client` | Base44 frontend |
| `createLiveVoiceToken` (mints LiveKit room token) | Base44 backend function |
| `chatOrchestrate` service-role branch (X-Agent-Secret) | Base44 backend |
| LiveKit Cloud (WebRTC SFU) | LiveKit Cloud (free tier) |
| **this agent** (STT/TTS + council relay) | Render / Fly.io / Railway / local |

## Prerequisites

1. A LiveKit Cloud project → copy its **URL**, **API key**, **API secret** into
   Base44 app secrets (`LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`).
2. A `COGNOS_AGENT_SECRET` — the same long random string set in Base44 app
   secrets and in this agent's `.env`.
3. The `chatOrchestrate` function URL (Base44 dashboard → code → functions →
   chatOrchestrate → API usage) as `COGNOS_CHAT_URL`.
4. A Deepgram key and an OpenAI key for STT/TTS.

## Run locally

```bash
cd livekit-agent
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # fill in
python agent.py dev   # local dev worker (LiveKit registers it on connect)
```

Open the COGNOS app, tap the **Live Voice** (radio) button in the chat header,
and speak. The browser joins the LiveKit room; this agent joins the same room,
transcribes your speech, routes it through the council, and speaks the reply.

## Deploy

Render / Fly.io / Railway: a single Python worker. Set the same env vars as
`.env.example`, then run `python agent.py start` as the service command. No
persistent storage needed.

## Notes

- **Latency:** the full council is multi-LLM (Observer → Strategist → … →
  Governor), which is seconds, not milliseconds. Live voice prioritizes a
  fluid feel; the adaptive gate already collapses simple turns to a fast path.
  If you want a sub-second live path, add a `live` complexity branch that
  short-circuits to a single Specialist + Governor (the council still
  governs, just fewer stages).
- **Conversation continuity:** the browser creates a Base44 `Conversation` on
  session start and forwards its id in the token metadata, so the agent's
  `chatOrchestrate` calls extend the same conversation as typed chat.