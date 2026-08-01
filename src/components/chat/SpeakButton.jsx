import { Volume2, Square } from 'lucide-react';
import { useSpeechSynthesis } from '@/hooks/useVoice';

// SpeakButton — read an assistant message aloud via the browser's TTS.
// Toggles play/stop. Hidden where speech synthesis is unsupported.
export default function SpeakButton({ text }) {
  const { supported, speaking, speak, cancel } = useSpeechSynthesis();
  if (!supported) return null;
  return (
    <button
      onClick={() => (speaking ? cancel() : speak(text))}
      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      title={speaking ? 'Stop reading' : 'Read aloud'}
    >
      {speaking ? <Square className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
    </button>
  );
}