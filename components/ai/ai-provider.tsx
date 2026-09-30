"use client";

import { animate, type MotionValue, useMotionValue } from "motion/react";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePortfolio } from "@/components/portfolio/portfolio-provider";
import { type AIResponseData, answer } from "@/data/ai-responses";
import type { Portfolio } from "@/data/portfolio";
import {
  type AIState,
  type AudioAmplitudeStatus,
  useAudioAmplitude,
  useSimulatedAmplitude,
} from "@/components/ui/smoothui/ai-core";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export type TurnPhase = "thinking" | "streaming" | "done";

export interface Turn {
  id: number;
  question: string;
  response: AIResponseData;
  phase: TurnPhase;
}

interface AIContextValue {
  /** The conversation stage is open and the orb is forward. */
  open: boolean;
  /** Shared orb state, straight from SmoothUI's AI state contract. */
  aiState: AIState;
  /** Amplitude for the stage orb: mic, keystrokes or simulated voice. */
  amplitude: MotionValue<number> | undefined;
  turns: Turn[];
  /** Card ids and tickers the current answer is about. */
  highlights: ReadonlySet<string>;
  /** Mic is live from the home screen, before the chat has opened. */
  homeListening: boolean;
  /** Returns (once) where the last answer was, so its card can fold in from there. */
  consumeInsightOrigin: () => { x: number; y: number } | null;
  /** A card to scroll to and pulse once the stage has closed. */
  spotlight: string | null;
  lastInsight: AIResponseData | null;
  micStatus: AudioAmplitudeStatus;
  /** Short status line for errors, e.g. a blocked microphone. */
  notice: string | null;
  summon: () => void;
  /** Close the stage and take the reader to a dashboard card. */
  showOnDashboard: (id: string) => void;
  dismiss: () => void;
  ask: (question: string) => void;
  /** Call on every keystroke in the ask input. */
  typing: (value: string) => void;
  toggleMic: () => void;
  /** Called by the answer renderer once the last token is on screen. */
  completeTurn: (id: number) => void;
  /** Focus target inside the stage, set by the stage. */
  inputRef: React.RefObject<HTMLInputElement | null>;
}

const AIContext = createContext<AIContextValue | null>(null);

export function useAI() {
  const value = useContext(AIContext);
  if (!value) {
    throw new Error("useAI must be used inside <AIProvider>");
  }
  return value;
}

/* -------------------------------------------------------------------------- */
/* Speech recognition (Chrome, Safari). Optional: typing always works.        */
/* -------------------------------------------------------------------------- */

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
}

const getSpeechRecognition = (): (new () => SpeechRecognitionLike) | null => {
  if (typeof window === "undefined") {
    return null;
  }
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

/* -------------------------------------------------------------------------- */
/* Provider                                                                   */
/* -------------------------------------------------------------------------- */

const THINK_MIN_MS = 900;
const THINK_MAX_MS = 1400;
const DONE_TO_IDLE_MS = 1800;
const ERROR_TO_IDLE_MS = 1400;

export function AIProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [aiState, setAIState] = useState<AIState>("idle");
  const [turns, setTurns] = useState<Turn[]>([]);
  const { portfolio } = usePortfolio();
  // An insight belongs to the portfolio it was about; editing holdings retires it.
  const [insight, setLastInsight] = useState<{ response: AIResponseData; portfolio: Portfolio } | null>(null);
  const lastInsight = insight && insight.portfolio === portfolio ? insight.response : null;
  const [notice, setNotice] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const timers = useRef<number[]>([]);
  const turnId = useRef(0);
  const recognition = useRef<SpeechRecognitionLike | null>(null);
  const transcript = useRef("");

  const mic = useAudioAmplitude();
  const simulated = useSimulatedAmplitude("streaming");
  const keystrokes = useMotionValue(0);

  const clearTimers = useCallback(() => {
    for (const id of timers.current) {
      window.clearTimeout(id);
    }
    timers.current = [];
  }, []);

  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const busy = turns.some((t) => t.phase !== "done");

  /* ---- summon / dismiss ------------------------------------------------ */

  const summon = useCallback(() => setOpen(true), []);
  /** Where the last answer sat on screen (document coords), for the Last insight fold. */
  const insightOrigin = useRef<{ x: number; y: number } | null>(null);
  const consumeInsightOrigin = useCallback(() => {
    const origin = insightOrigin.current;
    insightOrigin.current = null;
    return origin;
  }, []);
  const [spotlight, setSpotlight] = useState<string | null>(null);

  const stopListening = useCallback(() => {
    recognition.current?.abort();
    recognition.current = null;
    mic.stop();
  }, [mic]);

  const dismiss = useCallback(() => {
    clearTimers();
    stopListening();
    // The last finished, useful answer folds into the "Last insight" card.
    const finished = [...turns].reverse().find((t) => t.phase === "done" && t.response.intent !== "fallback");
    if (finished) {
      setLastInsight({ response: finished.response, portfolio });
      const node = document.querySelector<HTMLElement>(`[data-stage-answer="${finished.id}"]`);
      if (node) {
        const box = node.getBoundingClientRect();
        const top = Math.max(box.top, 0);
        const bottom = Math.min(box.bottom, window.innerHeight);
        insightOrigin.current = {
          x: box.left + box.width / 2 + window.scrollX,
          y: (top + bottom) / 2 + window.scrollY,
        };
      }
    }
    setTurns([]);
    setOpen(false);
    setNotice(null);
    setAIState("idle");
  }, [clearTimers, portfolio, stopListening, turns]);

  const showOnDashboard = useCallback(
    (id: string) => {
      dismiss();
      setSpotlight(id);
      // Long enough for the dismiss timeline, the scroll and one glow pulse.
      window.setTimeout(() => setSpotlight((s) => (s === id ? null : s)), 2600);
    },
    [dismiss]
  );

  /* ---- asking ---------------------------------------------------------- */

  const ask = useCallback(
    (raw: string) => {
      const question = raw.trim();
      if (!question) {
        return;
      }
      clearTimers();
      stopListening();
      setOpen(true);
      setNotice(null);

      const id = ++turnId.current;
      const response = answer(question, portfolio);
      setTurns((current) => [
        // Unfinished turns are cut short so only one answer streams at a time.
        ...current.map((t) => (t.phase === "done" ? t : { ...t, phase: "done" as const })),
        { id, question, response, phase: "thinking" },
      ]);
      setAIState("thinking");

      const think = THINK_MIN_MS + Math.random() * (THINK_MAX_MS - THINK_MIN_MS);
      later(() => {
        setTurns((current) =>
          current.map((t) => (t.id === id ? { ...t, phase: "streaming" } : t))
        );
        setAIState("streaming");
      }, think);
    },
    [clearTimers, later, portfolio, stopListening]
  );

  const completeTurn = useCallback(
    (id: number) => {
      setTurns((current) =>
        current.map((t) => (t.id === id ? { ...t, phase: "done" } : t))
      );
      setAIState("done");
      later(() => setAIState((s) => (s === "done" ? "idle" : s)), DONE_TO_IDLE_MS);
    },
    [later]
  );

  /* ---- typing ---------------------------------------------------------- */

  const typing = useCallback(
    (value: string) => {
      if (busy) {
        return;
      }
      // Each keystroke is a small pulse, so the orb visibly listens to typing.
      keystrokes.set(Math.min(1, keystrokes.get() + 0.45));
      animate(keystrokes, 0, { duration: 0.45, ease: "easeOut" });
      setAIState((s) => (value.trim() ? "listening" : s === "listening" ? "idle" : s));
    },
    [busy, keystrokes]
  );

  /* ---- microphone ------------------------------------------------------ */

  const toggleMic = useCallback(() => {
    if (mic.status === "active" || mic.status === "requesting") {
      const heard = transcript.current.trim();
      stopListening();
      if (heard) {
        ask(heard);
      } else {
        setAIState("idle");
      }
      return;
    }
    setNotice(null);
    transcript.current = "";
    void mic.start();

    const Recognition = getSpeechRecognition();
    if (Recognition) {
      const rec = new Recognition();
      rec.continuous = false;
      rec.interimResults = true;
      rec.lang = "en-US";
      let asked = false;
      rec.onresult = (event) => {
        let text = "";
        let final = false;
        for (let i = 0; i < event.results.length; i++) {
          text += event.results[i][0].transcript;
          final = event.results[i].isFinal;
        }
        transcript.current = text;
        if (inputRef.current) {
          inputRef.current.value = text;
        }
        // Spoken from the home screen: the first recognised words open the chat.
        if (text.trim()) {
          setOpen(true);
        }
        if (final && !asked) {
          asked = true;
          ask(text);
        }
      };
      rec.onerror = () => {
        recognition.current = null;
      };
      rec.onend = () => {
        recognition.current = null;
        // Some browsers end without a final result; use what was heard, or stand down.
        if (!asked) {
          const heard = transcript.current.trim();
          if (heard) {
            asked = true;
            ask(heard);
          } else if (mic.status !== "denied") {
            mic.stop();
            setAIState((s) => (s === "listening" ? "idle" : s));
          }
        }
      };
      recognition.current = rec;
      try {
        rec.start();
      } catch {
        recognition.current = null;
      }
    }
  }, [ask, mic, stopListening]);

  // Mic status drives the orb: listening while live, error if denied. The
  // status comes from an external system (the permission prompt), so syncing
  // it into state here is the intended use of an effect.
  useEffect(() => {
    if (mic.status === "active") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAIState("listening");
      if (!getSpeechRecognition()) {
        setNotice("Listening. Voice-to-text isn't supported in this browser, so type your question.");
        setOpen(true);
      }
    } else if (mic.status === "denied" || mic.status === "unsupported") {
      setAIState("error");
      setNotice(
        mic.status === "denied"
          ? "Microphone access was blocked. You can type your question instead."
          : "This browser can't use the microphone. You can type your question instead."
      );
      recognition.current?.abort();
      recognition.current = null;
      later(() => {
        setAIState((s) => (s === "error" ? "idle" : s));
        inputRef.current?.focus();
      }, ERROR_TO_IDLE_MS);
    }
  }, [later, mic.status]);

  /* ---- derived ---------------------------------------------------------- */

  const current = turns[turns.length - 1];
  const highlights = useMemo(
    () =>
      new Set(
        open && current && current.phase !== "thinking" ? current.response.highlights : []
      ),
    [open, current]
  );

  let amplitude: MotionValue<number> | undefined;
  if (aiState === "listening") {
    amplitude = mic.status === "active" ? mic.amplitude : keystrokes;
  } else if (aiState === "streaming") {
    amplitude = simulated;
  }

  const value = useMemo<AIContextValue>(
    () => ({
      open,
      aiState,
      amplitude,
      turns,
      highlights,
      homeListening: !open && (mic.status === "active" || mic.status === "requesting"),
      consumeInsightOrigin,
      spotlight,
      lastInsight,
      micStatus: mic.status,
      notice,
      summon,
      showOnDashboard,
      dismiss,
      ask,
      typing,
      toggleMic,
      completeTurn,
      inputRef,
    }),
    [open, aiState, amplitude, turns, highlights, consumeInsightOrigin, spotlight, lastInsight, mic.status, notice, summon, showOnDashboard, dismiss, ask, typing, toggleMic, completeTurn]
  );

  return <AIContext.Provider value={value}>{children}</AIContext.Provider>;
}
