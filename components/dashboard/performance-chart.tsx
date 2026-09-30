"use client";

import { type KeyboardEvent, type PointerEvent, useMemo, useState } from "react";
import { ResponsiveDither } from "@/components/charts/responsive-dither";
import { Cell, Delta } from "@/components/dashboard/cell";
import { Segmented } from "@/components/dashboard/segmented";
import { CHART_COLORS } from "@/data/ai-responses";
import { usePortfolio, useMoney } from "@/components/portfolio/portfolio-provider";
import { RANGE_KEYS, RANGE_LABELS, type RangeKey } from "@/data/portfolio";
import { shortDate, signedPct, time } from "@/lib/format";

const HEIGHT = 240;
const PALETTE = [CHART_COLORS.accent, CHART_COLORS.muted];

const tickLabel = (range: RangeKey, date: Date) =>
  range === "1D"
    ? time(date)
    : range === "1W"
      ? date.toLocaleDateString("en-US", { weekday: "short" })
      : range === "ALL" || range === "1Y"
        ? date.toLocaleDateString("en-US", { month: "short", year: "2-digit" })
        : shortDate(date);

export function PerformanceChart() {
  const { money, signedMoney, moneyCompact } = useMoney();
  const [range, setRange] = useState<RangeKey>("1W");
  const [scrub, setScrub] = useState<number | null>(null);
  const { portfolio } = usePortfolio();
  const series = portfolio.ranges[range];
  const { points } = series;

  // Memoised so the chart only redraws (and dithers in again) on range change.
  const { data, domain } = useMemo(() => {
    const values = points.flatMap((p) => [p.portfolio, p.benchmark]);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const pad = (max - min) * 0.12 || 1;
    return {
      domain: [min - pad, max + pad] as [number, number],
      data: [
        {
          name: "Portfolio",
          points: points.map((p) => ({ label: p.date.toISOString(), value: p.portfolio })),
        },
        {
          name: `${portfolio.benchmark.name} (rebased)`,
          points: points.map((p) => ({ label: p.date.toISOString(), value: p.benchmark })),
        },
      ],
    };
  }, [points, portfolio.benchmark.name]);

  const active = scrub === null ? null : points[scrub];
  const xOf = (i: number) => (i / (points.length - 1)) * 100;
  const yOf = (v: number) => (1 - (v - domain[0]) / (domain[1] - domain[0])) * 100;

  const onPointer = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
    setScrub(Math.round(ratio * (points.length - 1)));
  };

  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 5 : 1;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      const from = scrub ?? points.length - 1;
      const next = from + (event.key === "ArrowRight" ? step : -step);
      setScrub(Math.min(points.length - 1, Math.max(0, next)));
    } else if (event.key === "Escape") {
      setScrub(null);
    }
  };

  const ticks = [0, Math.floor((points.length - 1) / 2), points.length - 1];

  return (
    <Cell
      action={
        <Segmented
          label="Chart range"
          onChange={(next) => {
            setRange(next);
            setScrub(null);
          }}
          options={RANGE_KEYS}
          value={range}
        />
      }
      className="lg:order-1 lg:col-span-12 xl:order-none xl:col-span-8"
      id="performance"
      title="Performance"
    >
      <div className="flex flex-wrap items-end gap-x-8 gap-y-2">
        <div>
          <p className="eyebrow">Portfolio · {RANGE_LABELS[range]}</p>
          <p className="mt-1 flex items-baseline gap-2 text-[20px]">
            <Delta value={series.change}>{signedMoney(series.change)}</Delta>
            <Delta className="text-[14px]" value={series.changePct}>
              {signedPct(series.changePct)}
            </Delta>
          </p>
        </div>
        <div>
          <p className="eyebrow">{portfolio.benchmark.name}</p>
          <p className="mt-1 text-[20px]">
            <Delta value={series.benchmarkPct}>{signedPct(series.benchmarkPct)}</Delta>
          </p>
        </div>
        <div className="ml-auto flex items-center gap-4 text-[12px] text-ink-muted">
          <span className="flex items-center gap-2">
            <span aria-hidden className="size-2 rounded-full bg-brand-text" /> You
          </span>
          <span className="flex items-center gap-2">
            <span aria-hidden className="size-2 rounded-full bg-ink-subtle" /> {portfolio.benchmark.name}, rebased
          </span>
        </div>
      </div>

      <div className="relative">
        <div className="flex gap-3">
          <div
            aria-label={`Performance chart, ${RANGE_LABELS[range]}. Use left and right arrow keys to read values.`}
            className="relative min-w-0 flex-1 cursor-crosshair touch-pan-y rounded-[4px]"
            onBlur={() => setScrub(null)}
            onKeyDown={onKey}
            onPointerLeave={() => setScrub(null)}
            onPointerMove={onPointer}
            role="group"
            tabIndex={0}
          >
            <ResponsiveDither
              data={data}
              domain={domain}
              height={HEIGHT}
              matrix={4}
              palette={PALETTE}
              pixelSize={2}
              variant="line"
            />


            {active && scrub !== null ? (
              <>
                <span
                  aria-hidden
                  className="pointer-events-none absolute top-0 bottom-0 w-px bg-ink/40"
                  style={{ left: `${xOf(scrub)}%` }}
                />
                <span
                  aria-hidden
                  className="pointer-events-none absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-text ring-4 ring-brand/40"
                  style={{ left: `${xOf(scrub)}%`, top: `${yOf(active.portfolio)}%` }}
                />
                <div
                  className="pointer-events-none absolute top-2 z-[3] min-w-40 rounded-[8px] border border-hairline bg-surface px-3 py-2 text-[12px] shadow-[0_10px_20px_#0000000d]"
                  style={
                    xOf(scrub) > 60
                      ? { right: `${100 - xOf(scrub)}%`, marginRight: 12 }
                      : { left: `${xOf(scrub)}%`, marginLeft: 12 }
                  }
                >
                  <p className="text-ink-muted">
                    {range === "1D" || range === "1W"
                      ? `${shortDate(active.date)}, ${time(active.date)}`
                      : shortDate(active.date) + (range === "ALL" || range === "1Y" ? `, ${active.date.getFullYear()}` : "")}
                  </p>
                  <p className="num mt-1 flex justify-between gap-4 text-ink">
                    <span>You</span> <span>{money(active.portfolio)}</span>
                  </p>
                  <p className="num flex justify-between gap-4 text-ink-muted">
                    <span>{portfolio.benchmark.short}</span> <span>{money(active.benchmark)}</span>
                  </p>
                </div>
              </>
            ) : null}
          </div>
          {/* Axis extremes in their own gutter, like a terminal. */}
          <div aria-hidden className="num flex w-10 shrink-0 flex-col justify-between text-right text-[11px] text-ink-subtle">
            <span>{moneyCompact(domain[1])}</span>
            <span>{moneyCompact((domain[0] + domain[1]) / 2)}</span>
            <span>{moneyCompact(domain[0])}</span>
          </div>
        </div>

        <div aria-hidden className="mt-2 mr-[52px] flex justify-between text-[11px] text-ink-subtle">
          {ticks.map((i) => (
            <span key={i}>{tickLabel(range, points[i].date)}</span>
          ))}
        </div>

        <p aria-live="polite" className="sr-only">
          {active
            ? `${shortDate(active.date)}: portfolio ${money(active.portfolio)}, ${portfolio.benchmark.name} rebased ${money(active.benchmark)}`
            : ""}
        </p>
      </div>
    </Cell>
  );
}
