import { useState, useRef } from 'react';
import { Paperclip, Mic, Square, Monitor, Camera, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import VisionCapture from '@/components/chat/VisionCapture';
import { categorizeFile } from '@/lib/documentAnalysis';

export default function DocumentUploader({ onInput }) {
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [vision, setVision] = useState(null);
  const fileInputRef = useRef(null);
  const mediaRef = useRef(null);
  const chunksRef = useRef([]);

  const uploadFile = async (file, source, fallbackType) => {
    const res = await base44.integrations.Core.UploadFile({ file });
    onInput({
      file_url: res?.file_url,
      name: file.name || `recording-${Date.now()}.webm`,
      source,
      file_type: categorizeFile(file.name, file.type) || fallbackType,
      mime_type: file.type || '',
      size: file.size || 0
    });
  };

  const handleFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setUploading(true);
    try {
      for (const file of files) await uploadFile(file, 'upload', 'document');
    } catch (e) { console.error(e); }
    setUploading(false);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const file = new File([blob], `recording-${Date.now()}.webm`, { type: 'audio/webm' });
        setRecording(false);
        setUploading(true);
        try { await uploadFile(file, 'audio', 'audio'); } catch (e) { console.error(e); }
        setUploading(false);
      };
      mediaRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch (e) {
      console.error('Mic access failed:', e);
      setRecording(false);
    }
  };

  const stopRecording = () => mediaRef.current?.stop();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }} />
      <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50">
        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
        <span className="text-sm font-medium">Upload file</span>
      </button>
      <button onClick={recording ? stopRecording : startRecording} disabled={uploading} className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors disabled:opacity-50 ${recording ? 'bg-destructive text-destructive-foreground animate-pulse' : 'bg-muted hover:bg-muted/70 text-foreground'}`}>
        {recording ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        <span className="text-sm font-medium">{recording ? 'Stop' : 'Record audio'}</span>
      </button>
      <button onClick={() => setVision('camera')} disabled={uploading} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted hover:bg-muted/70 text-foreground transition-colors disabled:opacity-50">
        <Camera className="w-4 h-4" />
        <span className="text-sm font-medium">Camera</span>
      </button>
      <button onClick={() => setVision('screen')} disabled={uploading} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted hover:bg-muted/70 text-foreground transition-colors disabled:opacity-50">
        <Monitor className="w-4 h-4" />
        <span className="text-sm font-medium">Screen</span>
      </button>
      {vision && (
        <VisionCapture
          mode={vision}
          onClose={() => setVision(null)}
          onAttach={(a) => { onInput({ file_url: a.file_url, name: a.name, source: vision, file_type: a.file_type || 'image', mime_type: a.file_type || 'image/jpeg', size: 0 }); setVision(null); }}
        />
      )}
    </div>
  );
}