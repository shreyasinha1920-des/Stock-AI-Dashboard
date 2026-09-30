"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { memo, useMemo, useState } from "react";
import { useAI } from "@/components/ai/ai-provider";
import { Cell, Delta } from "@/components/dashboard/cell";
import DitherChart from "@/components/ui/smoothui/dither-chart";
import { CHART_COLORS } from "@/data/ai-responses";
import { usePortfolio, useMoney } from "@/components/portfolio/portfolio-provider";
import type { Holding } from "@/data/portfolio";
import { pct, signedPct } from "@/lib/format";
import { cn } from "@/lib/utils";

type SortKey = "ticker" | "value" | "dayChangePct" | "totalReturnPct" | "weight";

const COLUMNS: { key: SortKey | null; label: string; align: "left" | "right"; className?: string }[] = [
  { key: "ticker", label: "Holding", align: "left" },
  { key: null, label: "Shares", align: "right", className: "max-xl:hidden" },
  { key: null, label: "Avg cost", align: "right", className: "max-xl:hidden" },
  { key: null, label: "Price", align: "right" },
  { key: "value", label: "Market value", align: "right" },
  { key: "dayChangePct", label: "Day", align: "right" },
  { key: "totalReturnPct", label: "Total return", align: "right" },
  { key: "weight", label: "Weight", align: "right" },
  { key: null, label: "1M", align: "right", className: "max-md:hidden" },
];

/** 1-month dither sparkline. Memoised: its data never changes. */
const Sparkline = memo(function Sparkline({ holding }: { holding: Holding }) {
  const data = useMemo(
    () => [{ name: `${holding.ticker} 1M`, points: holding.spark.map((value) => ({ value })) }],
    [holding]
  );
  const palette = useMemo(
    () => [holding.monthChangePct >= 0 ? CHART_COLORS.up : CHART_COLORS.down],
    [holding.monthChangePct]
  );
  const domain = useMemo(() => {
    const min = Math.min(...holding.spark);
    const max = Math.max(...holding.spark);
    return [min - (max - min) * 0.1, max + (max - min) * 0.1] as [number, number];
  }, [holding.spark]);
  return (
    <DitherChart
      className="flex"
      data={data}
      domain={domain}
      height={28}
      label={undefined}
      matrix={2}
      palette={palette}
      pixelSize={2}
      variant="line"
      width={88}
    />
  );
});

export function HoldingsTable() {
  const { money, signedMoney } = useMoney();
  const { open, highlights } = useAI();
  const { portfolio, openEditor } = usePortfolio();
  const { holdings, cash, totals } = portfolio;
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "value", dir: "desc" });

  const rows = useMemo(() => {
    const sorted = [...holdings].sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      const cmp = typeof av === "string" ? av.localeCompare(bv as string) : (av as number) - (bv as number);
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [holdings, sort]);

  const toggle = (key: SortKey) =>
    setSort((s) => ({ key, dir: s.key === key && s.dir === "desc" ? "asc" : "desc" }));

  return (
    <Cell
      action={
        <p className="text-[12px] text-ink-muted">
          {holdings.length} {holdings.length === 1 ? "position" : "positions"}
          {cash > 0 ? " + cash" : ""} · <span className="num">{money(totals.value)}</span>
        </p>
      }
      className="lg:order-4 lg:col-span-12 xl:order-none"
      id="holdings"
      title="Holdings"
    >
      <div className="-mx-6 overflow-x-auto max-md:-mx-4">
        <table className="w-full min-w-[640px] border-collapse text-[13px]">
          <caption className="sr-only">
            Holdings, sorted by {sort.key} {sort.dir === "desc" ? "descending" : "ascending"}
          </caption>
          <thead>
            <tr className="border-hairline border-b">
              {COLUMNS.map((col) => (
                <th
                  aria-sort={
                    col.key && sort.key === col.key
                      ? sort.dir === "desc"
                        ? "descending"
                        : "ascending"
                      : undefined
                  }
                  className={cn(
                    "h-9 px-3 font-normal text-[12px] text-ink-muted first:pl-6 last:pr-6 max-md:first:pl-4 max-md:last:pr-4",
                    col.align === "right" ? "text-right" : "text-left",
                    col.className
                  )}
                  key={col.label}
                  scope="col"
                >
                  {col.key ? (
                    <button
                      className={cn(
                        "inline-flex items-center gap-1 rounded-[4px] transition-colors duration-150 hover:text-ink",
                        sort.key === col.key && "text-ink"
                      )}
                      onClick={() => toggle(col.key as SortKey)}
                      type="button"
                    >
                      {col.label}
                      {sort.key === col.key ? (
                        sort.dir === "desc" ? (
                          <ArrowDown aria-hidden className="size-3" />
                        ) : (
                          <ArrowUp aria-hidden className="size-3" />
                        )
                      ) : null}
                    </button>
                  ) : (
                    col.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((h) => {
              const lit = open && highlights.has(h.ticker);
              return (
                <tr
                  className={cn(
                    "group border-hairline border-b transition-[background-color,box-shadow] duration-300 hover:bg-surface",
                    lit && "row-lit"
                  )}
                  data-lit={lit || undefined}
                  key={h.ticker}
                >
                  <th className="h-14 py-2 pr-3 pl-6 text-left font-normal max-md:pl-4" scope="row">
                    <span className="block font-medium text-ink">{h.ticker}</span>
                    <span className="block max-w-44 truncate text-[12px] text-ink-muted">{h.name}</span>
                  </th>
                  <td className="num px-3 text-right text-ink-2 max-xl:hidden">{h.shares}</td>
                  <td className="num px-3 text-right text-ink-2 max-xl:hidden">{h.costUnknown ? "—" : money(h.avgCost)}</td>
                  <td className="num px-3 text-right text-ink">{money(h.price)}</td>
                  <td className="num px-3 text-right text-ink">{money(h.value)}</td>
                  <td className="px-3 text-right">
                    <Delta className="block" value={h.dayChangePct}>
                      {signedPct(h.dayChangePct)}
                    </Delta>
                    <Delta className="block text-[12px]" value={h.dayChange}>
                      {signedMoney(h.dayChange)}
                    </Delta>
                  </td>
                  <td className="px-3 text-right">
                    {h.costUnknown ? (
                      <>
                        <span className="block text-ink-2">—</span>
                        <span className="block text-[12px] text-warn">no cost</span>
                      </>
                    ) : (
                      <>
                        <Delta className="block" value={h.totalReturnPct}>
                          {signedPct(h.totalReturnPct, 1)}
                        </Delta>
                        <Delta className="block text-[12px]" value={h.totalReturn}>
                          {signedMoney(h.totalReturn)}
                        </Delta>
                      </>
                    )}
                  </td>
                  <td className="px-3 text-right">
                    <span className="num block text-ink">{pct(h.weight, 1)}</span>
                    <span aria-hidden className="mt-1 ml-auto block h-0.5 w-16 bg-hairline">
                      <span
                        className={cn("block h-full", h.tech ? "bg-brand-text" : "bg-ink-subtle")}
                        style={{ width: `${Math.min(100, (h.weight / 20) * 100)}%` }}
                      />
                    </span>
                  </td>
                  <td className="py-2 pr-6 pl-3 max-md:hidden">
                    <div className="ml-auto w-[88px]">
                      <Sparkline holding={h} />
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 ? (
              <tr className="border-hairline border-b">
                <td className="h-16 px-6 text-ink-2 max-md:px-4" colSpan={COLUMNS.length}>
                  No holdings yet.{" "}
                  <button className="text-brand-text underline-offset-4 hover:underline" onClick={openEditor} type="button">
                    Add your portfolio
                  </button>
                </td>
              </tr>
            ) : null}
            {cash > 0 ? (
            <tr className="border-hairline border-b">
              <th className="h-12 py-2 pr-3 pl-6 text-left font-normal max-md:pl-4" scope="row">
                <span className="block font-medium text-ink">Cash</span>
                <span className="block text-[12px] text-ink-muted">USD</span>
              </th>
              <td className="max-xl:hidden" />
              <td className="max-xl:hidden" />
              <td />
              <td className="num px-3 text-right text-ink">{money(cash)}</td>
              <td className="num px-3 text-right text-ink-muted">—</td>
              <td className="num px-3 text-right text-ink-muted">—</td>
              <td className="num px-3 text-right text-ink">{pct(totals.value > 0 ? (cash / totals.value) * 100 : 0, 1)}</td>
              <td className="max-md:hidden" />
            </tr>
            ) : null}
          </tbody>
          <tfoot>
            <tr>
              <th className="h-12 pr-3 pl-6 text-left font-medium text-ink max-md:pl-4" scope="row">
                Total
              </th>
              <td className="max-xl:hidden" />
              <td className="max-xl:hidden" />
              <td />
              <td className="num px-3 text-right font-medium text-ink">{money(totals.value)}</td>
              <td className="px-3 text-right">
                <Delta value={totals.dayChangePct}>{signedPct(totals.dayChangePct)}</Delta>
              </td>
              <td className="px-3 text-right">
                <Delta value={totals.allTimeReturnPct}>{signedPct(totals.allTimeReturnPct, 1)}</Delta>
              </td>
              <td className="num px-3 text-right text-ink">100%</td>
              <td className="max-md:hidden" />
            </tr>
          </tfoot>
        </table>
      </div>
    </Cell>
  );
}
