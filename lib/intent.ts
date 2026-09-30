/**
 * Tiny intent matcher: weighted keywords plus a forgiving fuzzy match, so
 * "why did my portfolo drop" and "whats comming up" still land.
 */

export type IntentId = "drop" | "best" | "risk" | "benchmark" | "events" | "fallback";

interface IntentSpec {
  id: Exclude<IntentId, "fallback">;
  /** Whole phrases checked against the normalised question. */
  phrases: string[];
  /** Single keywords (or stems) with their weight. */
  keywords: Record<string, number>;
}

const INTENTS: IntentSpec[] = [
  {
    id: "drop",
    phrases: ["why did", "what happened", "go down", "went down", "lose money", "lost money"],
    keywords: {
      drop: 3, dropped: 3, down: 2, fall: 3, fell: 3, falling: 3, lose: 2, lost: 2,
      loss: 2, losses: 2, decline: 3, declined: 3, dip: 2, crash: 3, red: 1, why: 1,
      hurt: 2, tank: 2, tanked: 3, slump: 3, drag: 2,
    },
  },
  {
    id: "best",
    phrases: ["doing well", "best performing", "top performers", "performing best"],
    keywords: {
      best: 3, top: 2, winner: 3, winners: 3, performing: 2, performer: 3,
      performers: 3, strongest: 3, gain: 2, gains: 2, leader: 2, leaders: 2, up: 1,
    },
  },
  {
    id: "risk",
    phrases: ["too much", "biggest risk", "how risky", "am i safe"],
    keywords: {
      risk: 3, risks: 3, risky: 3, exposure: 3, exposed: 3, concentration: 3,
      concentrated: 3, diversified: 3, diversification: 3, diversify: 3,
      volatility: 3, volatile: 3, safe: 2, worry: 2, worried: 2, danger: 2,
      rebalance: 2, balance: 1, heavy: 1,
    },
  },
  {
    id: "benchmark",
    phrases: ["s&p 500", "s&p", "sp 500", "the market", "the index", "vs the", "versus the"],
    keywords: {
      sp500: 3, spx: 3, nifty: 3, sensex: 3, benchmark: 3, market: 2, index: 2, compare: 2, compared: 2,
      comparison: 2, versus: 2, vs: 2, beat: 2, beating: 2, outperform: 3,
      underperform: 3, relative: 1,
    },
  },
  {
    id: "events",
    phrases: ["coming up", "this week", "next week", "what's next", "whats next"],
    keywords: {
      upcoming: 3, coming: 3, soon: 2, earnings: 3, dividend: 3, dividends: 3, calendar: 3,
      event: 2, events: 2, schedule: 2, report: 1, reports: 1, payout: 2, expect: 1,
    },
  },
];

/** Clean up a question into lowercase words; keeps "&" so "s&p" survives. */
export const normalise = (text: string) =>
  text
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9&\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Levenshtein distance with an early exit once it exceeds `max`. */
function distance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) {
    return max + 1;
  }
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost);
      rowMin = Math.min(rowMin, row[j]);
    }
    if (rowMin > max) {
      return max + 1;
    }
    prev = row;
  }
  return prev[b.length];
}

/** Exact hit scores full weight, a near-miss typo scores 70%. */
function wordScore(word: string, keyword: string): number {
  if (word === keyword) {
    return 1;
  }
  if (keyword.length >= 5 && word.length >= 4) {
    const allowed = keyword.length >= 8 ? 2 : 1;
    if (distance(word, keyword, allowed) <= allowed) {
      return 0.7;
    }
  }
  return 0;
}

export interface IntentMatch {
  id: IntentId;
  score: number;
}

const THRESHOLD = 2;

export function matchIntent(question: string): IntentMatch {
  const text = normalise(question);
  const words = text.split(" ").filter(Boolean);

  let best: IntentMatch = { id: "fallback", score: 0 };
  for (const intent of INTENTS) {
    let score = 0;
    for (const phrase of intent.phrases) {
      if (text.includes(phrase)) {
        score += 3;
      }
    }
    for (const [keyword, weight] of Object.entries(intent.keywords)) {
      let hit = 0;
      for (const word of words) {
        hit = Math.max(hit, wordScore(word, keyword));
      }
      score += hit * weight;
    }
    if (score > best.score) {
      best = { id: intent.id, score };
    }
  }

  return best.score >= THRESHOLD ? best : { id: "fallback", score: best.score };
}
