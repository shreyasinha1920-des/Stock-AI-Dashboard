"use client";

import { ArrowUp, Mic, MicOff, X } from "lucide-react";
import { type Ref, useEffect, useRef } from "react";
import { AIResponse, plainText } from "@/components/ai/ai-response";
import { useAI } from "@/components/ai/ai-provider";
import { ORB_COLORS } from "@/components/ai/ambient-orb";
import SiriOrb from "@/components/ui/smoothui/siri-orb";
import { SUGGESTED_QUESTIONS } from "@/data/ai-responses";
import { prefersReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

export const STAGE_ORB_SIZE = 144;

const STATUS_COPY: Record<string, string> = {
  idle: "Ask anything about your portfolio",
  listening: "Listening",
  thinking: "Thinking",
  streaming: "Answering",
  done: "Done",
  error: "Microphone unavailable",
};


/**
 * The summoned conversation: orb at the top, answers in the middle, input at
 * the bottom. A modal dialog while open; inert and invisible otherwise.
 */
export function ConversationStage({
  rootRef,
  backdropRef,
  orbSlotRef,
  orbRef,
}: {
  rootRef: Ref<HTMLDivElement>;
  backdropRef: Ref<HTMLDivElement>;
  /** Where the flying ambient orb lands. */
  orbSlotRef: Ref<HTMLDivElement>;
  /** The crisp stage orb that takes over from the ambient one. */
  orbRef: Ref<HTMLDivElement>;
}) {
  const {
    open,
    aiState,
    amplitude,
    turns,
    notice,
    micStatus,
    dismiss,
    ask,
    typing,
    toggleMic,
    completeTurn,
    showOnDashboard,
    inputRef,
  } = useAI();
  const scroller = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  const reduced = prefersReducedMotion();

  const current = turns[turns.length - 1];
  const asked = new Set(turns.map((t) => t.question));
  const chips = SUGGESTED_QUESTIONS.filter((q) => !asked.has(q)).slice(0, 4);
  const busy = current ? current.phase !== "done" : false;
  const listening = micStatus === "active" || micStatus === "requesting";

  // Focus the input as the stage opens.
  useEffect(() => {
    if (open) {
      const id = window.setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 50);
      return () => window.clearTimeout(id);
    }
  }, [open, inputRef]);

  // Keep the newest words in view while streaming, unless the reader scrolled up.
  useEffect(() => {
    const box = scroller.current;
    const inner = content.current;
    if (!box || !inner) {
      return;
    }
    const onScroll = () => {
      pinned.current = box.scrollHeight - box.scrollTop - box.clientHeight < 48;
    };
    const observer = new ResizeObserver(() => {
      if (pinned.current) {
        box.scrollTo({ top: box.scrollHeight, behavior: reduced ? "auto" : "smooth" });
      }
    });
    box.addEventListener("scroll", onScroll, { passive: true });
    observer.observe(inner);
    return () => {
      box.removeEventListener("scroll", onScroll);
      observer.disconnect();
    };
  }, [reduced]);

  useEffect(() => {
    pinned.current = true;
  }, [turns.length]);

  const submit = () => {
    const value = inputRef.current?.value ?? "";
    if (!value.trim()) {
      return;
    }
    ask(value);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  return (
    <div
      aria-labelledby="stage-title"
      aria-modal="true"
      className="invisible fixed inset-0 z-[6] flex flex-col"
      inert={!open}
      ref={rootRef}
      role="dialog"
    >
      {/* Radial shade instead of a blur: dark around the conversation, lighter
          at the edges so lit dashboard cards still glow through. */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-0"
        onClick={dismiss}
        ref={backdropRef}
        style={{
          background:
            "radial-gradient(ellipse 70% 80% at 50% 40%, rgb(0 0 0 / 0.86) 0%, rgb(0 0 0 / 0.7) 55%, rgb(0 0 0 / 0.42) 100%)",
        }}
      />

      {/* A soft column of shade behind the conversation keeps text legible
          while the dashboard at the sides stays visible. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-1/2 w-[min(880px,100%)] -translate-x-1/2"
        data-stage-item
        style={{
          background:
            "linear-gradient(90deg, transparent, rgb(0 0 0 / 0.92) 10%, rgb(0 0 0 / 0.92) 90%, transparent)",
        }}
      />

      <h2 className="sr-only" id="stage-title">
        Ask Aurum about your portfolio
      </h2>

      <div className="relative flex min-h-0 flex-1 flex-col">
        <div className="flex justify-end p-4" data-stage-item>
          <button
            aria-label="Close conversation"
            className="inline-flex h-9 items-center gap-2 rounded-[8px] border border-edge bg-black px-3 text-[13px] text-ink-2 transition-colors duration-150 hover:border-ink-muted hover:text-ink"
            onClick={dismiss}
            type="button"
          >
            <span className="kbd h-5 border-edge">Esc</span>
            <X aria-hidden className="size-4" />
          </button>
        </div>

        {/* Orb slot. The ambient orb flies here, then this crisp orb takes over. */}
        <div className="flex shrink-0 flex-col items-center gap-3">
          <div
            className="relative"
            ref={orbSlotRef}
            style={{ width: STAGE_ORB_SIZE, height: STAGE_ORB_SIZE }}
          >
            <div className="absolute inset-0 opacity-0" ref={orbRef}>
              <SiriOrb amplitude={amplitude} colors={ORB_COLORS} size={`${STAGE_ORB_SIZE}px`} state={aiState} />
            </div>
          </div>
          <p aria-hidden className="flex h-5 items-center gap-2 text-[13px] text-ink-muted" data-stage-item>
            <span
              className={cn(
                "size-1.5 rounded-full",
                aiState === "error" ? "bg-down" : aiState === "idle" ? "bg-ink-subtle" : "bg-brand-text",
                (aiState === "thinking" || aiState === "listening") && "animate-pulse"
              )}
            />
            {STATUS_COPY[aiState]}
            {aiState === "thinking" || aiState === "streaming" ? "…" : ""}
          </p>
        </div>

        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 [mask-image:linear-gradient(to_bottom,transparent,black_32px,black_calc(100%-16px),transparent)]"
          ref={scroller}
        >
          <div
            aria-busy={busy}
            className="mx-auto flex w-full max-w-[720px] flex-col gap-8 py-6"
            ref={content}
          >
            {turns.map((turn) => (
              <article
                aria-label={`Answer to: ${turn.question}`}
                className="flex flex-col gap-4"
                data-stage-answer={turn.id}
                key={turn.id}
              >
                <p className="self-end rounded-[10px] rounded-br-[4px] border border-hairline bg-surface px-4 py-2 text-[14px] text-ink">
                  {turn.question}
                </p>
                {turn.phase === "thinking" ? (
                  <p className="flex items-center gap-2 text-[14px] text-ink-muted">
                    <span className="inline-flex gap-1" aria-hidden>
                      {[0, 1, 2].map((i) => (
                        <span
                          className="size-1 animate-pulse rounded-full bg-brand-text"
                          key={i}
                          style={{ animationDelay: `${i * 150}ms` }}
                        />
                      ))}
                    </span>
                    Reading your holdings
                  </p>
                ) : (
                  <AIResponse
                    ask={ask}
                    instant={reduced || (turn.phase === "done" && turn !== current)}
                    onDone={() => completeTurn(turn.id)}
                    response={turn.response}
                    showOnDashboard={showOnDashboard}
                    streaming={turn.phase === "streaming"}
                  />
                )}
              </article>
            ))}
          </div>
        </div>

        {/* Announce whole answers, not every streamed word. */}
        <div aria-live="polite" className="sr-only" role="status">
          {current?.phase === "thinking" ? "Thinking…" : ""}
          {current?.phase === "done" ? plainText(current.response) : ""}
          {notice ?? ""}
        </div>

        <div className="shrink-0 px-4 pt-2 pb-4">
          <div className="mx-auto flex w-full max-w-[720px] flex-col gap-3">
            {notice ? (
              <p className="text-[13px] text-down" data-stage-item>
                {notice}
              </p>
            ) : null}

            <form
              className="ai-field flex h-14 items-center gap-2 rounded-[14px] pr-2 pl-4"
              data-active={busy || listening || undefined}
              data-stage-item
              onSubmit={(event) => {
                event.preventDefault();
                submit();
              }}
            >
              <label className="sr-only" htmlFor="ask-input">
                Ask your portfolio
              </label>
              <input
                autoComplete="off"
                className="h-full min-w-0 flex-1 bg-transparent text-[16px] text-ink placeholder:text-ink-muted focus:outline-none"
                id="ask-input"
                onChange={(event) => typing(event.target.value)}
                placeholder={listening ? "Listening…" : "Ask your portfolio"}
                ref={inputRef}
              />
              <button
                aria-label={listening ? "Stop listening" : "Ask with your voice"}
                aria-pressed={listening}
                className={cn(
                  "inline-flex size-10 items-center justify-center rounded-[8px] transition-colors duration-150",
                  listening ? "bg-brand text-ink" : "text-ink-muted hover:bg-hairline hover:text-ink"
                )}
                onClick={toggleMic}
                type="button"
              >
                {micStatus === "denied" ? <MicOff aria-hidden className="size-4" /> : <Mic aria-hidden className="size-4" />}
              </button>
              <button
                aria-label="Send question"
                className="inline-flex size-10 items-center justify-center rounded-[8px] bg-ink text-black transition-opacity duration-150 hover:opacity-90"
                type="submit"
              >
                <ArrowUp aria-hidden className="size-4" />
              </button>
            </form>

            {chips.length > 0 && !busy ? (
              <div aria-label="Suggested questions" className="flex flex-wrap gap-2" data-stage-item role="group">
                {chips.map((q) => (
                  <button
                    className="inline-flex h-8 items-center rounded-full border border-edge bg-black px-3 text-[13px] text-ink-2 transition-colors duration-150 hover:border-brand-text hover:text-ink"
                    key={q}
                    onClick={() => ask(q)}
                    type="button"
                  >
                    {q}
                  </button>
                ))}
              </div>
            ) : null}

            <p className="text-center text-[12px] text-ink-subtle" data-stage-item>
              Mock data. Not financial advice.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
