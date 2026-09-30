"use client";

import { type ReactNode, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Hover layer for dithered bar charts. The canvas can't be restyled per bar,
 * so this lays one column per bar over it: the hovered bar stays bright, the
 * rest dim, and a tooltip shows the exact value. Screen readers already get
 * every value from the chart's own text alternative, so this is aria-hidden.
 */
export function BarHover({
  labels,
  values,
  children,
}: {
  labels: string[];
  values: string[];
  children: ReactNode;
}) {
  const [active, setActive] = useState<number | null>(null);
  const count = labels.length;

  return (
    <div className="relative" onPointerLeave={() => setActive(null)}>
      {children}
      <div
        aria-hidden
        className="absolute inset-0 grid"
        style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}
      >
        {labels.map((label, i) => (
          <div
            className={cn(
              "relative transition-colors duration-150",
              active !== null && active !== i && "bg-black/60"
            )}
            key={`${label}-${i}`}
            onPointerEnter={() => setActive(i)}
          >
            {active === i ? (
              <span
                className={cn(
                  "pointer-events-none absolute -top-2 z-[3] -translate-y-full whitespace-nowrap rounded-[6px] border border-edge bg-surface px-2 py-1 text-[12px] text-ink shadow-[0_10px_20px_#0000000d]",
                  i < count / 3 ? "left-0" : i > (count * 2) / 3 ? "right-0" : "left-1/2 -translate-x-1/2"
                )}
              >
                <span className="text-ink-2">{label}</span> <span className="num">{values[i]}</span>
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
