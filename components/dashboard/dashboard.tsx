"use client";

import { Pencil, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";
import { useAI } from "@/components/ai/ai-provider";
import { AllocationChart } from "@/components/dashboard/allocation-chart";
import { usePortfolio } from "@/components/portfolio/portfolio-provider";
import { HoldingsTable } from "@/components/dashboard/holdings-table";
import { PerformanceChart } from "@/components/dashboard/performance-chart";
import { PortfolioHero } from "@/components/dashboard/portfolio-hero";
import { RiskSnapshot } from "@/components/dashboard/risk-snapshot";
import { TopMovers } from "@/components/dashboard/top-movers";
import { UpcomingEvents } from "@/components/dashboard/upcoming-events";
import { AS_OF } from "@/data/portfolio";
import { EASE_ENTER, gsap, prefersReducedMotion, useGSAP } from "@/lib/motion";

const NAV = [
  { href: "#performance", label: "Performance" },
  { href: "#holdings", label: "Holdings" },
  { href: "#risk", label: "Risk" },
  { href: "#events", label: "Events" },
];

export function Dashboard() {
  const { open, summon } = useAI();
  const { portfolio, openEditor, editorOpen } = usePortfolio();
  const root = useRef<HTMLDivElement>(null);

  // Page entrance: the hero settles first, then the grid cells in reading order.
  // Charts dither themselves in as they scroll into view.
  useGSAP(
    () => {
      if (prefersReducedMotion()) {
        return;
      }
      const tl = gsap.timeline({ defaults: { duration: 0.3, ease: EASE_ENTER } });
      tl.fromTo("header[data-reveal]", { opacity: 0, y: -8 }, { opacity: 1, y: 0 }, 0)
        .fromTo(
          ".hero [data-reveal]",
          { opacity: 0, y: 16 },
          { opacity: 1, y: 0, duration: 0.5, stagger: 0.07 },
          0.1
        )
;
      // The hairline grid is already drawn; each cell's contents settle into it.
      gsap.utils.toArray<HTMLElement>(".cell").forEach((cell, i) => {
        tl.fromTo(
          cell.children,
          { opacity: 0, y: 12 },
          { opacity: 1, y: 0, duration: 0.5, stagger: 0.05 },
          0.35 + i * 0.07
        );
      });
    },
    { scope: root }
  );

  return (
    <div
      className="pointer-events-none relative z-[1] mx-auto w-full max-w-[1200px] px-8 max-md:px-4"
      inert={open || editorOpen}
      ref={root}
    >
      <header
        className="recede pointer-events-auto flex h-16 items-center justify-between gap-6"
        data-dimmed={open}
        data-reveal
      >
        <Link className="flex items-center gap-2 rounded-[6px]" href="/">
          <span aria-hidden className="grid size-5 grid-cols-2 gap-px">
            <span className="rounded-[1px] bg-ink" />
            <span className="rounded-[1px] bg-brand-text" />
            <span className="rounded-[1px] bg-brand" />
            <span className="rounded-[1px] bg-ink" />
          </span>
          <span className="font-display text-[22px] text-ink leading-none">Aurum</span>
        </Link>
        <nav aria-label="Sections" className="max-md:hidden">
          <ul className="flex items-center gap-1 text-[14px]">
            {NAV.map((item) => (
              <li key={item.href}>
                <a
                  className="rounded-[8px] px-3 py-2 text-ink-muted transition-colors duration-150 hover:text-ink"
                  href={item.href}
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-2">
        <button
          className="inline-flex h-8 items-center gap-2 rounded-[8px] border border-edge px-3 text-[13px] text-ink transition-colors duration-150 hover:border-brand-text"
          onClick={openEditor}
          type="button"
        >
          <Pencil aria-hidden className="size-3.5" />
          <span className="max-sm:sr-only">Edit portfolio</span>
        </button>
        <button
          aria-keyshortcuts="/"
          className="inline-flex h-8 items-center gap-2 rounded-[8px] bg-ink px-3 font-medium text-[13px] text-black transition-opacity duration-150 hover:opacity-90"
          onClick={summon}
          type="button"
        >
          <Sparkles aria-hidden className="size-3.5" />
          Ask Aurum
          <span className="kbd h-4 min-w-4 border-black/20 text-[11px] text-black/60 max-sm:hidden">/</span>
        </button>
        </div>
      </header>

      <main>
        <section aria-label="Portfolio summary" className="hero recede" data-dimmed={open}>
          <PortfolioHero />
        </section>

        <div className="grid-frame grid grid-cols-1 gap-px overflow-hidden rounded-[10px] border border-hairline bg-hairline lg:grid-cols-12">
          <PerformanceChart />
          <AllocationChart />
          <HoldingsTable />
          <TopMovers />
          <RiskSnapshot />
          <UpcomingEvents />
        </div>
      </main>

      <footer className="pointer-events-auto flex flex-wrap items-center justify-between gap-4 py-8 text-[12px] text-ink-subtle">
        <p>
          {portfolio.isSample
            ? "Sample portfolio, mock prices."
            : portfolio.source
              ? "Holdings and prices from your file; earlier moves are simulated."
              : "Your holdings, mock prices; earlier moves are simulated."}{" "}
          Not financial advice.
        </p>
        <p>
          Prices as of{" "}
          {AS_OF.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}, 4:00 PM ET
        </p>
      </footer>
    </div>
  );
}
