import { useState, useRef, useEffect, useCallback } from 'react';

// useSpeechRecognition — browser Web Speech API (speech-to-text). Real-time,
// free, no backend. Gracefully reports supported=false where unavailable.
// onFinal(finalTranscript) fires for each finalized phrase.
export function useSpeechRecognition({ onFinal } = {}) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const recRef = useRef(null);
  const onFinalRef = useRef(onFinal);
  useEffect(() => { onFinalRef.current = onFinal; }, [onFinal]);

  useEffect(() => {
    const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!SR) { setSupported(false); return; }
    setSupported(true);
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = 'en-US';
    rec.onresult = (e) => {
      let finalText = '';
      let interimText = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += t; else interimText += t;
      }
      setInterim(interimText);
      if (finalText) {
        setInterim('');
        onFinalRef.current?.(finalText.trim());
      }
    };
    rec.onend = () => { setListening(false); setInterim(''); };
    rec.onerror = () => { setListening(false); setInterim(''); };
    recRef.current = rec;
    return () => { try { rec.abort(); } catch {} recRef.current = null; };
  }, []);

  const start = useCallback(() => {
    if (recRef.current && !listening) {
      setInterim('');
      try { recRef.current.start(); setListening(true); } catch {}
    }
  }, [listening]);
  const stop = useCallback(() => {
    if (recRef.current) { try { recRef.current.stop(); } catch {} }
    setListening(false);
  }, []);

  return { supported, listening, interim, start, stop };
}

// useSpeechSynthesis — browser SpeechSynthesis API (text-to-speech). Free,
// real-time. speak() cancels any current utterance first so only one reads
// at a time; cancel() stops playback.
export function useSpeechSynthesis() {
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    setSupported(typeof window !== 'undefined' && 'speechSynthesis' in window);
    return () => { try { window.speechSynthesis?.cancel(); } catch {} };
  }, []);

  const speak = useCallback((text) => {
    if (!('speechSynthesis' in window) || !text) return;
    try { window.speechSynthesis.cancel(); } catch {}
    const u = new SpeechSynthesisUtterance(text);
    u.onstart = () => setSpeaking(true);
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(u);
  }, []);

  const cancel = useCallback(() => {
    try { window.speechSynthesis.cancel(); } catch {}
    setSpeaking(false);
  }, []);

  return { supported, speaking, speak, cancel };
}