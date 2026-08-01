import { useState, useEffect, useRef } from 'react';
import { X, Camera, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

// VisionCapture — live screen or camera preview with a "capture & attach" action.
// Uses getDisplayMedia (screen) or getUserMedia (camera), draws the current frame
// to a canvas, uploads it via UploadFile, and hands the file_url back as an image
// attachment. The live <video> gives the user real "share screen" / "live camera"
// access; capture turns a frame into something the council can actually see.
export default function VisionCapture({ mode, onClose, onAttach }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState(null);
  const [capturing, setCapturing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = mode === 'screen'
          ? await navigator.mediaDevices.getDisplayMedia({ video: true })
          : await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (e) {
        setError(e.message || (mode === 'screen' ? 'Screen share denied' : 'Camera access denied'));
      }
    })();
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, [mode]);

  const capture = async () => {
    setCapturing(true);
    try {
      const v = videoRef.current;
      if (!v || !v.videoWidth) return;
      const canvas = document.createElement('canvas');
      canvas.width = v.videoWidth;
      canvas.height = v.videoHeight;
      canvas.getContext('2d').drawImage(v, 0, 0);
      const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
      if (!blob) return;
      const file = new File([blob], `${mode}-capture-${Date.now()}.png`, { type: 'image/png' });
      const res = await base44.integrations.Core.UploadFile({ file });
      if (res?.file_url) onAttach({ name: file.name, file_url: res.file_url, file_type: 'image/png' });
    } catch (e) {
      console.error(e);
    }
    setCapturing(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl p-4 max-w-2xl w-full" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <Camera className="w-4 h-4 text-accent" /> {mode === 'screen' ? 'Share screen' : 'Live camera'}
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        {error ? (
          <div className="text-center py-10 text-sm text-destructive">{error}</div>
        ) : (
          <>
            <video ref={videoRef} autoPlay playsInline muted className="w-full rounded-lg bg-black aspect-video" />
            <p className="text-xs text-muted-foreground mt-2">
              Live preview active. Capture a frame to attach it for the council to analyze.
            </p>
            <div className="flex justify-end gap-2 mt-3">
              <button onClick={onClose} className="px-3 py-2 rounded-lg text-sm hover:bg-muted transition-colors">Cancel</button>
              <button onClick={capture} disabled={capturing} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm flex items-center gap-1.5 disabled:opacity-50 transition-colors hover:bg-primary/90">
                {capturing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                {capturing ? 'Capturing…' : 'Capture & attach'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}