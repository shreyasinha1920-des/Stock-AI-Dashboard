"use client";

import { useMemo, useState } from "react";
import { BarHover } from "@/components/charts/bar-hover";
import { ResponsiveDither } from "@/components/charts/responsive-dither";
import { Cell } from "@/components/dashboard/cell";
import { Segmented } from "@/components/dashboard/segmented";
import { CHART_COLORS } from "@/data/ai-responses";
import { usePortfolio, useMoney } from "@/components/portfolio/portfolio-provider";
import { pct } from "@/lib/format";
import { cn } from "@/lib/utils";

const VIEWS = ["Sector", "Holding"] as const;
type View = (typeof VIEWS)[number];

const SHORT: Record<string, string> = {
  Technology: "Tech",
  Communication: "Comm.",
  "Consumer Disc.": "Disc.",
  "Broad Market": "Index",
  "Consumer Staples": "Staples",
  Financials: "Fin.",
  Healthcare: "Health",
  Energy: "Energy",
  Bonds: "Bonds",
  Other: "Other",
  Cash: "Cash",
};

export function AllocationChart() {
  const { moneyWhole } = useMoney();
  const [view, setView] = useState<View>("Sector");
  const { portfolio } = usePortfolio();
  const slices = view === "Sector" ? portfolio.sectorAllocation : portfolio.holdingAllocation;

  const { data, domain } = useMemo(
    () => ({
      data: [
        {
          name: `Weight by ${view.toLowerCase()}`,
          points: slices.map((s) => ({
            label: s.label,
            value: s.weight,
            color: s.tech ? CHART_COLORS.accent : CHART_COLORS.muted,
          })),
        },
      ],
      domain: [0, Math.max(10, Math.ceil(Math.max(0, ...slices.map((s) => s.weight)) / 10) * 10)] as [number, number],
    }),
    [slices, view]
  );

  return (
    <Cell
      action={<Segmented label="Allocation view" onChange={setView} options={VIEWS} value={view} />}
      className="lg:order-2 lg:col-span-6 xl:order-none xl:col-span-4"
      id="allocation"
      title="Allocation"
    >
      <div>
        <p className="eyebrow">Tech exposure</p>
        <p className="mt-1 flex items-baseline gap-2">
          <span className="num text-[28px] text-ink leading-none">{pct(portfolio.risk.techWeight, 1)}</span>
          <span className="text-[12px] text-ink-muted">
            {portfolio.risk.techTickers.length ? `across ${portfolio.risk.techTickers.length} holdings` : "none"}
          </span>
        </p>
      </div>

      <div>
        <BarHover
          labels={slices.map((s) => s.label)}
          values={slices.map((s) => `${pct(s.weight, 1)} · ${moneyWhole(s.value)}`)}
        >
          <ResponsiveDither data={data} domain={domain} height={132} matrix={4} pixelSize={3} variant="bar" />
        </BarHover>
        <div
          aria-hidden
          className="mt-2 grid text-center text-[11px] text-ink-muted"
          style={{ gridTemplateColumns: `repeat(${slices.length}, minmax(0, 1fr))` }}
        >
          {slices.map((s) => (
            <span className="truncate" key={s.label}>
              {view === "Sector" ? SHORT[s.label] : s.label}
            </span>
          ))}
        </div>
      </div>

      <ul className="grid grid-cols-2 gap-x-6 gap-y-2 text-[12px]">
        {(view === "Sector" ? slices : slices.slice(0, 6)).map((s) => (
          <li className="flex items-center justify-between gap-2" key={s.label}>
            <span className="flex min-w-0 items-center gap-2 text-ink-2">
              <span
                aria-hidden
                className={cn("size-1.5 shrink-0 rounded-full", s.tech ? "bg-brand-text" : "bg-ink-subtle")}
              />
              <span className="truncate">{s.label}</span>
            </span>
            <span className="num text-ink" title={moneyWhole(s.value)}>
              {pct(s.weight, 1)}
            </span>
          </li>
        ))}
      </ul>
    </Cell>
  );
}
