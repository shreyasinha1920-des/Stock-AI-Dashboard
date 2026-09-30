import { diversificationLabel, type Portfolio, type UpcomingEvent, volatilityLabel } from "@/data/portfolio";
import { type IntentId, matchIntent } from "@/lib/intent";
import { makeMoney, pct, shortDate, signedPct } from "@/lib/format";

/* -------------------------------------------------------------------------- */
/* Response shape                                                             */
/* -------------------------------------------------------------------------- */

export type Tone = "up" | "down" | "neutral";

export type ResponseBlock =
  | { type: "text"; text: string }
  | {
      type: "metrics";
      items: { label: string; value: string; detail?: string; tone?: Tone }[];
    }
  | {
      type: "chart";
      title: string;
      variant: "bar" | "line";
      series: {
        name: string;
        color: string;
        points: { label: string; value: number; color?: string }[];
      }[];
      /** Explicit value domain; lets bars diverge around zero. */
      domain?: [number, number];
      /** Labels under the x axis, one per point (or start/end for lines). */
      axis: string[];
      legend?: { label: string; color: string }[];
      caption: string;
      /** Formats values for labels, tooltips and the screen-reader description. */
      unit: "usd" | "pct";
    }
  | {
      type: "holdings";
      rows: { ticker: string; name: string; primary: string; secondary: string; tone: Tone }[];
    }
  | {
      type: "table";
      columns: string[];
      rows: { cells: string[]; tone?: Tone[] }[];
    }
  | { type: "events"; items: UpcomingEvent[] }
  | { type: "suggestions"; items: string[] };

export interface AIResponseData {
  intent: IntentId;
  /** Short title shown on the "Last insight" card. */
  title: string;
  /** One-sentence takeaway shown on the "Last insight" card. */
  summary: string;
  /** Dashboard card ids and tickers to light up while this answer is on screen. */
  highlights: string[];
  blocks: ResponseBlock[];
}

/* -------------------------------------------------------------------------- */
/* Palette (from the design tokens)                                           */
/* -------------------------------------------------------------------------- */

export const CHART_COLORS = {
  accent: "#0099ff",
  ink: "#ffffff",
  muted: "#888888",
  up: "#00bb88",
  down: "#d67a5c",
};

const toneOf = (value: number): Tone => (value > 0 ? "up" : value < 0 ? "down" : "neutral");

/** "A", "A and B", "A, B and C". */
const list = (items: string[]) =>
  items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;

/** Rounds a chart bound outward to a tidy step. */
const niceCeil = (value: number, step: number) => Math.ceil(value / step) * step;

/* -------------------------------------------------------------------------- */
/* Suggestions                                                                */
/* -------------------------------------------------------------------------- */

export const SUGGESTED_QUESTIONS = [
  "Why did my portfolio drop?",
  "Which stocks are performing best?",
  "What are my biggest risks?",
  "How am I doing vs the market?",
  "What's coming up this week?",
];

export const QUESTION_BY_INTENT: Record<IntentId, string> = {
  drop: SUGGESTED_QUESTIONS[0],
  best: SUGGESTED_QUESTIONS[1],
  risk: SUGGESTED_QUESTIONS[2],
  benchmark: SUGGESTED_QUESTIONS[3],
  events: SUGGESTED_QUESTIONS[4],
  fallback: SUGGESTED_QUESTIONS[0],
};

/* -------------------------------------------------------------------------- */
/* Surface copy: hero headline and "Aurum noticed"                            */
/* -------------------------------------------------------------------------- */

/** The two biggest weekly drags and what share of the drop they explain. */
function weeklyDrivers(p: Portfolio) {
  const drags = p.weekContributions.filter((h) => h.weekChange < 0);
  const gainers = p.weekContributions.filter((h) => h.weekChange > 0).reverse();
  const top = drags.slice(0, 2);
  const topSum = top.reduce((acc, h) => acc + h.weekChange, 0);
  const share = p.totals.weekChange < 0 ? Math.min(100, (topSum / p.totals.weekChange) * 100) : 0;
  return { drags, gainers, top, share };
}

export function headlineFor(p: Portfolio): string {
  if (p.holdings.length === 0) {
    return "Add your holdings and I'll explain every move.";
  }
  const { top, share, gainers } = weeklyDrivers(p);
  if (p.totals.weekChange >= 0) {
    return `A good week. You're up ${pct(p.totals.weekChangePct, 1)}, led by ${gainers[0]?.ticker ?? "your holdings"}.`;
  }
  if (top.length === 2 && share >= 50) {
    return gainers.length
      ? "A rough week, mostly from two names. Your defensive holdings did their job."
      : "A rough week, mostly from two names.";
  }
  return "A down week, with the losses spread across the portfolio.";
}

export interface Observation {
  text: string;
  question: string;
  cta: string;
}

export function noticedFor(p: Portfolio): Observation[] {
  const out: Observation[] = [];
  if (p.holdings.length === 0) {
    return out;
  }
  const { top, share } = weeklyDrivers(p);
  if (p.totals.weekChange < 0 && top.length === 2) {
    out.push({
      text: `${top[0].ticker} and ${top[1].ticker} drove ${Math.round(share)}% of this week's drop.`,
      question: QUESTION_BY_INTENT.drop,
      cta: "Ask why",
    });
  } else if (p.totals.weekChange < 0 && top.length === 1) {
    out.push({ text: `${top[0].ticker} drove this week's drop.`, question: QUESTION_BY_INTENT.drop, cta: "Ask why" });
  } else {
    const best = p.movers.allTime[0];
    out.push({
      text:
        best.totalReturnPct > 0
          ? `${best.ticker} is your best performer, ${signedPct(best.totalReturnPct, 0)} since you bought.`
          : `Everything is below its purchase price. ${best.ticker} is closest, at ${signedPct(best.totalReturnPct, 0)}.`,
      question: QUESTION_BY_INTENT.best,
      cta: "See leaders",
    });
  }
  const largest = p.risk.largestStock;
  if (p.risk.techWeight >= 40) {
    out.push({
      text: `Tech is ${pct(p.risk.techWeight, 0)} of your portfolio.${largest ? ` ${largest.ticker} alone is ${pct(largest.weight, 1)}.` : ""}`,
      question: QUESTION_BY_INTENT.risk,
      cta: "See risks",
    });
  } else if (largest && largest.weight >= 15) {
    out.push({
      text:
        largest.weight > 99
          ? `Your whole portfolio is in ${largest.ticker}.`
          : `${largest.ticker} is ${pct(largest.weight, 1)} of your portfolio, your largest single position.`,
      question: QUESTION_BY_INTENT.risk,
      cta: "See risks",
    });
  } else if (p.hasEventsCalendar && p.thisWeek.length) {
    out.push({
      text: `${p.thisWeek.length} ${p.thisWeek.length === 1 ? "event" : "events"} for your holdings in the next 7 days.`,
      question: QUESTION_BY_INTENT.events,
      cta: "See what's next",
    });
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* Builders                                                                   */
/* -------------------------------------------------------------------------- */

function emptyPortfolio(intent: IntentId): AIResponseData {
  return {
    intent,
    title: "No holdings yet",
    summary: "Add holdings to get answers about your portfolio.",
    highlights: [],
    blocks: [
      {
        type: "text",
        text: "You haven't added any holdings yet, so there's nothing to analyse. Use **Edit portfolio** at the top of the page to enter what you own.",
      },
    ],
  };
}

function contributionChart(p: Portfolio): ResponseBlock {
  const m = makeMoney(p.currency);
  const rows = p.weekContributions;
  const low = Math.min(0, ...rows.map((h) => h.weekChange));
  const high = Math.max(0, ...rows.map((h) => h.weekChange));
  const step = Math.max(100, niceCeil(Math.max(-low, high) / 4, 100));
  return {
    type: "chart",
    title: "Contribution to this week's change",
    variant: "bar",
    unit: "usd",
    domain: [low < 0 ? -niceCeil(-low, step) : 0, high > 0 ? niceCeil(high, step) : step / 2],
    series: [
      {
        name: "Change this week",
        color: CHART_COLORS.down,
        points: rows.map((h) => ({
          label: h.ticker,
          value: h.weekChange,
          color: h.weekChange >= 0 ? CHART_COLORS.up : CHART_COLORS.down,
        })),
      },
    ],
    axis: rows.map((h) => h.ticker),
    caption: `Dollar change per holding this week. Bars sum to ${m.signedMoney(p.totals.weekChange)}.`,
  };
}

function whyDrop(p: Portfolio): AIResponseData {
  const m = makeMoney(p.currency);
  const { drags, gainers, top, share } = weeklyDrivers(p);
  const t = p.totals;
  const market = p.benchmark.returns.week;

  if (t.weekChange >= 0) {
    return {
      intent: "drop",
      title: "This week's change",
      summary: `Up ${pct(t.weekChangePct)} this week while the ${p.benchmark.name} fell ${pct(Math.abs(market))}.`,
      highlights: ["holdings", "performance", ...gainers.slice(0, 3).map((h) => h.ticker)],
      blocks: [
        {
          type: "text",
          text: `Good news: your portfolio isn't down this week. It's up **${pct(t.weekChangePct)}**, a gain of **${m.moneyWhole(t.weekChange)}**, while the ${p.benchmark.name} fell ${pct(Math.abs(market))}.`,
        },
        contributionChart(p),
        {
          type: "text",
          text: gainers.length
            ? `${list(gainers.slice(0, 3).map((h) => h.ticker))} did the most work.${drags.length ? ` ${list(drags.slice(0, 2).map((h) => h.ticker))} slipped, but not enough to matter.` : ""}`
            : "Nothing moved much; most of the portfolio held steady.",
        },
      ],
    };
  }

  const reasons = top.map((h) => {
    const move = `**${pct(Math.abs(h.weekChangePct), 1)}**`;
    return h.note ? `${h.name} ${h.note.replace("{pct}", move)}` : `${h.name} fell ${move}.`;
  });
  if (top.length === 2) {
    reasons.push(`Together they account for **${Math.round(share)}%** of the decline.`);
  }

  const growthDrags = drags.filter((h) => h.beta >= 1.2 && !top.includes(h)).slice(0, 3);
  const context: string[] = [];
  if (growthDrags.length && p.market === "US") {
    context.push(`The rate-cut delay also weighed on growth stocks, so ${list(growthDrags.map((h) => h.ticker))} slipped too.`);
  }
  context.push(
    gainers.length
      ? `Your steadier names held up: ${list(gainers.slice(0, 3).map((h) => h.ticker))} rose.`
      : "Nothing in the portfolio rose this week."
  );

  const ratio = t.weekChangePct / market;
  const vsMarket =
    ratio > 1.2
      ? `Your portfolio fell about ${ratio.toFixed(1)}× as much, because it leans harder into what sold off.`
      : ratio < 0.8
        ? "You fell less than the market."
        : "You moved roughly in line with the market.";

  return {
    intent: "drop",
    title: "Why the portfolio fell",
    summary:
      top.length === 2
        ? `Down ${pct(Math.abs(t.weekChangePct))} this week. ${top[0].ticker} and ${top[1].ticker} explain ${Math.round(share)}% of the ${m.moneyWhole(Math.abs(t.weekChange))} drop.`
        : `Down ${pct(Math.abs(t.weekChangePct))} this week, a loss of ${m.moneyWhole(Math.abs(t.weekChange))}.`,
    highlights: ["holdings", "performance", ...top.map((h) => h.ticker)],
    blocks: [
      {
        type: "text",
        text: `Your portfolio is down **${pct(Math.abs(t.weekChangePct))}** this week, a loss of **${m.moneyWhole(Math.abs(t.weekChange))}**. ${
          top.length === 2 && share >= 50 ? "Most of it came from two names." : "The losses were spread across several holdings."
        }`,
      },
      {
        type: "metrics",
        items: [
          { label: "This week", value: m.signedMoney(t.weekChange), detail: signedPct(t.weekChangePct), tone: "down" },
          ...top.map((h) => ({
            label: h.ticker,
            value: m.signedMoney(h.weekChange),
            detail: signedPct(h.weekChangePct, 1),
            tone: "down" as Tone,
          })),
        ],
      },
      { type: "text", text: reasons.join(" ") },
      contributionChart(p),
      { type: "text", text: context.join(" ") },
      {
        type: "text",
        text: `For context, the ${p.benchmark.name} fell **${pct(Math.abs(market))}** over the same week. ${vsMarket}`,
      },
    ],
  };
}

function bestPerformers(p: Portfolio): AIResponseData {
  const m = makeMoney(p.currency);
  // Holdings without a purchase price have no real return to rank, and liquid
  // funds are cash parking, not investments that "perform".
  const ranked = p.movers.allTime.filter((h) => !h.costUnknown && h.sector !== "Liquid");
  const missing = p.holdings.length - ranked.length;
  if (ranked.length === 0) {
    return {
      intent: "best",
      title: "Top performers",
      summary: "Add purchase prices to rank your holdings.",
      highlights: ["holdings"],
      blocks: [
        {
          type: "text",
          text: "Your statement didn't include purchase prices, so I can't work out returns yet. Add your average cost for each holding in **Edit portfolio** and ask again.",
        },
      ],
    };
  }
  const top = ranked.slice(0, 3);
  const [first] = top;
  const monthTop = p.movers.month.filter((h) => h.monthChangePct > 0).slice(0, 2);
  const max = Math.max(0, ...top.map((h) => h.totalReturnPct));
  const min = Math.min(0, ...top.map((h) => h.totalReturnPct));
  const count = top.length === 1 ? "only" : top.length === 2 ? "two strongest" : "three strongest";

  const blocks: ResponseBlock[] = [
    {
      type: "text",
      text:
        top.length === 1
          ? `Measured by total return since you bought, your only holding is **${first.ticker}**.`
          : `Measured by total return since you bought, your ${count} holdings are ${list(top.map((h) => `**${h.ticker}**`))}.`,
    },
    {
      type: "chart",
      title: "Total return since purchase",
      variant: "bar",
      unit: "pct",
      domain: [min < 0 ? -niceCeil(-min, 10) : 0, max > 0 ? niceCeil(max, 20) : 10],
      series: [
        {
          name: "Total return",
          color: CHART_COLORS.accent,
          points: top.map((h, i) => ({
            label: h.ticker,
            value: h.totalReturnPct,
            color: h.totalReturnPct < 0 ? CHART_COLORS.down : i === 0 ? CHART_COLORS.accent : CHART_COLORS.ink,
          })),
        },
      ],
      axis: top.map((h) => h.ticker),
      caption: `Return on cost basis. Portfolio average: ${signedPct(p.totals.allTimeReturnPct, 1)}.${
        missing ? ` ${missing} ${missing === 1 ? "holding has" : "holdings have"} no purchase price and ${missing === 1 ? "isn't" : "aren't"} ranked.` : ""
      }`,
    },
    {
      type: "holdings",
      rows: top.map((h) => ({
        ticker: h.ticker,
        name: h.name,
        primary: signedPct(h.totalReturnPct, 1),
        secondary: `${m.signedMoney(h.totalReturn)} on ${m.moneyWhole(h.costBasis)}`,
        tone: toneOf(h.totalReturnPct),
      })),
    },
    {
      type: "text",
      text:
        first.totalReturnPct <= 0
          ? "Nothing is above its purchase price yet, so these are the smallest losses."
          : first.weekChangePct < -2
            ? `${first.name} is the standout. Even after this week's **${pct(Math.abs(first.weekChangePct), 1)}** drop, it's up **${pct(first.totalReturnPct, 0)}** and has added ${m.moneyWhole(first.totalReturn)} to the portfolio.`
            : `${first.name} is the standout, up **${pct(first.totalReturnPct, 0)}**, which has added ${m.moneyWhole(first.totalReturn)} to the portfolio.`,
    },
  ];

  if (monthTop.length) {
    const same = monthTop.every((h) => top.includes(h));
    blocks.push({
      type: "text",
      text: `Over the past month the leaders are ${same ? "the same" : "different"}: ${list(
        monthTop.map((h) => `${h.ticker} is up ${pct(h.monthChangePct, 1)}`)
      )}.${same ? "" : " Your steadier names have been doing the work lately."}`,
    });
  }

  return {
    intent: "best",
    title: "Top performers",
    summary: `${list(top.map((h) => h.ticker))} ${top.length === 1 ? "leads" : "lead"} on total return. ${first.ticker} is ${signedPct(first.totalReturnPct, 0)} since purchase.`,
    highlights: ["holdings", "movers", ...top.map((h) => h.ticker)],
    blocks,
  };
}

function biggestRisks(p: Portfolio): AIResponseData {
  const m = makeMoney(p.currency);
  const r = p.risk;
  const largest = r.largestStock;
  const vol = volatilityLabel(r.volatilityScore);
  const div = diversificationLabel(r.diversificationScore);
  const concentrated = r.techWeight >= 40;
  const heavyStock = largest !== null && largest.weight >= 10;
  const maxWeight = Math.max(...p.sectorAllocation.map((s) => s.weight));

  let lead: string;
  if (concentrated) {
    lead = `Your biggest risk is concentration. **${pct(r.techWeight, 1)}** of the portfolio, ${m.moneyWhole(r.techValue)}, sits in tech and tech-adjacent stocks. When that group sells off, most of your money moves with it.`;
  } else if (heavyStock) {
    lead =
      largest.weight > 99
        ? `Your biggest risk is single-stock exposure. All of your money is in **${largest.ticker}**, so one company's news moves the whole portfolio.`
        : `Your biggest risk is single-stock exposure. **${largest.ticker}** is ${pct(largest.weight, 1)} of the portfolio, so one company's news can move the whole thing.`;
  } else {
    const broad = p.sectorAllocation.find((s) => s.label === "Broad Market");
    const biggest = p.sectorAllocation.find((s) => !["Broad Market", "Cash"].includes(s.label));
    lead = `No single stock or sector dominates. ${
      broad && broad.weight >= 30
        ? `${pct(broad.weight, 1)} of your money is in index funds, which already spread risk across many companies. `
        : ""
    }${
      biggest && biggest.weight >= 12
        ? `Your biggest single exposure is **${biggest.label}** at ${pct(biggest.weight, 1)}, so that's what moves you most outside the index.`
        : `Your largest stock is ${largest ? `${largest.ticker} at ${pct(largest.weight, 1)}` : "a fund"}.`
    }`;
  }

  const ideas: string[] = [];
  if (concentrated) {
    ideas.push("You could point new money toward areas you're light on, like staples, financials or healthcare, instead of selling winners.");
  }
  if (heavyStock) {
    ideas.push(`You could set a ceiling for any single stock, say 10%, and trim back to it when a position runs past. ${largest.ticker} is at ${pct(largest.weight, 1)} today.`);
  }
  if (r.volatilityScore >= 6.5 && ideas.length < 2) {
    ideas.push("Adding a broad index fund or bonds would soften the swings.");
  }

  const betaText =
    Math.abs(r.beta - 1) < 0.05
      ? "about as much as"
      : `about ${Math.abs(Math.round((r.beta - 1) * 100))}% ${r.beta > 1 ? "more" : "less"} than`;

  const blocks: ResponseBlock[] = [
    { type: "text", text: lead },
    {
      type: "metrics",
      items: [
        { label: "Tech exposure", value: pct(r.techWeight, 1), detail: `${r.techTickers.length} holdings`, tone: concentrated ? "down" : "neutral" },
        largest
          ? { label: `Largest stock · ${largest.ticker}`, value: pct(largest.weight, 1), detail: m.moneyWhole(largest.value), tone: "neutral" }
          : { label: "Top 3 positions", value: pct(r.topThreeWeight, 1), detail: list(r.topThree), tone: "neutral" },
        { label: "Volatility", value: `${r.volatilityScore.toFixed(1)}/10`, detail: `${vol} · beta ${r.beta.toFixed(2)}`, tone: "neutral" },
      ],
    },
    {
      type: "chart",
      title: "Allocation by sector",
      variant: "bar",
      unit: "pct",
      domain: [0, Math.min(100, niceCeil(maxWeight, 10))],
      series: [
        {
          name: "Weight",
          color: CHART_COLORS.ink,
          points: p.sectorAllocation.map((s) => ({
            label: s.label,
            value: s.weight,
            color: s.tech ? CHART_COLORS.accent : CHART_COLORS.muted,
          })),
        },
      ],
      axis: p.sectorAllocation.map((s) =>
        s.label.replace("Consumer ", "Cons. ").replace("Communication", "Comm.").replace("Broad Market", "Market")
      ),
      legend: [
        { label: "Tech-heavy sectors", color: CHART_COLORS.accent },
        { label: "Everything else", color: CHART_COLORS.muted },
      ],
      caption: "Tech-like stocks in other sectors (such as AMZN) also count toward tech exposure.",
    },
    {
      type: "text",
      text: `${
        p.holdings.length > 3
          ? `Your top three positions make up **${pct(r.topThreeWeight, 1)}**.`
          : `You hold ${p.holdings.length === 1 ? "one position" : `${p.holdings.length} positions`}, so each one carries a lot of weight.`
      } Volatility is ${vol.toLowerCase()} at ${r.volatilityScore.toFixed(1)}/10: a portfolio beta of ${r.beta.toFixed(2)} means it tends to move ${betaText} the market. Diversification is ${div.toLowerCase()} at ${r.diversificationScore.toFixed(1)}/10.`,
    },
  ];
  if (ideas.length) {
    blocks.push({
      type: "text",
      text: `${ideas.length === 1 ? "One thing" : "Two things"} you could consider. ${ideas.slice(0, 2).join(" ")}`,
    });
  }

  let summary: string;
  if (concentrated) {
    summary = `Tech is ${pct(r.techWeight, 0)} of the portfolio.${largest ? ` ${largest.ticker} alone is ${pct(largest.weight, 1)}.` : ""}`;
  } else if (heavyStock) {
    summary = `${largest.ticker} is ${pct(largest.weight, 1)} of the portfolio.`;
  } else {
    summary = `Balanced: volatility ${r.volatilityScore.toFixed(1)}/10, diversification ${r.diversificationScore.toFixed(1)}/10.`;
  }

  return {
    intent: "risk",
    title: "Biggest risks",
    summary,
    highlights: ["risk", "allocation", ...(concentrated ? r.techTickers : largest ? [largest.ticker] : [])],
    blocks,
  };
}

function versusBenchmark(p: Portfolio): AIResponseData {
  const m = makeMoney(p.currency);
  const year = p.ranges["1Y"];
  const rows = [
    { label: "This week", you: p.totals.weekChangePct, spx: p.benchmark.returns.week },
    { label: "1 month", you: p.totals.monthChangePct, spx: p.benchmark.returns.month },
    { label: "3 months", you: p.ranges["3M"].changePct, spx: p.benchmark.returns.threeMonths },
    { label: "1 year", you: year.changePct, spx: p.benchmark.returns.year },
  ];
  const lead = year.changePct - p.benchmark.returns.year;
  const sampled = year.points.filter((_, i) => i % 2 === 0 || i === year.points.length - 1);
  const values = sampled.flatMap((pt) => [pt.portfolio, pt.benchmark]);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const pad = (high - low) * 0.1 || 1;
  const PERIOD: Record<string, string> = {
    "This week": "this week",
    "1 month": "the past month",
    "3 months": "the past three months",
  };
  const recent = rows.slice(0, 3);
  const behind = recent.filter((r) => r.you < r.spx).map((r) => PERIOD[r.label]);
  const ahead = recent.filter((r) => r.you >= r.spx).map((r) => PERIOD[r.label]);
  const monthYear = (date: Date) => date.toLocaleDateString("en-US", { month: "short", year: "numeric" });

  return {
    intent: "benchmark",
    title: `You vs the ${p.benchmark.name}`,
    summary: `${lead >= 0 ? "Ahead" : "Behind"} over a year, ${signedPct(year.changePct, 1)} vs ${signedPct(p.benchmark.returns.year, 1)}.${
      lead >= 0 && behind.length ? ` Behind over ${behind[0]}.` : lead < 0 && ahead.length ? ` Ahead over ${ahead[0]}.` : ""
    }`,
    highlights: ["performance"],
    blocks: [
      {
        type: "text",
        text:
          lead >= 0
            ? `Over the past year you're ahead. The portfolio returned **${signedPct(year.changePct, 1)}** against **${signedPct(p.benchmark.returns.year, 1)}** for the ${p.benchmark.name}, a lead of ${lead.toFixed(1)} points.`
            : `Over the past year you're behind. The portfolio returned **${signedPct(year.changePct, 1)}** against **${signedPct(p.benchmark.returns.year, 1)}** for the ${p.benchmark.name}, ${Math.abs(lead).toFixed(1)} points short.`,
      },
      {
        type: "chart",
        title: `Past year, ${p.benchmark.name} rebased to your starting value`,
        variant: "line",
        unit: "usd",
        domain: [low - pad, high + pad],
        series: [
          { name: "Your portfolio", color: CHART_COLORS.accent, points: sampled.map((pt) => ({ label: pt.date.toDateString(), value: pt.portfolio })) },
          { name: p.benchmark.name, color: CHART_COLORS.muted, points: sampled.map((pt) => ({ label: pt.date.toDateString(), value: pt.benchmark })) },
        ],
        axis: [monthYear(year.points[0].date), monthYear(year.points[year.points.length - 1].date)],
        legend: [
          { label: "Your portfolio", color: CHART_COLORS.accent },
          { label: p.benchmark.name, color: CHART_COLORS.muted },
        ],
        caption: `${m.moneyWhole(year.points[0].portfolio)} a year ago is ${m.moneyWhole(p.totals.value)} today. The same money in the ${p.benchmark.name} would be ${m.moneyWhole(year.points[year.points.length - 1].benchmark)}.`,
      },
      {
        type: "table",
        columns: ["Period", "You", p.benchmark.name],
        rows: rows.map((r) => ({
          cells: [r.label, signedPct(r.you), signedPct(r.spx)],
          tone: ["neutral", toneOf(r.you), toneOf(r.spx)],
        })),
      },
      {
        type: "text",
        text: (() => {
          const week = `This week it's **${signedPct(p.totals.weekChangePct)}** for you vs **${signedPct(p.benchmark.returns.week)}** for the index.`;
          if (lead >= 0) {
            return behind.length
              ? `Recently it's a different story: you're behind over ${list(behind)}. ${week}${p.risk.techWeight >= 40 ? " That's the flip side of the tech tilt." : ""}`
              : "You're ahead over every shorter period in the table too.";
          }
          return ahead.length
            ? `Recently things have turned: you're ahead over ${list(ahead)}. ${week}`
            : `You're behind over the shorter periods as well. ${week}`;
        })(),
      },
    ],
  };
}

function comingUp(p: Portfolio): AIResponseData {
  const m = makeMoney(p.currency);
  if (!p.hasEventsCalendar) {
    return {
      intent: "events",
      title: "Coming up",
      summary: "No events calendar for Indian stocks yet.",
      highlights: ["events"],
      blocks: [
        {
          type: "text",
          text: "I don't have an earnings or dividend calendar for Indian stocks yet, so I can't tell you what's coming up for these holdings. Your broker's corporate-actions page will have the dates.",
        },
      ],
    };
  }
  const week = p.thisWeek;
  const later = p.upcoming.filter((e) => e.daysAway > 7 && e.kind === "earnings");
  const income = week.reduce((acc, e) => acc + (e.amount ?? 0), 0);
  const dividends = week.filter((e) => e.amount);
  const day = (e: UpcomingEvent) =>
    e.date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });

  const describe = (e: UpcomingEvent) => {
    if (e.kind === "dividend-paid") {
      return `${e.ticker} pays ${m.money(e.amount ?? 0)} on ${day(e)}.`;
    }
    if (e.kind === "ex-dividend") {
      return `${e.ticker} goes ex-dividend on ${day(e)}, so you'll receive ${m.money(e.amount ?? 0)} when it pays.`;
    }
    const h = p.byTicker(e.ticker);
    return `${e.ticker} reports on ${day(e)}, ${e.timing?.toLowerCase() ?? ""}${h ? `; it's ${signedPct(h.monthChangePct, 1)} this month` : ""}.`;
  };

  // The busiest stretch after this week: the 4-day window with the most reports.
  let cluster: UpcomingEvent[] = [];
  for (const start of later) {
    const windowed = later.filter((e) => e.daysAway >= start.daysAway && e.daysAway <= start.daysAway + 3);
    if (windowed.length > cluster.length) {
      cluster = windowed;
    }
  }
  const clusterWeight = cluster.reduce((acc, e) => acc + (p.byTicker(e.ticker)?.weight ?? 0), 0);
  const range =
    cluster.length > 1
      ? cluster[0].daysAway === cluster[cluster.length - 1].daysAway
        ? shortDate(cluster[0].date)
        : `${shortDate(cluster[0].date)}–${cluster[cluster.length - 1].date.getDate()}`
      : "";
  const beforeCluster = later.filter((e) => cluster.length > 1 && e.daysAway < cluster[0].daysAway);

  const blocks: ResponseBlock[] = [
    {
      type: "text",
      text: week.length
        ? `${week.length <= 3 ? "A quiet week" : "A busy week"}. There ${week.length === 1 ? "is" : "are"} **${week.length} ${week.length === 1 ? "event" : "events"}** for your holdings in the next seven days${
            dividends.length ? `, including dividends worth **${m.moneyWhole(income)}** to you` : ""
          }.`
        : "Nothing is scheduled for your holdings in the next seven days.",
    },
  ];
  if (week.length) {
    blocks.push({ type: "events", items: week }, { type: "text", text: week.map(describe).join(" ") });
  }
  if (cluster.length > 1) {
    blocks.push({
      type: "text",
      text: `${beforeCluster.length ? `After that, ${list(beforeCluster.map((e) => e.ticker))} ${beforeCluster.length === 1 ? "reports" : "report"} ${shortDate(beforeCluster[0].date)}. ` : ""}The bigger moment is ${range}, when **${list(
        cluster.map((e) => e.ticker)
      )}** report. That's **${pct(clusterWeight, 1)}** of your portfolio in a few days, so expect bigger swings then.`,
    });
  } else if (later.length) {
    blocks.push({ type: "text", text: `After that, ${later[0].ticker} reports ${shortDate(later[0].date)}.` });
  }

  return {
    intent: "events",
    title: "Coming up",
    summary: week.length
      ? `${week.length} ${week.length === 1 ? "event" : "events"} this week${income ? ` and ${m.moneyWhole(income)} in dividends` : ""}.${range ? ` Earnings cluster ${range}.` : ""}`
      : `A quiet week.${later.length ? ` Next up: ${later[0].ticker} on ${shortDate(later[0].date)}.` : ""}`,
    highlights: ["events", ...week.map((e) => e.ticker)],
    blocks,
  };
}

function fallback(): AIResponseData {
  return {
    intent: "fallback",
    title: "Try another question",
    summary: "I answer questions about your holdings, performance, risk and upcoming events.",
    highlights: [],
    blocks: [
      {
        type: "text",
        text: "I can't answer that one yet. I work from your holdings, prices and upcoming events, so questions like these are where I'm most useful:",
      },
      { type: "suggestions", items: SUGGESTED_QUESTIONS },
    ],
  };
}

const BUILDERS: Record<IntentId, (p: Portfolio) => AIResponseData> = {
  drop: whyDrop,
  best: bestPerformers,
  risk: biggestRisks,
  benchmark: versusBenchmark,
  events: comingUp,
  fallback,
};

export function answer(question: string, portfolio: Portfolio): AIResponseData {
  const { id } = matchIntent(question);
  if (id !== "fallback" && portfolio.holdings.length === 0) {
    return emptyPortfolio(id);
  }
  return BUILDERS[id](portfolio);
}
