import { useState, useEffect, useRef } from 'react';
import { X, Camera, Loader2, Move } from 'lucide-react';
import { base44 } from '@/api/base44Client';

// VisionCapture — live screen or camera preview with a "capture & attach" action.
// The preview panel is draggable by its header so you can reposition the video
// feed anywhere on screen (picture-in-picture style) while composing your message.
export default function VisionCapture({ mode, onClose, onAttach }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState(null);
  const [capturing, setCapturing] = useState(false);

  // Drag-to-move state
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef(null);

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

  // Center the panel on mount.
  useEffect(() => {
    const panelW = Math.min(672, window.innerWidth - 32);
    const panelH = Math.min(420, window.innerHeight - 32);
    setPos({
      x: Math.max(16, (window.innerWidth - panelW) / 2),
      y: Math.max(16, (window.innerHeight - panelH) / 2)
    });
  }, []);

  const onPointerDown = (e) => {
    setDragging(true);
    dragStart.current = { px: e.clientX, py: e.clientY, x: pos.x, y: pos.y };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!dragging || !dragStart.current) return;
    const dx = e.clientX - dragStart.current.px;
    const dy = e.clientY - dragStart.current.py;
    const panelW = Math.min(672, window.innerWidth - 32);
    const panelH = Math.min(420, window.innerHeight - 32);
    setPos({
      x: Math.min(window.innerWidth - 80, Math.max(16 - panelW + 80, dragStart.current.x + dx)),
      y: Math.min(window.innerHeight - 60, Math.max(16, dragStart.current.y + dy))
    });
  };
  const onPointerUp = () => { setDragging(false); dragStart.current = null; };

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
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur animate-fade-in" onClick={onClose}>
      <div
        className="fixed bg-card border border-border rounded-2xl p-4 w-full max-w-2xl shadow-2xl select-none"
        style={{ left: pos.x, top: pos.y, width: 'min(672px, calc(100vw - 32px))' }}
        onClick={e => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between mb-3 cursor-grab active:cursor-grabbing touch-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <h3 className="text-sm font-medium flex items-center gap-2">
            <Camera className="w-4 h-4 text-accent" /> {mode === 'screen' ? 'Share screen' : 'Live camera'}
            <span className="hidden sm:flex items-center gap-1 text-[10px] text-muted-foreground/70 ml-1">
              <Move className="w-3 h-3" /> drag to move
            </span>
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        {error ? (
          <div className="text-center py-10 text-sm text-destructive">{error}</div>
        ) : (
          <>
            <video ref={videoRef} autoPlay playsInline muted className="w-full rounded-lg bg-black aspect-video pointer-events-none" />
            <p className="text-xs text-muted-foreground mt-2">
              Live preview active. Drag the header to reposition. Capture a frame to attach it for the council to analyze.
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