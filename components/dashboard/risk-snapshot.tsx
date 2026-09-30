"use client";

import { useMemo } from "react";
import { Cell } from "@/components/dashboard/cell";
import DitherChart from "@/components/ui/smoothui/dither-chart";
import { CHART_COLORS } from "@/data/ai-responses";
import { usePortfolio } from "@/components/portfolio/portfolio-provider";
import { diversificationLabel, volatilityLabel } from "@/data/portfolio";
import { pct } from "@/lib/format";
import { cn } from "@/lib/utils";

const GAUGE_PALETTE = [CHART_COLORS.accent];

/** Ten-step meter, like a battery indicator. */
function Meter({ value, tone }: { value: number; tone: "warn" | "ok" }) {
  return (
    <span aria-hidden className="flex gap-0.5">
      {Array.from({ length: 10 }, (_, i) => (
        <span
          className={cn(
            "h-3 w-1.5 rounded-[1px]",
            i < Math.round(value) ? (tone === "warn" ? "bg-warn" : "bg-brand-text") : "bg-hairline"
          )}
          key={i}
        />
      ))}
    </span>
  );
}

export function RiskSnapshot() {
  const { portfolio } = usePortfolio();
  const RISK = portfolio.risk;
  const gauge = useMemo(
    () => [{ name: "Tech exposure", points: [{ label: "Tech", value: RISK.techWeight }] }],
    [RISK.techWeight]
  );
  const vol = volatilityLabel(RISK.volatilityScore);
  const div = diversificationLabel(RISK.diversificationScore);

  return (
    <Cell className="lg:order-3 lg:col-span-6 xl:order-none xl:col-span-4" id="risk" title="Risk snapshot">
      <div className="flex items-center gap-6">
        <div className="relative size-[112px] shrink-0">
          <DitherChart
            className="flex"
            data={gauge}
            height={112}
            label={undefined}
            matrix={4}
            palette={GAUGE_PALETTE}
            pixelSize={2}
            variant="gauge"
            width={112}
          />
          <span className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="num text-[20px] text-ink leading-none">{Math.round(RISK.techWeight)}%</span>
            <span className="mt-1 text-[10px] text-ink-muted">tech</span>
          </span>
        </div>
        <p className="text-[13px] text-ink-2 leading-5">
          {RISK.techWeight >= 40
            ? "Concentration is your biggest risk. Most of the portfolio moves with one group of stocks."
            : RISK.largestStock && RISK.largestStock.weight >= 15
              ? `${RISK.largestStock.ticker} is your largest single exposure.`
              : "No single group or stock dominates the portfolio."}
        </p>
      </div>

      <dl className="grid grid-cols-1 divide-y divide-hairline text-[13px]">
        <div className="flex h-11 items-center justify-between gap-3">
          <dt className="text-ink-muted">Top 3 positions</dt>
          <dd className="text-right">
            <span className="num text-ink">{pct(RISK.topThreeWeight, 1)}</span>
            <span className="ml-2 text-[12px] text-ink-muted">{RISK.topThree.join(", ")}</span>
          </dd>
        </div>
        <div className="flex h-11 items-center justify-between gap-3">
          <dt className="text-ink-muted">Largest single stock</dt>
          <dd>
            {RISK.largestStock ? (
              <>
                <span className="num text-ink">{pct(RISK.largestStock.weight, 1)}</span>
                <span className="ml-2 text-[12px] text-ink-muted">{RISK.largestStock.ticker}</span>
              </>
            ) : (
              <span className="text-ink-muted">None, funds only</span>
            )}
          </dd>
        </div>
        <div className="flex h-11 items-center justify-between gap-3">
          <dt className="text-ink-muted">Volatility</dt>
          <dd className="flex items-center gap-3">
            <Meter tone="warn" value={RISK.volatilityScore} />
            <span className="num w-16 text-right text-ink">{RISK.volatilityScore.toFixed(1)}/10</span>
            <span className="sr-only">
              {vol}, beta {RISK.beta.toFixed(2)}
            </span>
          </dd>
        </div>
        <div className="flex h-11 items-center justify-between gap-3">
          <dt className="text-ink-muted">Diversification</dt>
          <dd className="flex items-center gap-3">
            <Meter tone="ok" value={RISK.diversificationScore} />
            <span className="num w-16 text-right text-ink">{RISK.diversificationScore.toFixed(1)}/10</span>
            <span className="sr-only">{div}</span>
          </dd>
        </div>
      </dl>
      <p className="-mt-2 text-[12px] text-ink-muted">
        Volatility {vol.toLowerCase()} · beta {RISK.beta.toFixed(2)} · diversification {div.toLowerCase()}
      </p>
    </Cell>
  );
}
