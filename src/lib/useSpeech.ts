"use client";

import { useEffect, useRef, useState } from "react";

// Minimal typings for the Web Speech API (not in TS's DOM lib).
type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};

function getRecognition(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Voice → text. Calls onText with the running transcript (prefix + what's been said),
 * so the user can edit it before sending.
 */
export function useSpeech(onText: (text: string) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<Recognition | null>(null);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  useEffect(() => setSupported(!!getRecognition()), []);

  const start = (prefix: string) => {
    const Ctor = getRecognition();
    if (!Ctor) return;
    setError(null);
    const r = new Ctor();
    r.lang = "en-AU";
    r.interimResults = true;
    r.continuous = true;
    const base = prefix.trim() ? prefix.trim() + " " : "";
    let finalText = "";
    r.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finalText += res[0].transcript;
        else interim += res[0].transcript;
      }
      onTextRef.current(base + finalText + interim);
    };
    r.onerror = (e) => {
      if (e.error === "not-allowed") setError("Microphone access was blocked. Allow it in your browser settings.");
      else if (e.error !== "aborted" && e.error !== "no-speech") setError("Didn't catch that. Try again or type.");
    };
    r.onend = () => setListening(false);
    rec.current = r;
    r.start();
    setListening(true);
  };

  const stop = () => {
    rec.current?.stop();
    setListening(false);
  };

  useEffect(() => () => rec.current?.stop(), []);

  return { supported, listening, error, start, stop };
}
