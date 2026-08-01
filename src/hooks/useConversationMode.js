import { useState, useRef, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

// useConversationMode — continuous, hands-free voice conversation.
// State machine: listening -> processing -> speaking -> listening (loop).
// Reuses the shared chat engine via onUserTurn(text) (async -> assistant reply text).
//
// Natural conversation feel:
//  - The assistant's voice comes from the server-side GenerateSpeech
//    integration (natural multilingual voices) instead of the robotic
//    browser SpeechSynthesis, falling back only if the integration fails.
//  - A brief filler ("Hmm.") is spoken the instant a turn is accepted, so
//    the user hears an acknowledgment instead of dead air while the council
//    reasons.
//  - The user can interrupt by voice: recognition stays live during the
//    speaking phase, and a finalized phrase that isn't an echo of the
//    reply being spoken cuts off the audio and starts a new turn. A phrase
//    spoken during processing is queued and takes over once reasoning
//    finishes (the in-flight reply is discarded).
// Recognition runs continuously while active and auto-restarts if it drops.
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
  const replyRef = useRef('');         // text currently being spoken (echo guard)
  const pendingTurnRef = useRef(null); // user spoke during processing/speaking
  const audioRef = useRef(null);       // <audio> element for natural-voice reply
  const sendTurnRef = useRef(null);    // breaks the speakReply -> sendTurn cycle

  useEffect(() => { onUserTurnRef.current = onUserTurn; }, [onUserTurn]);

  // Hidden audio element for server-generated speech.
  useEffect(() => {
    const a = new Audio();
    audioRef.current = a;
    return () => { try { a.pause(); } catch {} audioRef.current = null; };
  }, []);

  const setP = useCallback((p) => { phaseRef.current = p; setPhase(p); }, []);

  const stopSpeaking = useCallback(() => {
    try { window.speechSynthesis.cancel(); } catch {}
    const a = audioRef.current;
    if (a) { try { a.pause(); a.onended = null; a.onerror = null; } catch {} }
    replyRef.current = '';
  }, []);

  // Short, low-volume acknowledgment spoken the moment a turn is accepted,
  // filling the reasoning gap. Kept under the barge-in length threshold and
  // free of long phrases so the mic can't mis-transcribe it into a queued turn.
  const FILLERS = ['Hmm.', 'Mm.', 'Hm.'];
  const speakFiller = useCallback(() => {
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(FILLERS[Math.floor(Math.random() * FILLERS.length)]);
      u.rate = 1.05; u.volume = 0.45;
      window.speechSynthesis.speak(u);
    } catch {}
  }, []);

  const speakReply = useCallback((reply) => {
    replyRef.current = reply;
    setP('speaking');
    try { window.speechSynthesis.cancel(); } catch {} // stop any lingering filler
    const text = reply.slice(0, 4900); // GenerateSpeech caps at 5000 chars

    const after = () => {
      replyRef.current = '';
      if (!activeRef.current) return;
      if (pendingTurnRef.current) {
        const p = pendingTurnRef.current; pendingTurnRef.current = null;
        sendTurnRef.current?.(p);
      } else if (phaseRef.current === 'speaking') {
        setP('listening');
      }
    };
    const fallback = () => {
      try {
        const u = new SpeechSynthesisUtterance(text);
        u.onend = after; u.onerror = after;
        window.speechSynthesis.speak(u);
      } catch { after(); }
    };

    base44.integrations.Core.GenerateSpeech({ text, voice: 'river' })
      .then(({ url }) => {
        if (!activeRef.current || phaseRef.current !== 'speaking') return;
        const a = audioRef.current;
        if (!a) { fallback(); return; }
        a.src = url;
        a.onended = after;
        a.onerror = after;
        a.play().catch(fallback);
      })
      .catch(fallback);
  }, [setP]);

  const sendTurn = useCallback(async (text) => {
    setP('processing');
    setInterim('');
    speakFiller();
    let response = null;
    try { response = await onUserTurnRef.current?.(text); } catch { response = null; }
    try { window.speechSynthesis.cancel(); } catch {} // filler no longer needed
    if (!activeRef.current) return;
    // The user spoke while we were thinking — discard this reply and pivot.
    if (pendingTurnRef.current) {
      const p = pendingTurnRef.current; pendingTurnRef.current = null;
      sendTurnRef.current?.(p);
      return;
    }
    const reply = response ? String(response).trim() : '';
    if (!reply) { setP('listening'); return; }
    speakReply(reply);
  }, [setP, speakFiller, speakReply]);

  useEffect(() => { sendTurnRef.current = sendTurn; }, [sendTurn]);

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
        const r = e.results[i];
        const t = r[0].transcript;
        if (r.isFinal) finalText += t; else interimText += t;
      }
      if (interimText) setInterim(interimText);
      if (finalText) {
        setInterim('');
        const text = finalText.trim();
        if (text.length < 3) return;
        const ph = phaseRef.current;
        if (ph === 'listening') {
          sendTurn(text);
        } else if (ph === 'speaking') {
          // Voice barge-in: a real phrase (not an echo of our own voice) cuts
          // off the reply and starts a new turn.
          if (text.length < 5) return;
          if (isEcho(text, replyRef.current)) return;
          stopSpeaking();
          sendTurn(text);
        } else if (ph === 'processing') {
          // Queue the interruption; we can't abort the in-flight reasoning,
          // so it takes over (discarding the current reply) once it lands.
          if (text.length < 5) return;
          pendingTurnRef.current = text;
        }
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
  }, [sendTurn, stopSpeaking]);

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
    try { audioRef.current?.pause(); } catch {}
    try { recRef.current?.stop(); } catch {}
    pendingTurnRef.current = null;
    replyRef.current = '';
    setInterim('');
    setP('idle');
  }, [setP]);

  const interrupt = useCallback(() => {
    if (phaseRef.current === 'speaking') {
      stopSpeaking();
      setP('listening');
    }
  }, [setP, stopSpeaking]);

  return { supported, active, phase, interim, activate, deactivate, interrupt };
}

// Echo guard: returns true if the transcript looks like the assistant hearing
// its own spoken reply (the mic picking up TTS audio) rather than the user
// genuinely cutting in.
function isEcho(transcript, reply) {
  const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  const t = norm(transcript);
  const r = norm(reply);
  if (!t) return true;
  if (t.length >= 4 && r.includes(t)) return true; // transcript is part of the reply
  const words = t.split(' ').filter((w) => w.length > 2);
  if (words.length < 3) return false;
  const matched = words.filter((w) => r.includes(w)).length;
  return matched / words.length >= 0.7;
}