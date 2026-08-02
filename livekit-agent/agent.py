# COGNOS Live Voice Agent
#
# Thin real-time voice agent: STT (Deepgram) -> reasoning via COGNOS chatOrchestrate
# (the seven-laws council, kept server-side in Base44) -> TTS (OpenAI). The agent
# holds NO model of its own — every utterance is routed to the council so the
# principles (truth, evidence, agency, dignity) still govern the response.
#
# Deploy: Render / Fly.io / Railway, or run locally for testing.
#   pip install -r requirements.txt
#   cp .env.example .env  # fill in values
#   python agent.py start
#
# The browser side (src/components/chat/LiveVoice.jsx) joins the same LiveKit room;
# this agent subscribes to the user's mic, transcribes, calls the council, and
# speaks the reply back. The orb UI + transcript come from data messages published
# here.

import os
import json
import httpx
from livekit.agents import (
    Agent,
    AgentSession,
    JobContext,
    WorkerOptions,
    AutoSubscribe,
    TurnHandlingOptions,
    cli,
    llm,
)
from livekit.plugins import deepgram, openai, silero
from livekit.plugins.turn_detector.multilingual import MultilingualModel

COGNOS_CHAT_URL = os.getenv("COGNOS_CHAT_URL", "")
AGENT_SECRET = os.getenv("COGNOS_AGENT_SECRET", "")


class CognosLLM(llm.LLM):
    """Defers all reasoning to COGNOS's chatOrchestrate (the seven-laws council).
    The agent only handles audio; the council stays the brain."""

    def __init__(self, room, workspace_id, conversation_id, style, user_id):
        super().__init__()
        self.room = room
        self.workspace_id = workspace_id
        self.conversation_id = conversation_id
        self.style = style
        self.user_id = user_id

    async def chat(self, *, chat_ctx, tools=None, **kwargs):
        # Pull the most recent user text from the chat context.
        user_text = ""
        for item in reversed(chat_ctx.items):
            if getattr(item, "role", None) == "user":
                content = getattr(item, "content", "")
                if isinstance(content, list):
                    user_text = "".join(str(c) for c in content)
                else:
                    user_text = str(content)
                break
        user_text = user_text.strip()
        if not user_text:
            return

        await self._publish("transcript", user_text)

        try:
            response_text = await self._call_cognos(user_text)
        except Exception as e:  # surface the failure to the user, don't crash
            response_text = f"I hit an error reaching my reasoning core: {e}"

        await self._publish("response", response_text)

        yield llm.ChatChunk(delta=llm.ChatDelta(content=response_text, role="assistant"))

    async def _call_cognos(self, text):
        async with httpx.AsyncClient(timeout=120) as client:
            payload = {
                "conversationId": self.conversation_id,
                "workspaceId": self.workspace_id,
                "userMessage": text,
                "style": self.style,
                "attachments": [],
                "webSearch": False,
                "userId": self.user_id,
            }
            r = await client.post(
                COGNOS_CHAT_URL,
                json=payload,
                headers={"X-Agent-Secret": AGENT_SECRET, "Content-Type": "application/json"},
            )
            r.raise_for_status()
            return r.json().get("response", "")

    async def _publish(self, msg_type, text):
        try:
            data = json.dumps({"type": msg_type, "text": text}).encode()
            await self.room.local_participant.publish_data(data, reliable=True)
        except Exception:
            pass


async def entrypoint(ctx: JobContext):
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)
    room = ctx.room

    # The browser (createLiveVoiceToken) packs session context into the user
    # participant's metadata. Read it on connect.
    meta = {}
    for p in room.remote_participants.values():
        if p.metadata:
            try:
                meta = json.loads(p.metadata)
                break
            except Exception:
                pass

    session = AgentSession(
        vad=silero.VAD.load(),
        stt=deepgram.STT(model="nova-3"),
        llm=CognosLLM(
            room=room,
            workspace_id=meta.get("workspaceId"),
            conversation_id=meta.get("conversationId"),
            style=meta.get("style", "balanced"),
            user_id=meta.get("userId"),
        ),
        tts=openai.TTS(voice="alloy"),
        # Use LiveKit's multilingual end-of-turn detector instead of the
        # model's built-in one — better for natural conversation flow. The
        # council (CognosLLM -> chatOrchestrate) stays the brain.
        turn_handling=TurnHandlingOptions(
            turn_detection=MultilingualModel(),
        ),
    )

    await session.start(
        room=room,
        agent=Agent(
            instructions=(
                "You are COGNOS, a principled reasoning assistant. Your reasoning is "
                "handled by an external council; you only relay spoken conversation. "
                "Be concise and natural in speech."
            )
        ),
    )


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_func=entrypoint))