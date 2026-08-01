import { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Square, Mic, MicOff, Monitor, Camera, X, Loader2 } from 'lucide-react';
import { useSpeechRecognition } from '@/hooks/useVoice';
import { base44 } from '@/api/base44Client';
import { Image } from '@/components/ui/image';
import VisionCapture from '@/components/chat/VisionCapture';

export default function ChatInput({ onSend, disabled, isProcessing, onStop }) {
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [vision, setVision] = useState(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const { supported: micSupported, listening, interim, start, stop } = useSpeechRecognition({
    onFinal: (t) => setText(prev => (prev ? prev.trim() + ' ' : '') + t)
  });
  const displayText = listening && interim ? (text ? text + ' ' : '') + interim : text;

  const addAttachment = (a) => setAttachments(prev => [...prev, a]);
  const removeAttachment = (i) => setAttachments(prev => prev.filter((_, idx) => idx !== i));

  const handleFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setUploading(true);
    try {
      for (const file of files) {
        const res = await base44.integrations.Core.UploadFile({ file });
        if (res?.file_url) addAttachment({ name: file.name, file_url: res.file_url, file_type: file.type || 'file' });
      }
    } catch (e) { console.error(e); }
    setUploading(false);
  };

  const handleSend = () => {
    const trimmed = text.trim();
    if ((!trimmed && !attachments.length) || disabled) return;
    onSend(trimmed || '(attached media)', attachments);
    setText('');
    setAttachments([]);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
    }
  }, [text]);

  const isImage = (ft) => (ft || '').startsWith('image/');

  return (
    <div className="border-t border-border bg-background/95 backdrop-blur p-4">
      {attachments.length > 0 && (
        <div className="max-w-3xl mx-auto mb-2 flex flex-wrap gap-2">
          {attachments.map((a, i) => (
            <div key={i} className="relative group">
              {isImage(a.file_type) ? (
                <Image src={a.file_url} fittingType="fill" className="w-16 h-16 rounded-lg border border-border" alt={a.name} />
              ) : (
                <div className="w-16 h-16 rounded-lg border border-border bg-muted flex items-center justify-center text-[10px] text-center px-1 text-muted-foreground">{a.name}</div>
              )}
              <button onClick={() => removeAttachment(i)} className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="max-w-3xl mx-auto flex items-end gap-2 bg-card border border-border rounded-2xl p-2 focus-within:border-primary/50 transition-colors">
        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }} />
        <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="p-2 text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors" title="Attach files or images">
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
        </button>
        <button onClick={() => setVision('screen')} className="p-2 text-muted-foreground hover:text-foreground transition-colors" title="Share screen">
          <Monitor className="w-4 h-4" />
        </button>
        <button onClick={() => setVision('camera')} className="p-2 text-muted-foreground hover:text-foreground transition-colors" title="Live camera">
          <Camera className="w-4 h-4" />
        </button>
        {micSupported && (
          <button onClick={() => (listening ? stop() : start())} className={`p-2 rounded-xl transition-colors ${listening ? 'bg-destructive text-destructive-foreground animate-pulse' : 'text-muted-foreground hover:text-foreground'}`} title={listening ? 'Stop listening' : 'Speak'}>
            {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
        )}
        <textarea
          ref={textareaRef}
          value={displayText}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message COGNOS..."
          rows={1}
          className="flex-1 bg-transparent resize-none outline-none text-sm py-2 placeholder:text-muted-foreground/60 scrollbar-thin"
        />
        {isProcessing ? (
          <button onClick={onStop} className="p-2 rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors" title="Stop">
            <Square className="w-4 h-4" />
          </button>
        ) : (
          <button onClick={handleSend} disabled={disabled || (!text.trim() && !attachments.length)} className="p-2 rounded-xl bg-primary text-primary-foreground disabled:opacity-30 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors">
            <Send className="w-4 h-4" />
          </button>
        )}
      </div>
      {vision && (
        <VisionCapture mode={vision} onClose={() => setVision(null)} onAttach={(a) => { addAttachment(a); setVision(null); }} />
      )}
    </div>
  );
}