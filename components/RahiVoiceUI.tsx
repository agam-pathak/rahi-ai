"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";
import { motion } from "framer-motion";

// --- Language Detection ---
const detectLanguage = (text: string) => {
  if (/[ऀ-ॿ]/.test(text)) return "hi-IN";
  return "en-US";
};

// --- Whisper Speaker (EXPORT THIS) ---
export const speakWithHeart = (
  text: string,
  lang: string,
  speakingRef?: React.MutableRefObject<boolean>,
  recognitionRef?: React.MutableRefObject<any>,
  onStart?: () => void,
  onEnd?: () => void
) => {
  if (typeof window === "undefined") return;

  speechSynthesis.cancel();

  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = lang;
  utter.rate = 0.95;
  utter.pitch = 1.02;
  utter.volume = 0.8;

  const voices = speechSynthesis.getVoices();
  const langBase = lang.split("-")[0];
  const preferredVoice =
    voices.find((voice) => voice.lang === lang && /Google|Microsoft|Premium|Neural/i.test(voice.name)) ||
    voices.find((voice) => voice.lang.startsWith(langBase) && /Google|Microsoft|Premium|Neural/i.test(voice.name)) ||
    voices.find((voice) => voice.lang === lang) ||
    voices.find((voice) => voice.lang.startsWith(langBase));

  if (preferredVoice) {
    utter.voice = preferredVoice;
  }

  utter.onstart = () => {
    if (speakingRef) speakingRef.current = true;
    recognitionRef?.current?.stop();
    onStart?.();
  };

  utter.onend = () => {
    if (speakingRef) speakingRef.current = false;
    onEnd?.();
  };

  speechSynthesis.speak(utter);
};

type Props = {
  onText: (text: string) => void;
  onListening?: (listening: boolean) => void;
  lang?: "en-IN" | "hi-IN";
  status?: "idle" | "listening" | "thinking" | "speaking";
  autoSend?: boolean;
  earcons?: boolean;
};

export default function RahiVoiceUI({
  onText,
  onListening,
  lang = "en-IN",
  status,
  autoSend = true,
  earcons = true,
}: Props) {
  const [uiListening, setUiListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const [interimText, setInterimText] = useState("");
  const [finalText, setFinalText] = useState("");
  const [errorText, setErrorText] = useState("");

  const recognitionRef = useRef<any>(null);
  const listeningRef = useRef(false);
  const speakingRef = useRef(false);
  const manualStopRef = useRef(false);
  const finalTextRef = useRef("");
  const sendTimeoutRef = useRef<number | null>(null);
  const lastSentRef = useRef("");
  const audioCtxRef = useRef<AudioContext | null>(null);
  

  useEffect(() => {
    if (typeof window === "undefined") return;

    const SR =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SR) {
      console.warn("SpeechRecognition not supported");
      setSupported(false);
      return;
    }

    const rec = new SR();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 3;

    rec.onresult = (e: any) => {
      if (speakingRef.current) return;

      let interim = "";
      let final = "";

      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        const transcript = res[0].transcript.trim();
        if (!transcript) continue;
        if (res.isFinal) {
          final += (final ? " " : "") + transcript;
        } else {
          interim += (interim ? " " : "") + transcript;
        }
      }

      if (interim) {
        setInterimText(interim);
      }

      if (final) {
        const next = finalTextRef.current
          ? `${finalTextRef.current} ${final}`
          : final;
        finalTextRef.current = next;
        setFinalText(next);
        setInterimText("");

        if (autoSend) {
          if (sendTimeoutRef.current) {
            window.clearTimeout(sendTimeoutRef.current);
          }
          sendTimeoutRef.current = window.setTimeout(() => {
            flushSend();
          }, 700);
        }
      }
    };

    rec.onend = () => {
      if (listeningRef.current && !manualStopRef.current) {
        rec.start();
      }
    };

    rec.onerror = (event: any) => {
      setErrorText(event?.error || "Voice input failed.");
    };

    recognitionRef.current = rec;
    return () => {
      rec.stop();
    };
  }, [onText, lang]);

  const flushSend = () => {
    const text = finalTextRef.current.trim();
    if (!text || text === lastSentRef.current) return;
    lastSentRef.current = text;
    if (earcons) playEarcon("send");
    onText(text);
    finalTextRef.current = "";
    setFinalText("");
    setInterimText("");
    setErrorText("");
    if (sendTimeoutRef.current) {
      window.clearTimeout(sendTimeoutRef.current);
    }
    manualStopRef.current = true;
    listeningRef.current = false;
    setUiListening(false);
    onListening?.(false);
    recognitionRef.current?.stop();
  };

  const start = () => {
    if (!supported) return;
    manualStopRef.current = false;
    listeningRef.current = true;
    setUiListening(true);
    setErrorText("");
    if (earcons) playEarcon("start");
    recognitionRef.current?.start();
    onListening?.(true);
  };

  const stop = () => {
    manualStopRef.current = true;
    listeningRef.current = false;
    setUiListening(false);
    recognitionRef.current?.stop();
    speechSynthesis.cancel();
    if (finalTextRef.current.trim()) {
      flushSend();
    }
    onListening?.(false);
  };

  const playEarcon = (kind: "start" | "send") => {
    if (typeof window === "undefined") return;
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    }
    const ctx = audioCtxRef.current;
    if (ctx.state === "suspended") {
      ctx.resume();
    }

    const playTone = (freq: number, duration: number, gain = 0.045) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gainNode.gain.value = gain;
      gainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
      osc.connect(gainNode).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    };

    if (kind === "start") {
      playTone(520, 0.06, 0.05);
    } else {
      playTone(620, 0.05, 0.045);
      window.setTimeout(() => playTone(820, 0.05, 0.04), 70);
    }
  };

  const displayState = status ?? (uiListening ? "listening" : "idle");
  const stateLabel = !supported
    ? "Voice not supported"
    : displayState === "listening"
      ? autoSend
        ? "Listening..."
        : "Listening... tap to send"
      : displayState === "thinking"
        ? "Thinking..."
        : displayState === "speaking"
          ? "Speaking..."
          : autoSend
            ? "Tap to speak"
            : "Tap to speak, tap again to send";

  return (
    <div className="rahi-voice" data-state={displayState}>
      <motion.button
        whileTap={{ scale: 0.96 }}
        onClick={uiListening ? stop : start}
        disabled={!supported}
        className={`rahi-voice-orb ${!supported ? "opacity-50 cursor-not-allowed" : ""}`}
        aria-label="Voice assistant"
      >
        <span className="rahi-voice-core" />
        <span className="rahi-voice-icon">
          {uiListening ? <MicOff size={22} /> : <Mic size={22} />}
        </span>
      </motion.button>

      {(finalText || interimText) && (
        <div className="rahi-voice-transcript">
          <span className="text-white">{finalText}</span>
          {interimText && <span className="text-gray-400"> {interimText}</span>}
        </div>
      )}

      <p className="rahi-voice-label">{stateLabel}</p>
      {errorText && <p className="text-[10px] text-red-400">{errorText}</p>}
    </div>
  );
}
