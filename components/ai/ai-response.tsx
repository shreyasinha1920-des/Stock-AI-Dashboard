"use client";

import { ArrowUpRight } from "lucide-react";
import { Fragment, memo, useEffect, useEffectEvent, useMemo, useState } from "react";
import { BarHover } from "@/components/charts/bar-hover";
import { ResponsiveDither } from "@/components/charts/responsive-dither";
import { EventRow } from "@/components/dashboard/upcoming-events";
import type { AIResponseData, ResponseBlock, Tone } from "@/data/ai-responses";
import { pct, signedPct } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useMoney } from "@/components/portfolio/portfolio-provider";

/* -------------------------------------------------------------------------- */
/* Tokenising                                                                 */
/* -------------------------------------------------------------------------- */

interface Word {
  text: string;
  strong: boolean;
  /** Plain text glued straight after a bold word, e.g. the "." in "**41.7%**." */
  suffix?: string;
}

/** Splits "a **b c** d" into words that remember whether they're bold. */
function toWords(text: string): Word[] {
  const words: Word[] = [];
  for (const run of text.split(/(\*\*[^*]+\*\*)/g)) {
    if (!run) {
      continue;
    }
    const strong = run.startsWith("**");
    const body = strong ? run.slice(2, -2) : run;
    const tokens = body.split(/\s+/);
    // A run that starts mid-word (no leading space) belongs to the previous word.
    if (!strong && words.length > 0 && !/^\s/.test(body) && tokens[0]) {
      const previous = words[words.length - 1];
      previous.suffix = (previous.suffix ?? "") + tokens.shift();
    }
    for (const word of tokens) {
      if (word) {
        words.push({ text: word, strong });
      }
    }
  }
  return words;
}

const blockTokens = (block: ResponseBlock) => (block.type === "text" ? toWords(block.text).length : 1);

/** Plain-text version of an answer, for the screen-reader live region. */
export function plainText(response: AIResponseData): string {
  return response.blocks
    .map((block) => {
      switch (block.type) {
        case "text":
          return block.text.replace(/\*\*/g, "");
        case "metrics":
          return block.items.map((i) => `${i.label}: ${i.value}${i.detail ? `, ${i.detail}` : ""}`).join(". ");
        case "chart":
          return `Chart: ${block.title}. ${block.caption}`;
        case "holdings":
          return block.rows.map((r) => `${r.ticker}, ${r.primary}, ${r.secondary}`).join(". ");
        case "table":
          return block.rows.map((r) => r.cells.join(", ")).join(". ");
        case "events":
          return block.items.map((e) => `${e.ticker} ${e.kind.replace("-", " ")} ${e.date.toDateString()}`).join(". ");
        case "suggestions":
          return `Try: ${block.items.join("; ")}`;
        default:
          return "";
      }
    })
    .join(" ");
}

/* -------------------------------------------------------------------------- */
/* Blocks                                                                     */
/* -------------------------------------------------------------------------- */

const toneClass = (tone?: Tone) =>
  tone === "up" ? "text-up" : tone === "down" ? "text-down" : "text-ink";

function TextBlock({ words, count }: { words: Word[]; count: number }) {
  return (
    <p className="text-[16px] text-ink-2 leading-[1.6]">
      {words.slice(0, count).map((word, i) => (
        <Fragment key={i}>
          {word.strong ? <strong className="num font-medium text-ink">{word.text}</strong> : word.text}
          {word.suffix}{" "}
        </Fragment>
      ))}
    </p>
  );
}

const ChartBlock = memo(function ChartBlock({ block }: { block: Extract<ResponseBlock, { type: "chart" }> }) {
  const { signedMoney, moneyCompact } = useMoney();
  const valueLabel = (v: number) =>
    block.unit === "pct" ? `${v >= 0 ? "" : "−"}${pct(v, 1)}` : `${v < 0 ? "−" : v > 0 ? "+" : ""}${moneyCompact(Math.abs(v))}`;
  const palette = useMemo(() => block.series.map((s) => s.color), [block.series]);
  const fullValue = (v: number) => (block.unit === "pct" ? signedPct(v, 1) : signedMoney(v));
  const points = block.series[0].points;

  return (
    <figure className="rounded-[10px] border border-hairline bg-black p-4">
      <figcaption className="eyebrow mb-4 flex flex-wrap items-center justify-between gap-2">
        <span>{block.title}</span>
        {block.legend ? (
          <span className="flex gap-4 normal-case tracking-normal">
            {block.legend.map((l) => (
              <span className="flex items-center gap-2 text-ink-muted" key={l.label}>
                <span aria-hidden className="size-2 rounded-full" style={{ background: l.color }} />
                {l.label}
              </span>
            ))}
          </span>
        ) : null}
      </figcaption>
      {block.variant === "bar" ? (
        <BarHover labels={block.axis} values={points.map((p) => fullValue(p.value))}>
          <ResponsiveDither
            data={block.series}
            domain={block.domain}
            height={140}
            matrix={4}
            palette={palette}
            pixelSize={3}
            variant="bar"
          />
        </BarHover>
      ) : (
        <ResponsiveDither
          data={block.series}
          domain={block.domain}
          height={160}
          matrix={4}
          palette={palette}
          pixelSize={2}
          variant="line"
        />
      )}
      {block.variant === "bar" ? (
        <div
          aria-hidden
          className="mt-2 grid text-center text-[11px]"
          style={{ gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))` }}
        >
          {points.map((p, i) => (
            <span className="flex min-w-0 flex-col" key={p.label}>
              <span className="truncate text-ink-2">{block.axis[i]}</span>
              <span className={cn("num truncate text-[11px]", p.value < 0 ? "text-down" : "text-ink-muted")}>
                {valueLabel(p.value)}
              </span>
            </span>
          ))}
        </div>
      ) : (
        <div aria-hidden className="mt-2 flex justify-between text-[11px] text-ink-subtle">
          <span>{block.axis[0]}</span>
          <span>{block.axis[block.axis.length - 1]}</span>
        </div>
      )}
      <p className="mt-3 text-[12px] text-ink-muted leading-5">{block.caption}</p>
    </figure>
  );
});

function Block({ block, ask }: { block: ResponseBlock; ask: (q: string) => void }) {
  switch (block.type) {
    case "metrics":
      return (
        <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-[10px] border border-hairline bg-hairline max-sm:grid-cols-1">
          {block.items.map((item) => (
            <div className="bg-black p-4" key={item.label}>
              <dt className="eyebrow truncate">{item.label}</dt>
              <dd className={cn("num mt-2 text-[20px] leading-none", toneClass(item.tone))}>{item.value}</dd>
              {item.detail ? <dd className="num mt-1 text-[12px] text-ink-muted">{item.detail}</dd> : null}
            </div>
          ))}
        </dl>
      );
    case "chart":
      return <ChartBlock block={block} />;
    case "holdings":
      return (
        <ul className="divide-y divide-hairline rounded-[10px] border border-hairline">
          {block.rows.map((row, i) => (
            <li className="flex items-center gap-4 px-4 py-3" key={row.ticker}>
              <span className="num w-4 text-[12px] text-ink-subtle">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-[14px] text-ink">{row.ticker}</span>
                <span className="block truncate text-[12px] text-ink-muted">{row.name}</span>
              </span>
              <span className="text-right">
                <span className={cn("num block text-[15px]", toneClass(row.tone))}>{row.primary}</span>
                <span className="num block text-[12px] text-ink-muted">{row.secondary}</span>
              </span>
            </li>
          ))}
        </ul>
      );
    case "table":
      return (
        <table className="w-full overflow-hidden rounded-[10px] border border-hairline text-[13px]">
          <thead>
            <tr className="border-hairline border-b">
              {block.columns.map((c, i) => (
                <th className={cn("h-9 px-4 font-normal text-[12px] text-ink-muted", i ? "text-right" : "text-left")} key={c} scope="col">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row) => (
              <tr className="border-hairline border-b last:border-0" key={row.cells[0]}>
                {row.cells.map((cell, i) =>
                  i === 0 ? (
                    <th className="h-10 px-4 text-left font-normal text-ink-2" key={i} scope="row">
                      {cell}
                    </th>
                  ) : (
                    <td className={cn("num px-4 text-right", toneClass(row.tone?.[i]))} key={i}>
                      {cell}
                    </td>
                  )
                )}
              </tr>
            ))}
          </tbody>
        </table>
      );
    case "events":
      return (
        <ul className="divide-y divide-hairline rounded-[10px] border border-hairline px-4">
          {block.items.map((e) => (
            <EventRow event={e} key={`${e.ticker}-${e.kind}`} />
          ))}
        </ul>
      );
    case "suggestions":
      return (
        <div className="flex flex-wrap gap-2">
          {block.items.map((q) => (
            <button
              className="inline-flex h-8 items-center gap-1 rounded-full border border-edge px-3 text-[13px] text-ink-2 transition-colors duration-150 hover:border-brand-text hover:text-ink"
              key={q}
              onClick={() => ask(q)}
              type="button"
            >
              {q} <ArrowUpRight aria-hidden className="size-3.5 text-ink-muted" />
            </button>
          ))}
        </div>
      );
    default:
      return null;
  }
}

/* -------------------------------------------------------------------------- */
/* Streaming answer                                                           */
/* -------------------------------------------------------------------------- */

const WORD_MS = 34;
const WORD_JITTER_MS = 28;
const BLOCK_PAUSE_MS = 280;

const CARD_NAMES: Record<string, string> = {
  performance: "Performance",
  allocation: "Allocation",
  holdings: "Holdings",
  movers: "Top movers",
  risk: "Risk snapshot",
  events: "Upcoming events",
};

export function AIResponse({
  response,
  streaming,
  instant,
  onDone,
  ask,
  showOnDashboard,
}: {
  response: AIResponseData;
  /** Start revealing. When false and not `instant`, nothing is shown yet. */
  streaming: boolean;
  /** Show everything at once (finished turns, reduced motion). */
  instant: boolean;
  onDone: () => void;
  ask: (q: string) => void;
  showOnDashboard: (id: string) => void;
}) {
  const words = useMemo(
    () => response.blocks.map((b) => (b.type === "text" ? toWords(b.text) : [])),
    [response]
  );
  // Index of each block's first token in the flattened stream.
  const { starts, total } = useMemo(() => {
    const list: number[] = [];
    let acc = 0;
    for (const b of response.blocks) {
      list.push(acc);
      acc += blockTokens(b);
    }
    return { starts: list, total: acc };
  }, [response]);
  const [streamed, setStreamed] = useState(0);
  const revealed = instant ? total : streamed;
  const cards = response.highlights.filter((id) => id in CARD_NAMES);
  const finish = useEffectEvent(onDone);

  useEffect(() => {
    if (instant || !streaming) {
      return;
    }
    let cancelled = false;
    let timer = 0;
    let count = 0;

    // Walk the flattened token list: words tick quickly, data blocks pause.
    const isBlockToken = (index: number) => {
      const b = starts.findLastIndex((s) => s <= index);
      return response.blocks[b].type !== "text";
    };

    const tick = () => {
      if (cancelled) {
        return;
      }
      count += 1;
      setStreamed(count);
      if (count >= total) {
        finish();
        return;
      }
      const delay = isBlockToken(count) || isBlockToken(count - 1) ? BLOCK_PAUSE_MS : WORD_MS + Math.random() * WORD_JITTER_MS;
      timer = window.setTimeout(tick, delay);
    };
    timer = window.setTimeout(tick, 60);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [instant, streaming, response, starts, total]);

  // Instant turns (reduced motion) still report completion once.
  useEffect(() => {
    if (instant && streaming) {
      finish();
    }
  }, [instant, streaming]);

  return (
    <div className="flex flex-col gap-4">
      {response.blocks.map((block, index) => {
        const start = starts[index];
        if (revealed <= start) {
          return null;
        }
        if (block.type === "text") {
          return <TextBlock count={revealed - start} key={index} words={words[index]} />;
        }
        return (
          <div className="fade-in slide-in-from-bottom-2 animate-in duration-300" key={index}>
            <Block ask={ask} block={block} />
          </div>
        );
      })}
      {revealed >= total && cards.length > 0 ? (
        <div className="fade-in flex animate-in flex-wrap items-center gap-2 text-[13px] duration-300">
          <span className="text-ink-muted">Lit on your dashboard:</span>
          {cards.map((id) => (
            <button
              className="inline-flex h-7 items-center gap-1 rounded-full border border-brand-text/50 px-3 text-brand-text transition-colors duration-150 hover:border-brand-text hover:bg-brand/20"
              key={id}
              onClick={() => showOnDashboard(id)}
              type="button"
            >
              {CARD_NAMES[id]} <ArrowUpRight aria-hidden className="size-3.5" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
