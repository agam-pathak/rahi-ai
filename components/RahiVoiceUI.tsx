"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";
import { motion } from "framer-motion";

type VoiceStatus = "idle" | "listening" | "thinking" | "speaking";
type VoiceLang = "en-IN" | "hi-IN";
type EarconType = "start" | "send";

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: any) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: any) => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

const AUTO_SEND_DELAY_MS = 850;
const DUPLICATE_GUARD_MS = 1800;

const normalizeTranscript = (value: string) =>
  value.replace(/\s+/g, " ").trim();

const friendlyVoiceError = (code?: string) => {
  const key = String(code || "").toLowerCase();
  if (key === "not-allowed" || key === "service-not-allowed") {
    return "Microphone permission is blocked.";
  }
  if (key === "audio-capture") {
    return "No microphone detected.";
  }
  if (key === "network") {
    return "Network issue while listening.";
  }
  if (key === "language-not-supported") {
    return "Selected voice language is not supported.";
  }
  if (key === "no-speech") {
    return "Couldn't hear anything. Try again.";
  }
  return "Voice input failed.";
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
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const speech = window.speechSynthesis;
  const payload = normalizeTranscript(text).slice(0, 420);
  if (!payload) return;

  speech.cancel();

  const utter = new SpeechSynthesisUtterance(payload);
  utter.lang = lang;
  utter.rate = 0.95;
  utter.pitch = 1.02;
  utter.volume = 0.8;

  const assignPreferredVoice = () => {
    const voices = speech.getVoices();
    const langBase = lang.split("-")[0];
    const preferredVoice =
      voices.find(
        (voice) =>
          voice.lang === lang &&
          /Google|Microsoft|Premium|Neural/i.test(voice.name)
      ) ||
      voices.find(
        (voice) =>
          voice.lang.startsWith(langBase) &&
          /Google|Microsoft|Premium|Neural/i.test(voice.name)
      ) ||
      voices.find((voice) => voice.lang === lang) ||
      voices.find((voice) => voice.lang.startsWith(langBase));

    if (preferredVoice) {
      utter.voice = preferredVoice;
    }
  };

  assignPreferredVoice();
  if (!utter.voice) {
    const onVoicesChanged = () => {
      assignPreferredVoice();
      speech.removeEventListener("voiceschanged", onVoicesChanged);
    };
    speech.addEventListener("voiceschanged", onVoicesChanged);
  }

  const finalize = () => {
    if (speakingRef) speakingRef.current = false;
    onEnd?.();
  };

  utter.onstart = () => {
    if (speakingRef) speakingRef.current = true;
    recognitionRef?.current?.stop();
    onStart?.();
  };

  utter.onend = finalize;
  utter.onerror = finalize;

  speech.speak(utter);
};

type Props = {
  onText: (text: string) => void;
  onListening?: (listening: boolean) => void;
  lang?: VoiceLang;
  status?: VoiceStatus;
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

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const listeningRef = useRef(false);
  const speakingRef = useRef(false);
  const manualStopRef = useRef(false);
  const langRef = useRef<VoiceLang>(lang);
  const finalTextRef = useRef("");
  const sendTimeoutRef = useRef<number | null>(null);
  const lastSentRef = useRef<string | null>(null);
  const lastSentAtRef = useRef(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const onTextRef = useRef(onText);
  const onListeningRef = useRef(onListening);
  const autoSendRef = useRef(autoSend);
  const earconsRef = useRef(earcons);

  useEffect(() => {
    onTextRef.current = onText;
  }, [onText]);

  useEffect(() => {
    onListeningRef.current = onListening;
  }, [onListening]);

  useEffect(() => {
    autoSendRef.current = autoSend;
  }, [autoSend]);

  useEffect(() => {
    earconsRef.current = earcons;
  }, [earcons]);

  useEffect(() => {
    langRef.current = lang;
    if (recognitionRef.current) {
      recognitionRef.current.lang = lang;
    }
  }, [lang]);

  const clearSendTimer = useCallback(() => {
    if (sendTimeoutRef.current != null) {
      window.clearTimeout(sendTimeoutRef.current);
      sendTimeoutRef.current = null;
    }
  }, []);

  const setListeningState = useCallback((active: boolean) => {
    listeningRef.current = active;
    setUiListening(active);
    onListeningRef.current?.(active);
  }, []);

  const stopRecognition = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch {
      // noop
    }
  }, []);

  const playEarcon = useCallback((kind: EarconType) => {
    if (typeof window === "undefined") return;

    try {
      if (!audioCtxRef.current) {
        const AudioContextCtor =
          window.AudioContext ||
          (window as any).webkitAudioContext;
        if (!AudioContextCtor) return;
        audioCtxRef.current = new AudioContextCtor();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") {
        void ctx.resume();
      }

      const playTone = (freq: number, duration: number, gain = 0.045) => {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gainNode.gain.value = gain;
        gainNode.gain.exponentialRampToValueAtTime(
          0.0001,
          ctx.currentTime + duration
        );
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
    } catch {
      // Earcons are optional; ignore failures.
    }
  }, []);

  const flushSend = useCallback(() => {
    const text = normalizeTranscript(finalTextRef.current);
    if (!text) return;

    const now = Date.now();
    if (
      text === lastSentRef.current &&
      now - lastSentAtRef.current < DUPLICATE_GUARD_MS
    ) {
      return;
    }

    lastSentRef.current = text;
    lastSentAtRef.current = now;

    if (earconsRef.current) {
      playEarcon("send");
    }

    onTextRef.current(text);
    clearSendTimer();
    finalTextRef.current = "";
    setFinalText("");
    setInterimText("");
    setErrorText("");
    manualStopRef.current = true;
    setListeningState(false);
    stopRecognition();
  }, [clearSendTimer, playEarcon, setListeningState, stopRecognition]);

  const startListening = useCallback(() => {
    if (!supported || !recognitionRef.current) return;
    if (uiListening) return;

    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    speakingRef.current = false;
    manualStopRef.current = false;
    finalTextRef.current = "";
    setFinalText("");
    setInterimText("");
    setErrorText("");
    setListeningState(true);

    if (earconsRef.current) {
      playEarcon("start");
    }

    try {
      recognitionRef.current.start();
    } catch (error) {
      const message =
        error instanceof Error ? error.message.toLowerCase() : "";
      if (!message.includes("already started")) {
        setErrorText("Unable to start microphone.");
      }
      setListeningState(false);
    }
  }, [playEarcon, setListeningState, supported, uiListening]);

  const stopListening = useCallback(() => {
    manualStopRef.current = true;
    clearSendTimer();
    stopRecognition();
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    if (normalizeTranscript(finalTextRef.current)) {
      flushSend();
      return;
    }

    finalTextRef.current = "";
    setFinalText("");
    setInterimText("");
    setListeningState(false);
  }, [clearSendTimer, flushSend, setListeningState, stopRecognition]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const SR =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SR || typeof SR !== "function") {
      console.warn("SpeechRecognition not supported");
      setSupported(false);
      return;
    }

    setSupported(true);
    const Recognition = SR as SpeechRecognitionCtor;
    const rec = new Recognition();
    rec.lang = langRef.current;
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 3;

    rec.onresult = (e: any) => {
      if (speakingRef.current) return;

      let interim = "";
      let final = "";

      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        const transcript = normalizeTranscript(res[0]?.transcript || "");
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
        const next = normalizeTranscript(
          finalTextRef.current
            ? `${finalTextRef.current} ${final}`
            : final
        );
        finalTextRef.current = next;
        setFinalText(next);
        setInterimText("");

        if (autoSendRef.current) {
          clearSendTimer();
          sendTimeoutRef.current = window.setTimeout(() => {
            flushSend();
          }, AUTO_SEND_DELAY_MS);
        }
      }
    };

    rec.onend = () => {
      if (listeningRef.current && !manualStopRef.current) {
        window.setTimeout(() => {
          if (!listeningRef.current || manualStopRef.current) return;
          try {
            rec.start();
          } catch {
            // noop, browser manages in-flight start/end.
          }
        }, 120);
      }
    };

    rec.onerror = (event: any) => {
      const errorCode = String(event?.error || "");
      if (errorCode === "aborted" && manualStopRef.current) {
        return;
      }

      setErrorText(friendlyVoiceError(errorCode));

      if (
        errorCode === "not-allowed" ||
        errorCode === "service-not-allowed" ||
        errorCode === "audio-capture"
      ) {
        manualStopRef.current = true;
        setListeningState(false);
      }
    };

    recognitionRef.current = rec;
    return () => {
      clearSendTimer();
      try {
        rec.stop();
      } catch {
        // noop
      }
      recognitionRef.current = null;
    };
  }, [clearSendTimer, flushSend, setListeningState]);

  useEffect(() => {
    return () => {
      clearSendTimer();
      if (audioCtxRef.current) {
        void audioCtxRef.current.close();
        audioCtxRef.current = null;
      }
    };
  }, [clearSendTimer]);

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
        onClick={uiListening ? stopListening : startListening}
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
