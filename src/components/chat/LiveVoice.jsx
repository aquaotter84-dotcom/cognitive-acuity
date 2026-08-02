import { useState, useEffect, useRef } from 'react';
import { Room, RoomEvent, Track, ConnectionState } from 'livekit-client';
import { base44 } from '@/api/base44Client';
import { PhoneOff, Mic, MicOff, Loader2, AlertCircle } from 'lucide-react';

// Full-duplex live voice session over LiveKit. The browser joins a LiveKit
// room (token minted by createLiveVoiceToken), publishes mic audio, and plays
// the remote agent's audio track. The agent process (external, see
// livekit-agent/) runs STT -> chatOrchestrate (the seven-laws council) -> TTS.
// This component only handles audio I/O + the live orb UI; reasoning stays
// server-side in the council.

export default function LiveVoice({ workspaceId, conversationId, style, onEnd }) {
  const [status, setStatus] = useState('connecting'); // connecting | connected | error
  const [micOn, setMicOn] = useState(true);
  const [agentSpeaking, setAgentSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const roomRef = useRef(null);
  const audioRef = useRef(null);

  useEffect(() => {
    let disposed = false;
    let room;

    (async () => {
      try {
        const res = await base44.functions.invoke('createLiveVoiceToken', {
          workspaceId,
          conversationId,
          style
        });
        const { url, token } = res.data;
        if (disposed) return;

        room = new Room({ adaptiveStream: true, dynacast: true });
        roomRef.current = room;

        room.on(RoomEvent.TrackSubscribed, (track) => {
          if (track.kind === Track.Kind.Audio) {
            const el = track.attach();
            el.autoplay = true;
            if (audioRef.current) audioRef.current.srcObject = el.srcObject;
          }
        });
        room.on(RoomEvent.TrackUnsubscribed, (track) => track.detach());

        room.on(RoomEvent.ActiveSpeakerChanged, (speakers) => {
          const agentSpeakingNow = speakers.some((s) => s.sid !== room.localParticipant.sid);
          setAgentSpeaking(agentSpeakingNow);
        });

        room.on(RoomEvent.DataReceived, (payload, participant) => {
          if (participant?.sid === room.localParticipant.sid) return;
          try {
            const msg = JSON.parse(new TextDecoder().decode(payload));
            if (msg.type === 'transcript') setTranscript(msg.text);
            if (msg.type === 'response') setTranscript(msg.text);
          } catch { /* ignore non-JSON */ }
        });

        room.on(RoomEvent.Disconnected, () => {
          if (!disposed) setStatus('connecting');
        });

        await room.connect(url, token);
        if (disposed) return;
        await room.localParticipant.setMicrophoneEnabled(true);
        if (disposed) return;
        setStatus('connected');
      } catch (e) {
        console.error('LiveVoice connect failed:', e);
        if (!disposed) setStatus('error');
      }
    })();

    return () => {
      disposed = true;
      try { room?.disconnect(); } catch { /* ignore */ }
    };
  }, [workspaceId, conversationId, style]);

  const toggleMic = async () => {
    const room = roomRef.current;
    if (!room) return;
    const next = !micOn;
    await room.localParticipant.setMicrophoneEnabled(next);
    setMicOn(next);
  };

  const endCall = () => {
    try { roomRef.current?.disconnect(); } catch { /* ignore */ }
    onEnd?.();
  };

  const orbPulse = status === 'connected' && agentSpeaking;
  const phaseLabel =
    status === 'connecting' ? 'Connecting to COGNOS…' :
    status === 'error' ? 'Connection failed' :
    agentSpeaking ? 'COGNOS is speaking…' :
    micOn ? 'Listening — speak naturally' : 'Mic muted';

  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-background/95 backdrop-blur-md">
      <audio ref={audioRef} autoPlay className="hidden" />

      <div className="relative mb-10">
        <div className={`absolute inset-0 rounded-full blur-2xl transition-opacity duration-500 ${orbPulse ? 'bg-primary/40 opacity-100' : 'bg-accent/20 opacity-60'}`} />
        <div className={`relative w-40 h-40 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center transition-transform duration-300 ${orbPulse ? 'scale-105' : 'scale-100'}`}>
          <div className={`absolute inset-0 rounded-full border-2 border-primary/40 ${orbPulse ? 'animate-ping' : ''}`} />
          {status === 'connecting' ? (
            <Loader2 className="w-12 h-12 text-white animate-spin" />
          ) : status === 'error' ? (
            <AlertCircle className="w-12 h-12 text-white" />
          ) : (
            <span className="text-3xl font-bold text-white font-heading">C</span>
          )}
        </div>
      </div>

      <p className="text-lg font-medium text-foreground mb-1 font-heading">Live Voice</p>
      <p className="text-sm text-muted-foreground mb-1">{phaseLabel}</p>
      {transcript && (
        <p className="max-w-md text-center text-sm text-foreground/80 italic mt-3 px-4 line-clamp-3">“{transcript}”</p>
      )}

      <div className="flex items-center gap-4 mt-10">
        {status === 'connected' && (
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

      {status === 'error' && (
        <p className="mt-6 text-xs text-muted-foreground max-w-sm text-center">
          Check that your LiveKit credentials are set and that the LiveKit agent process is running.
        </p>
      )}
    </div>
  );
}