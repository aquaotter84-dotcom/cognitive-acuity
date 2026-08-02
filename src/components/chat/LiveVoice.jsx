import { useState, useEffect, useRef } from 'react';
import { Room, RoomEvent, Track } from 'livekit-client';
import { base44 } from '@/api/base44Client';
import { PhoneOff, Mic, MicOff, Loader2, Radio, WifiOff, KeyRound } from 'lucide-react';

// Full-duplex live voice over LiveKit. The browser joins a LiveKit room (token
// from createLiveVoiceToken), publishes mic audio, and plays the remote agent's
// audio track. The agent process (livekit-agent/agent.py) runs STT -> the
// seven-laws council (chatOrchestrate) -> TTS. This component only handles
// audio I/O + the orb UI; reasoning stays server-side.

// Three distinct failure states, so the orb can tell "the server is
// unreachable" apart from "missing credentials" apart from "connected but the
// agent hasn't joined yet":
//   config_error  — token endpoint refused / secrets missing (fixable in-app)
//   unreachable   — WebSocket can't reach LiveKit (wrong URL / project not live)
//   waiting       — connected to LiveKit, waiting for the agent process to join
const STATUS = {
  connecting: { label: 'Connecting to COGNOS…', tone: 'idle' },
  waiting: { label: 'Connected — waiting for the agent to join…', tone: 'idle' },
  listening: { label: 'Listening — speak naturally', tone: 'live' },
  speaking: { label: 'COGNOS is speaking…', tone: 'speak' },
  muted: { label: 'Mic muted', tone: 'muted' },
  reconnecting: { label: 'Reconnecting…', tone: 'idle' },
  config_error: { label: 'LiveKit isn\'t configured', tone: 'error' },
  unreachable: { label: 'Can\'t reach the LiveKit server', tone: 'error' }
};

export default function LiveVoice({ workspaceId, conversationId, style, onEnd }) {
  const [status, setStatus] = useState('connecting');
  const [micOn, setMicOn] = useState(true);
  const [agentJoined, setAgentJoined] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [errorDetail, setErrorDetail] = useState('');
  const roomRef = useRef(null);
  const audioContainerRef = useRef(null);

  useEffect(() => {
    let disposed = false;
    let room;

    (async () => {
      let url, token;
      // 1. Mint a LiveKit token. Failure here means the app's LiveKit
      //    secrets aren't configured — surface that distinctly.
      try {
        const res = await base44.functions.invoke('createLiveVoiceToken', {
          workspaceId,
          conversationId,
          style
        });
        if (disposed) return;
        ({ url, token } = res.data || {});
        if (!url || !token) throw new Error('Token endpoint returned no url/token');
      } catch (e) {
        console.error('LiveVoice token failed:', e);
        if (disposed) return;
        setErrorDetail(e?.message || String(e));
        setStatus('config_error');
        return;
      }

      // 2. Open the WebSocket to LiveKit. Failure here (serverUnreachable)
      //    means the URL is wrong or the project isn't live/provisioned.
      try {
        room = new Room({ adaptiveStream: true, dynacast: true });
        roomRef.current = room;

        // Remote agent audio — attach the returned element and keep it hidden.
        room.on(RoomEvent.TrackSubscribed, (track) => {
          if (track.kind === Track.Kind.Audio) {
            const el = track.attach();
            el.style.display = 'none';
            audioContainerRef.current?.appendChild(el);
            setAgentJoined(true);
          }
        });
        room.on(RoomEvent.TrackUnsubscribed, (track) => {
          track.detach().forEach((el) => el.remove());
        });
        room.on(RoomEvent.ParticipantConnected, (p) => {
          if (p.sid !== room.localParticipant.sid) setAgentJoined(true);
        });
        room.on(RoomEvent.ParticipantDisconnected, (p) => {
          if (p.sid !== room.localParticipant.sid) setAgentJoined(false);
        });

        room.on(RoomEvent.ActiveSpeakerChanged, (speakers) => {
          const agentSpeaking = speakers.some((s) => s.sid !== room.localParticipant.sid);
          setStatus((prev) =>
            (prev === 'config_error' || prev === 'unreachable') ? prev : agentSpeaking ? 'speaking' : micOnRef.current ? 'listening' : 'muted'
          );
        });

        room.on(RoomEvent.DataReceived, (payload, participant) => {
          if (!participant || participant.sid === room.localParticipant.sid) return;
          try {
            const msg = JSON.parse(new TextDecoder().decode(payload));
            if (msg.type === 'transcript') setTranscript(msg.text);
            else if (msg.type === 'response') setTranscript(msg.text);
          } catch { /* ignore non-JSON */ }
        });

        room.on(RoomEvent.Reconnecting, () => !disposed && setStatus('reconnecting'));
        room.on(RoomEvent.Reconnected, () => !disposed && setStatus(micOnRef.current ? 'listening' : 'muted'));
        room.on(RoomEvent.Disconnected, () => { if (!disposed) setStatus('connecting'); });

        await room.connect(url, token);
        if (disposed) return;
        setStatus('waiting');

        try {
          await room.localParticipant.setMicrophoneEnabled(true);
          if (disposed) return;
          setMicOn(true);
          setStatus(agentJoined ? 'listening' : 'waiting');
        } catch {
          // Mic permission denied — user can still hear the agent; unmute later.
          setMicOn(false);
          setStatus(agentJoined ? 'muted' : 'waiting');
        }
      } catch (e) {
        console.error('LiveVoice connect failed:', e);
        if (disposed) return;
        const msg = e?.message || String(e);
        // Auth rejection (server reached but rejected the token) → config error,
        // not a network problem. True unreachability = DNS/timeout/connection.
        const authRejected = /invalid api key|unauthorized|401|forbidden|invalid token|signature/i.test(msg);
        const unreachable = !authRejected && /unreachable|ECONN|network|timeout|resolve|WebSocket|signal connection|handshake/i.test(msg);
        setErrorDetail(msg);
        setStatus(authRejected ? 'config_error' : unreachable ? 'unreachable' : 'config_error');
      }
    })();

    return () => {
      disposed = true;
      try { room?.disconnect(); } catch { /* ignore */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, conversationId, style]);

  // Keep a ref of micOn so the ActiveSpeaker handler reads the latest value.
  const micOnRef = useRef(micOn);
  useEffect(() => { micOnRef.current = micOn; }, [micOn]);

  const toggleMic = async () => {
    const room = roomRef.current;
    if (!room) return;
    const next = !micOn;
    try {
      await room.localParticipant.setMicrophoneEnabled(next);
      setMicOn(next);
      if (status !== 'speaking' && status !== 'config_error' && status !== 'unreachable') setStatus(next ? 'listening' : 'muted');
    } catch { /* permission denied again */ }
  };

  const endCall = () => {
    try { roomRef.current?.disconnect(); } catch { /* ignore */ }
    onEnd?.();
  };

  const meta = STATUS[status];
  const tone = meta.tone;
  const isSpeaking = status === 'speaking';
  const isError = status === 'config_error' || status === 'unreachable';
  const isConfigError = status === 'config_error';
  const isUnreachable = status === 'unreachable';

  const orbGradient =
    tone === 'speak' ? 'from-primary to-accent' :
    tone === 'live' ? 'from-primary to-primary/70' :
    tone === 'muted' ? 'from-muted-foreground/60 to-muted-foreground/40' :
    tone === 'error' ? 'from-destructive to-destructive/70' :
    'from-primary/80 to-accent/70';

  const glow =
    tone === 'speak' ? 'bg-primary/40' :
    tone === 'live' ? 'bg-primary/25' :
    tone === 'error' ? 'bg-destructive/30' :
    'bg-accent/20';

  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-background/95 backdrop-blur-md animate-fade-in">
      <div ref={audioContainerRef} className="hidden" />

      <div className="relative mb-10 flex items-center justify-center">
        {/* outer glow */}
        <div className={`absolute inset-0 rounded-full blur-3xl transition-opacity duration-700 ${glow} ${isSpeaking ? 'opacity-100' : 'opacity-60'}`} style={{ width: 220, height: 220 }} />
        {/* pulsing rings when speaking */}
        {isSpeaking && (
          <>
            <div className="absolute rounded-full border border-primary/30 animate-ping" style={{ width: 160, height: 160 }} />
            <div className="absolute rounded-full border border-primary/20 animate-ping" style={{ width: 200, height: 200, animationDelay: '0.4s' }} />
          </>
        )}
        {/* the orb */}
        <button
          onClick={toggleMic}
          className={`relative w-40 h-40 rounded-full bg-gradient-to-br ${orbGradient} flex items-center justify-center transition-all duration-500 ${isSpeaking ? 'scale-105 shadow-[0_0_60px_-10px] shadow-primary/60' : 'scale-100'} ${tone === 'idle' ? 'animate-pulse' : ''}`}
          title={micOn ? 'Tap to mute' : 'Tap to unmute'}
        >
          {status === 'connecting' || status === 'reconnecting' ? (
            <Loader2 className="w-12 h-12 text-white animate-spin" />
          ) : isError ? (
            isUnreachable ? (
              <WifiOff className="w-12 h-12 text-white" />
            ) : (
              <KeyRound className="w-12 h-12 text-white" />
            )
          ) : !micOn ? (
            <MicOff className="w-12 h-12 text-white" />
          ) : (
            <span className="text-4xl font-bold text-white font-heading">C</span>
          )}
        </button>
      </div>

      <div className="flex items-center gap-2 mb-1">
        <Radio className="w-4 h-4 text-primary" />
        <p className="text-lg font-medium text-foreground font-heading">Live Voice</p>
      </div>
      <p className="text-sm text-muted-foreground">{meta.label}</p>

      {transcript && (
        <p className="max-w-md text-center text-base text-foreground/80 italic mt-4 px-4 line-clamp-4">“{transcript}”</p>
      )}

      <div className="flex items-center gap-4 mt-10">
        {status !== 'connecting' && !isError && (
          <button
            onClick={toggleMic}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${micOn ? 'bg-secondary text-secondary-foreground hover:bg-secondary/80' : 'bg-muted text-muted-foreground'}`}
            title={micOn ? 'Mute microphone' : 'Unmute microphone'}
          >
            {micOn ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
          </button>
        )}
        <button
          onClick={endCall}
          className="w-14 h-14 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:bg-destructive/90 transition-colors"
          title="End live voice session"
        >
          <PhoneOff className="w-6 h-6" />
        </button>
      </div>

      {isConfigError && (
        <p className="mt-6 text-xs text-muted-foreground max-w-sm text-center">
          LiveKit credentials aren't set up yet. Set <code className="text-foreground">LIVEKIT_URL</code>, <code className="text-foreground">LIVEKIT_API_KEY</code> and <code className="text-foreground">LIVEKIT_API_SECRET</code>, then reopen Live Voice.
          {errorDetail && <span className="block mt-1 text-muted-foreground/70">Detail: {errorDetail}</span>}
        </p>
      )}
      {isUnreachable && (
        <div className="mt-6 text-xs text-muted-foreground max-w-sm text-center space-y-1">
          <p>The browser couldn't open a WebSocket to your LiveKit project. Check that the URL is correct and the project is active in your LiveKit Cloud dashboard.</p>
          {errorDetail && <p className="text-muted-foreground/70">Detail: {errorDetail}</p>}
        </div>
      )}
    </div>
  );
}