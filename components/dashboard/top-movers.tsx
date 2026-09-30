"use client";

import { useState } from "react";
import { Cell, Delta } from "@/components/dashboard/cell";
import { Segmented } from "@/components/dashboard/segmented";
import { usePortfolio, useMoney } from "@/components/portfolio/portfolio-provider";
import type { Holding } from "@/data/portfolio";
import { signedPct } from "@/lib/format";

const PERIODS = ["Today", "This month"] as const;
type Period = (typeof PERIODS)[number];

function MoverRow({ holding, period }: { holding: Holding; period: Period }) {
  const { signedMoney } = useMoney();
  const changePct = period === "Today" ? holding.dayChangePct : holding.monthChangePct;
  const change = period === "Today" ? holding.dayChange : holding.monthChange;
  return (
    <li className="flex h-10 items-center justify-between gap-3">
      <span className="min-w-0">
        <span className="font-medium text-[13px] text-ink">{holding.ticker}</span>
        <span className="ml-2 truncate text-[12px] text-ink-muted max-sm:hidden">{holding.name}</span>
      </span>
      <span className="flex items-baseline gap-3 text-[13px]">
        <Delta className="text-[12px]" value={change}>
          {signedMoney(change)}
        </Delta>
        <Delta className="w-16 text-right" value={changePct}>
          {signedPct(changePct, 1)}
        </Delta>
      </span>
    </li>
  );
}

export function TopMovers() {
  const [period, setPeriod] = useState<Period>("Today");
  const { portfolio } = usePortfolio();
  const ranked = period === "Today" ? portfolio.movers.day : portfolio.movers.month;
  // Split small portfolios so no holding shows up in both lists.
  const bestCount = Math.min(3, Math.ceil(ranked.length / 2));
  const best = ranked.slice(0, bestCount);
  const worst = ranked.slice(bestCount).reverse().slice(0, 3);

  return (
    <Cell
      action={<Segmented label="Movers period" onChange={setPeriod} options={PERIODS} value={period} />}
      className="lg:order-5 lg:col-span-6 xl:order-none xl:col-span-4"
      id="movers"
      title="Top movers"
    >
      <div className="flex flex-col gap-4">
        <div>
          <h3 className="eyebrow">Best</h3>
          <ul className="mt-1 divide-y divide-hairline">
            {best.map((h) => (
              <MoverRow holding={h} key={h.ticker} period={period} />
            ))}
          </ul>
        </div>
        {worst.length ? (
        <div>
          <h3 className="eyebrow">Worst</h3>
          <ul className="mt-1 divide-y divide-hairline">
            {worst.map((h) => (
              <MoverRow holding={h} key={h.ticker} period={period} />
            ))}
          </ul>
        </div>
        ) : null}
        {ranked.length === 0 ? <p className="text-[13px] text-ink-muted">No holdings yet.</p> : null}
      </div>
    </Cell>
  );
}
