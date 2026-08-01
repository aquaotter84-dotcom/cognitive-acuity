import { Mic, Loader2, Volume2, PhoneOff } from 'lucide-react';

// ConversationOverlay — full-screen voice UI for hands-free conversation mode.
// Animated orb reflects the current phase; tap the orb while COGNOS is speaking
// to interrupt and take the floor. End button exits the mode.
export default function ConversationOverlay({ phase, interim, onInterrupt, onEnd }) {
  const label =
    phase === 'listening' ? 'Listening…' :
    phase === 'processing' ? 'Thinking…' :
    phase === 'speaking' ? 'Speaking…' : '';

  const orbClickable = phase === 'speaking';

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center animate-fade-in">
      <button
        onClick={orbClickable ? onInterrupt : undefined}
        disabled={!orbClickable}
        className="relative flex items-center justify-center mb-8 group"
        title={orbClickable ? 'Tap to interrupt' : undefined}
      >
        {phase === 'listening' && (
          <span className="absolute w-40 h-40 rounded-full bg-primary/20 animate-ping" />
        )}
        {phase === 'speaking' && (
          <span className="absolute w-44 h-44 rounded-full bg-accent/20 animate-pulse" />
        )}
        <span className="absolute w-32 h-32 rounded-full bg-gradient-to-br from-primary to-accent blur-xl opacity-50" />
        <span className="relative w-28 h-28 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-xl transition-transform group-hover:scale-105">
          {phase === 'processing' ? (
            <Loader2 className="w-10 h-10 text-white animate-spin" />
          ) : phase === 'speaking' ? (
            <Volume2 className="w-10 h-10 text-white" />
          ) : (
            <Mic className="w-10 h-10 text-white" />
          )}
        </span>
      </button>

      <p className="text-lg font-medium mb-3">{label}</p>

      {phase === 'listening' && interim && (
        <p className="text-sm text-muted-foreground max-w-md text-center mb-2 italic">"{interim}"</p>
      )}
      {phase === 'listening' && !interim && (
        <p className="text-xs text-muted-foreground mb-2">Speak when ready</p>
      )}
      {phase === 'speaking' && (
        <p className="text-xs text-muted-foreground mb-6">Tap the orb to interrupt</p>
      )}
      {phase === 'processing' && (
        <p className="text-xs text-muted-foreground mb-6">COGNOS is reasoning…</p>
      )}

      <button
        onClick={onEnd}
        className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
      >
        <PhoneOff className="w-4 h-4" /> End conversation
      </button>
    </div>
  );
}