"use client";

import { ArrowUpRight, Mic, Pencil, Square } from "lucide-react";
import { useMemo, useRef } from "react";
import { useAI } from "@/components/ai/ai-provider";
import { ORB_COLORS } from "@/components/ai/ambient-orb";
import { Delta } from "@/components/dashboard/cell";
import { usePortfolio, useMoney } from "@/components/portfolio/portfolio-provider";
import SiriOrb from "@/components/ui/smoothui/siri-orb";
import { headlineFor, noticedFor, QUESTION_BY_INTENT } from "@/data/ai-responses";
import { AS_OF } from "@/data/portfolio";
import { longDate, signedPct } from "@/lib/format";
import { EASE_ENTER, EASE_LAND, gsap, prefersReducedMotion, useGSAP } from "@/lib/motion";
import { cn } from "@/lib/utils";

function Stat({ label, value, pctValue, detail }: { label: string; value: number; pctValue: number; detail: string }) {
  const { signedMoney } = useMoney();
  return (
    <div className="flex flex-col gap-1">
      <span className="eyebrow text-ink-2">{label}</span>
      <span className="flex items-baseline gap-2 text-[15px]">
        <Delta value={value}>{signedMoney(value)}</Delta>
        <Delta className="text-[13px]" value={pctValue}>
          {detail}
        </Delta>
      </span>
    </div>
  );
}

export function PortfolioHero() {
  const { money } = useMoney();
  const { summon, ask, open, lastInsight, aiState, homeListening, micStatus, notice, toggleMic, consumeInsightOrigin } =
    useAI();
  const { portfolio, openEditor } = usePortfolio();
  const { totals } = portfolio;
  const valueRef = useRef<HTMLSpanElement>(null);
  const shownValue = useRef<number | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const noticed = useMemo(() => noticedFor(portfolio), [portfolio]);
  const listening = homeListening && micStatus !== "denied";

  // Counter ticks up to the value: from 94% on first load, and from the old
  // total whenever the portfolio changes. The server renders the final number,
  // so there's no layout shift and no-JS readers see it too.
  useGSAP(
    () => {
      const node = valueRef.current;
      const target = totals.value;
      // Still swapping in saved holdings (page hidden): count up to them, not from the sample.
      const pending = document.documentElement.classList.contains("portfolio-pending");
      const from = shownValue.current === null || pending ? target * 0.94 : shownValue.current;
      shownValue.current = target;
      if (!node || prefersReducedMotion() || from === target) {
        return;
      }
      const counter = { value: from };
      gsap.to(counter, {
        value: target,
        duration: 1.4,
        delay: 0.15,
        ease: EASE_ENTER,
        onUpdate: () => {
          node.textContent = money(counter.value);
        },
      });
    },
    { scope: root, dependencies: [totals.value], revertOnUpdate: true }
  );

  // The answer folds into the Last insight card: it flies in from where the
  // answer sat on the stage, then settles with one quiet glow.
  useGSAP(
    () => {
      const card = root.current?.querySelector<HTMLElement>("[data-insight]");
      if (!lastInsight || !card) {
        return;
      }
      const origin = consumeInsightOrigin();
      if (prefersReducedMotion()) {
        return;
      }
      const box = card.getBoundingClientRect();
      const dx = origin ? origin.x - (box.left + box.width / 2 + window.scrollX) : 0;
      const dy = origin ? origin.y - (box.top + box.height / 2 + window.scrollY) : 12;
      gsap
        .timeline({ delay: 0.2 })
        .fromTo(
          card,
          { opacity: 0, x: dx, y: dy, scale: origin ? 0.9 : 1 },
          { opacity: 1, x: 0, y: 0, scale: 1, duration: 0.6, ease: EASE_LAND }
        )
        .fromTo(
          card,
          { boxShadow: "0 0 0 1px #0099ff, 0 0 48px #0000ee99" },
          { boxShadow: "0 0 0 1px #1f1f1f, 0 0 0px #0000ee00", duration: 0.9, ease: EASE_ENTER },
          0.4
        );
    },
    { scope: root, dependencies: [lastInsight] }
  );

  return (
    <div
      className="pointer-events-none relative grid gap-8 pt-12 pb-16 max-md:pt-8 max-md:pb-10 lg:grid-cols-[1fr_360px] lg:items-end"
      ref={root}
    >
      {/* The scrim keeps every line of text at 4.5:1 or better over the orb. */}
      <div className="hero-scrim flex flex-col gap-6">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px] text-ink-2" data-reveal>
          <span>{longDate(AS_OF)} · Market closed</span>
          <button
            className="pointer-events-auto inline-flex h-6 items-center gap-1.5 rounded-full border border-edge bg-black px-2.5 text-[12px] text-ink-2 transition-colors duration-150 hover:border-brand-text hover:text-ink"
            onClick={openEditor}
            type="button"
          >
            <span
              aria-hidden
              className={cn("size-1.5 rounded-full", portfolio.isSample ? "bg-warn" : "bg-up")}
            />
            {portfolio.isSample ? "Sample portfolio · Use your own" : portfolio.source ? `From ${portfolio.source} · Edit` : "Your portfolio · Edit"}
            <Pencil aria-hidden className="size-3" />
          </button>
          {!portfolio.isSample ? (
            <span className="text-[12px] text-ink-2">
              {portfolio.source ? "Values from your file" : "Your holdings, mock prices"} · earlier moves simulated
            </span>
          ) : null}
        </p>

        <div data-reveal>
          <h1 className="eyebrow text-ink-2">Total portfolio value</h1>
          <p className="mt-2 text-[72px] text-ink leading-none tracking-[-0.04em] max-md:text-[48px]">
            <span className="num" ref={valueRef} suppressHydrationWarning>
              {money(totals.value)}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap gap-x-8 gap-y-4" data-reveal>
          <Stat detail={signedPct(totals.dayChangePct)} label="Today" pctValue={totals.dayChangePct} value={totals.dayChange} />
          <Stat detail={signedPct(totals.weekChangePct)} label="This week" pctValue={totals.weekChangePct} value={totals.weekChange} />
          <Stat
            detail={signedPct(totals.allTimeReturnPct, 1)}
            label="All-time return"
            pctValue={totals.allTimeReturnPct}
            value={totals.allTimeReturn}
          />
        </div>

        <p className="max-w-[600px] font-display text-[32px] text-ink leading-[1.2] max-md:text-[24px]" data-reveal>
          {headlineFor(portfolio)}
        </p>

        {/* The way in: type, or speak straight from here. */}
        <div data-reveal>
          <div
            className={cn(
              "ai-field pointer-events-auto flex h-16 w-full max-w-[600px] items-center rounded-[14px] pr-2 max-md:h-14",
              open && "invisible"
            )}
            data-active={listening || undefined}
          >
            <button
              aria-keyshortcuts="/"
              className="flex h-full min-w-0 flex-1 items-center gap-3 rounded-[13px] pl-4 text-left"
              onClick={summon}
              onFocus={(event) => {
                // Keyboard focus summons too, as the brief asks; mouse users get the click.
                if (event.target.matches(":focus-visible") && !event.currentTarget.dataset.returningFocus) {
                  summon();
                }
              }}
              type="button"
            >
              <span aria-hidden className="shrink-0">
                <SiriOrb colors={ORB_COLORS} size="28px" state={listening ? aiState : "idle"} />
              </span>
              <span className={cn("flex-1 truncate text-[17px] max-md:text-[16px]", listening ? "text-ink" : "text-ink-2")}>
                {listening ? "Listening… ask about your portfolio" : "Ask your portfolio anything"}
              </span>
              <span className="kbd max-md:hidden">/</span>
            </button>
            <button
              aria-label={listening ? "Stop listening" : "Ask Aurum with your voice"}
              aria-pressed={listening}
              className={cn(
                "ml-2 inline-flex size-11 shrink-0 items-center justify-center rounded-[10px] border transition-colors duration-150",
                listening
                  ? "border-brand-text bg-brand text-ink"
                  : "border-edge text-ink-2 hover:border-brand-text hover:text-ink"
              )}
              onClick={toggleMic}
              type="button"
            >
              {listening ? <Square aria-hidden className="size-3.5 fill-current" /> : <Mic aria-hidden className="size-[18px]" />}
            </button>
          </div>
          <p aria-live="polite" className="mt-2 min-h-5 text-[13px] text-ink-2">
            {!open && notice ? <span className="text-down">{notice}</span> : null}
            {!open && !notice && listening ? "Speak now. The chat opens as soon as I hear you." : null}
          </p>
        </div>
      </div>

      <aside aria-label="Aurum insights" className="pointer-events-auto flex flex-col gap-3" data-reveal>
        {lastInsight ? (
          <div className="rounded-[10px] border border-hairline bg-black p-4" data-insight>
            <p className="eyebrow flex items-center gap-2 text-brand-text">
              <span aria-hidden className="size-1.5 rounded-full bg-brand-text" />
              Last insight
            </p>
            <p className="mt-2 font-medium text-[15px] text-ink">{lastInsight.title}</p>
            <p className="mt-1 text-[13px] text-ink-2 leading-5">{lastInsight.summary}</p>
            <button
              className="mt-3 inline-flex items-center gap-1 text-[13px] text-brand-text transition-opacity duration-150 hover:opacity-90"
              onClick={() => ask(QUESTION_BY_INTENT[lastInsight.intent])}
              type="button"
            >
              Open again <ArrowUpRight aria-hidden className="size-3.5" />
            </button>
          </div>
        ) : null}

        {noticed.length ? (
          <div className="rounded-[10px] border border-hairline bg-black p-4">
            <p className="eyebrow text-ink-2">Aurum noticed</p>
            <ul className="mt-2 flex flex-col divide-y divide-hairline">
              {noticed.map((item) => (
                <li className="py-3 first:pt-1 last:pb-0" key={item.text}>
                  <p className="text-[13px] text-ink-2 leading-5">{item.text}</p>
                  <button
                    className="mt-1 inline-flex items-center gap-1 text-[13px] text-brand-text transition-opacity duration-150 hover:opacity-90"
                    onClick={() => ask(item.question)}
                    type="button"
                  >
                    {item.cta} <ArrowUpRight aria-hidden className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="rounded-[10px] border border-hairline bg-black p-4">
            <p className="eyebrow text-ink-2">Get started</p>
            <p className="mt-2 text-[13px] text-ink-2 leading-5">Add your holdings and Aurum will explain every move.</p>
            <button
              className="mt-2 inline-flex items-center gap-1 text-[13px] text-brand-text"
              onClick={openEditor}
              type="button"
            >
              Add your portfolio <ArrowUpRight aria-hidden className="size-3.5" />
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}
