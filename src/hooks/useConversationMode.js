import { useState, useRef, useEffect, useCallback } from 'react';

// useConversationMode — continuous, hands-free voice conversation.
// State machine: listening -> processing -> speaking -> listening (loop).
// Reuses the shared chat engine via onUserTurn(text) (async -> assistant reply text).
// Recognition runs continuously while active; we only act on finalized phrases
// during the 'listening' phase (manual tap-to-interrupt handles barge-in, avoiding
// TTS echo false-triggers on speakers). Recognition auto-restarts if it drops.
export function useConversationMode({ onUserTurn }) {
  const [supported] = useState(() =>
    typeof window !== 'undefined' &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition) &&
    'speechSynthesis' in window
  );
  const [active, setActive] = useState(false);
  const [phase, setPhase] = useState('idle'); // 'idle' | 'listening' | 'processing' | 'speaking'
  const [interim, setInterim] = useState('');

  const recRef = useRef(null);
  const activeRef = useRef(false);
  const phaseRef = useRef('idle');
  const onUserTurnRef = useRef(onUserTurn);
  useEffect(() => { onUserTurnRef.current = onUserTurn; }, [onUserTurn]);

  const setP = useCallback((p) => { phaseRef.current = p; setPhase(p); }, []);

  // Send one user turn through the shared engine, then speak the reply.
  const sendTurn = useCallback(async (text) => {
    setP('processing');
    setInterim('');
    let response = null;
    try { response = await onUserTurnRef.current?.(text); } catch { response = null; }
    if (!activeRef.current) return;
    const reply = response ? String(response).trim() : '';
    if (!reply) { setP('listening'); return; }
    setP('speaking');
    try {
      try { window.speechSynthesis.cancel(); } catch {}
      const u = new SpeechSynthesisUtterance(reply);
      const done = () => { if (activeRef.current && phaseRef.current === 'speaking') setP('listening'); };
      u.onend = done;
      u.onerror = done;
      window.speechSynthesis.speak(u);
    } catch {
      setP('listening');
    }
  }, [setP]);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';
    rec.onresult = (e) => {
      if (!activeRef.current) return;
      let finalText = '';
      let interimText = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += t; else interimText += t;
      }
      if (interimText) setInterim(interimText);
      if (finalText) {
        setInterim('');
        const text = finalText.trim();
        if (text.length < 2) return;
        if (phaseRef.current !== 'listening') return; // ignore unless listening
        sendTurn(text);
      }
    };
    rec.onend = () => {
      if (activeRef.current && (phaseRef.current === 'listening' || phaseRef.current === 'idle')) {
        try { rec.start(); } catch {}
      }
    };
    rec.onerror = (e) => {
      if (!activeRef.current) return;
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') return; // mic denied — don't loop
      if (phaseRef.current === 'listening' || phaseRef.current === 'idle') {
        try { rec.start(); } catch {}
      }
    };
    recRef.current = rec;
    return () => { try { rec.abort(); } catch {} recRef.current = null; };
  }, [sendTurn]);

  const activate = useCallback(() => {
    if (!recRef.current) return;
    activeRef.current = true;
    setActive(true);
    setP('listening');
    try { recRef.current.start(); } catch {}
  }, [setP]);

  const deactivate = useCallback(() => {
    activeRef.current = false;
    setActive(false);
    try { window.speechSynthesis.cancel(); } catch {}
    try { recRef.current?.stop(); } catch {}
    setInterim('');
    setP('idle');
  }, [setP]);

  const interrupt = useCallback(() => {
    if (phaseRef.current === 'speaking') {
      try { window.speechSynthesis.cancel(); } catch {}
      setP('listening');
    }
  }, [setP]);

  return { supported, active, phase, interim, activate, deactivate, interrupt };
}