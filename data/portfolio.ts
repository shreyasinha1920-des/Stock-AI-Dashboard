/**
 * Single source of truth for every number in Aurum.
 *
 * A portfolio is positions (ticker, shares, average cost, optionally a price
 * from your statement) plus cash, in one market. `buildPortfolio` derives
 * everything else from that and the mock price books below: totals, weights,
 * returns, movers, risk, chart history and events. The dashboard and the AI
 * both read the same derived object, so they never disagree.
 *
 * Mock prices. Past moves are simulated. Not financial advice.
 */

import type { Currency } from "@/lib/format";

export type Market = "US" | "IN";

/** Known sectors; imported statements can bring others, kept as-is. */
export type Sector = string;

/** Sectors that are funds rather than single companies. */
const FUND_SECTORS = ["Broad Market", "Bonds", "Gold", "Liquid"];

/** One mock quote with the history anchors every chart and stat is built from. */
export interface Quote {
  ticker: string;
  name: string;
  sector: Sector;
  /** Counts toward "tech exposure" (Technology plus tech-like names). */
  tech: boolean;
  beta: number;
  price: number;
  prevClose: number;
  /** Close 5 sessions ago. */
  weekAgo: number;
  /** Close 21 sessions ago. */
  monthAgo: number;
  threeMonthsAgo: number;
  yearAgo: number;
  /** First session of Jan 2023. */
  inception: number;
  isin?: string;
  /** What moved this stock, e.g. an earnings reaction. `{pct}` is replaced with the week's move. */
  note?: string;
  /** Entered by hand with no price history; charts treat it as flat. */
  custom?: boolean;
}

/** Market close the whole dataset is "as of". */
export const AS_OF = new Date(2026, 8, 30, 16, 0); // Wed Sep 30 2026, market close

/* -------------------------------------------------------------------------- */
/* Price books                                                                */
/* -------------------------------------------------------------------------- */

const round2 = (value: number) => Math.round(value * 100) / 100;

/** Builds a quote from a price and its % moves over each window. */
const fromMoves = (
  ticker: string,
  name: string,
  sector: Sector,
  tech: boolean,
  beta: number,
  price: number,
  [day, week, month, threeMonths, year, sinceInception]: number[],
  isin?: string
): Quote => ({
  ticker,
  name,
  sector,
  tech,
  beta,
  price,
  prevClose: round2(price / (1 + day / 100)),
  weekAgo: round2(price / (1 + week / 100)),
  monthAgo: round2(price / (1 + month / 100)),
  threeMonthsAgo: round2(price / (1 + threeMonths / 100)),
  yearAgo: round2(price / (1 + year / 100)),
  inception: round2(price / (1 + sinceInception / 100)),
  isin,
});

const US_SAMPLE_QUOTES: Quote[] = [
  // Day, week and month closes are exact so the sample's story holds.
  { ticker: "NVDA", name: "NVIDIA", sector: "Technology", tech: true, beta: 1.75, price: 168.4, prevClose: 171.25, weekAgo: 188.4, monthAgo: 185.1, threeMonthsAgo: 170.1, yearAgo: 106.58, inception: 14.64, note: "fell {pct} after earnings. The results were solid, but not strong enough for the expectations priced in." },
  { ticker: "VOO", name: "Vanguard S&P 500 ETF", sector: "Broad Market", tech: false, beta: 1.0, price: 571.3, prevClose: 572.05, weekAgo: 573.6, monthAgo: 574.9, threeMonthsAgo: 554.17, yearAgo: 501.62, inception: 337.13 },
  { ticker: "MSFT", name: "Microsoft", sector: "Technology", tech: true, beta: 1.1, price: 488.2, prevClose: 490.1, weekAgo: 493.1, monthAgo: 496.4, threeMonthsAgo: 478.63, yearAgo: 413.73, inception: 238.15 },
  { ticker: "AAPL", name: "Apple", sector: "Technology", tech: true, beta: 1.2, price: 231.5, prevClose: 232.4, weekAgo: 233.4, monthAgo: 229.8, threeMonthsAgo: 214.35, yearAgo: 222.6, inception: 125.14 },
  { ticker: "AMD", name: "Advanced Micro Devices", sector: "Technology", tech: true, beta: 1.8, price: 162.8, prevClose: 165.9, weekAgo: 171.4, monthAgo: 170.2, threeMonthsAgo: 155.05, yearAgo: 150.74, inception: 65.12 },
  { ticker: "AMZN", name: "Amazon", sector: "Consumer Disc.", tech: true, beta: 1.3, price: 214.6, prevClose: 215.9, weekAgo: 219.0, monthAgo: 218.3, threeMonthsAgo: 206.35, yearAgo: 175.9, inception: 84.16 },
  { ticker: "META", name: "Meta Platforms", sector: "Communication", tech: true, beta: 1.35, price: 712.4, prevClose: 716.8, weekAgo: 730.7, monthAgo: 721.3, threeMonthsAgo: 691.65, yearAgo: 548.0, inception: 131.93 },
  { ticker: "TSLA", name: "Tesla", sector: "Consumer Disc.", tech: false, beta: 2.1, price: 248.9, prevClose: 254.3, weekAgo: 282.8, monthAgo: 291.5, threeMonthsAgo: 273.52, yearAgo: 241.65, inception: 124.45, note: "dropped {pct} after its earnings report." },
  { ticker: "GOOGL", name: "Alphabet", sector: "Communication", tech: true, beta: 1.15, price: 182.3, prevClose: 182.9, weekAgo: 185.1, monthAgo: 181.6, threeMonthsAgo: 175.29, yearAgo: 162.77, inception: 88.93 },
  { ticker: "COST", name: "Costco", sector: "Consumer Staples", tech: false, beta: 0.8, price: 968.5, prevClose: 962.4, weekAgo: 951.4, monthAgo: 930.2, threeMonthsAgo: 931.25, yearAgo: 888.53, inception: 484.25 },
  { ticker: "JPM", name: "JPMorgan Chase", sector: "Financials", tech: false, beta: 1.05, price: 286.7, prevClose: 285.1, weekAgo: 283.3, monthAgo: 277.8, threeMonthsAgo: 265.46, yearAgo: 223.98, inception: 136.52 },
];

// Moves are [day, week, month, 3 months, 1 year, since Jan 2023], in %.
const US_MORE_QUOTES: Quote[] = [
  fromMoves("AVGO", "Broadcom", "Technology", true, 1.4, 345.2, [-1.2, -4.1, -2.0, 6.5, 48, 520]),
  fromMoves("CRM", "Salesforce", "Technology", true, 1.2, 262.1, [-0.4, -1.8, 1.2, -3.0, -6, 95]),
  fromMoves("ORCL", "Oracle", "Technology", true, 1.1, 231.4, [-0.9, -2.6, 3.4, 12, 58, 190]),
  fromMoves("INTC", "Intel", "Technology", true, 1.1, 24.6, [0.8, 1.2, 5.1, 9, 12, -30]),
  fromMoves("NFLX", "Netflix", "Communication", true, 1.3, 1180.5, [-0.3, -1.5, -2.2, 4, 42, 240]),
  fromMoves("DIS", "Walt Disney", "Communication", false, 1.1, 112.3, [0.2, 0.6, -1.1, -2, 8, 20]),
  fromMoves("V", "Visa", "Financials", false, 0.95, 348.2, [0.3, 0.9, 1.8, 3, 22, 60]),
  fromMoves("MA", "Mastercard", "Financials", false, 1.0, 581.4, [0.2, 0.7, 1.5, 3.5, 20, 62]),
  fromMoves("BRK.B", "Berkshire Hathaway", "Financials", false, 0.85, 496.1, [0.4, 1.1, 2.0, 2.4, 14, 60]),
  fromMoves("JNJ", "Johnson & Johnson", "Healthcare", false, 0.55, 171.8, [0.5, 1.3, 2.2, 4, 9, 5]),
  fromMoves("UNH", "UnitedHealth Group", "Healthcare", false, 0.7, 342.6, [-0.2, 0.4, -3.5, -8, -35, -30]),
  fromMoves("XOM", "Exxon Mobil", "Energy", false, 0.9, 114.7, [0.9, 2.1, 3.0, 1.5, -2, 12]),
  fromMoves("KO", "Coca-Cola", "Consumer Staples", false, 0.6, 70.4, [0.3, 0.9, 1.4, 2.0, 10, 12]),
  fromMoves("PG", "Procter & Gamble", "Consumer Staples", false, 0.45, 158.3, [0.4, 0.8, 0.9, -1.5, -4, 12]),
  fromMoves("WMT", "Walmart", "Consumer Staples", false, 0.6, 102.6, [0.5, 1.4, 2.6, 5, 30, 110]),
  fromMoves("QQQ", "Invesco QQQ Trust", "Broad Market", false, 1.15, 588.4, [-0.5, -2.2, -1.4, 3.2, 16, 110]),
  fromMoves("SPY", "SPDR S&P 500 ETF", "Broad Market", false, 1.0, 646.1, [-0.26, -1.1, -0.6, 3.09, 13.89, 69.46]),
  fromMoves("SCHD", "Schwab US Dividend Equity ETF", "Broad Market", false, 0.8, 28.4, [0.2, 0.5, 0.9, 2.0, 6, 12]),
  fromMoves("BND", "Vanguard Total Bond Market ETF", "Bonds", false, 0.05, 74.1, [0.05, 0.3, 0.4, 1.0, 3.5, 2]),
];

/** Nifty 50 moves; NIFTYBEES tracks them exactly. */
const NIFTY_MOVES = [-0.35, -1.2, -0.9, 2.2, 7.8, 42];

/**
 * Indian book (NSE). Prices are Sep 30 2026 closes; the moves before that are
 * simulated. Imported statements override the price with their own.
 */
const IN_QUOTES: Quote[] = [
  // Index, gold, bond and liquid ETFs
  fromMoves("NIFTYBEES", "Nippon India Nifty 50 BeES", "Broad Market", false, 1.0, 259.54, NIFTY_MOVES, "INF204KB14I2"),
  fromMoves("JUNIORBEES", "Nippon India Nifty Next 50 Junior BeES", "Broad Market", false, 1.1, 762.3, [-0.5, -1.6, -1.4, 2.8, 6.5, 55], "INF732E01045"),
  fromMoves("MID150BEES", "Nippon India Nifty Midcap 150 ETF", "Broad Market", false, 1.2, 227.59, [-0.6, -2.1, -1.8, 3.5, 9, 80], "INF204KB1V68"),
  fromMoves("CPSEETF", "CPSE ETF", "Broad Market", false, 1.1, 91.4, [0.3, -0.4, 1.2, 4, 12, 160], "INF457M01133"),
  fromMoves("ICICIB22", "Bharat 22 ETF", "Broad Market", false, 1.0, 110.46, [0.1, -0.8, 0.4, 3, 9, 120], "INF109KB15Y7"),
  fromMoves("DIVOPPBEES", "Nippon India Dividend Opportunities ETF", "Broad Market", false, 0.9, 72.76, [-0.2, -1.0, -0.6, 1.5, 4, 60], "INF204KA1MS3"),
  fromMoves("GOLDCASE", "Zerodha Gold ETF", "Gold", false, 0.1, 22.98, [0.4, 1.1, 3.2, 6, 28, 70], "INF0R8F01042"),
  fromMoves("GOLDBEES", "Nippon India Gold BeES", "Gold", false, 0.1, 95.2, [0.4, 1.1, 3.2, 6, 28, 70]),
  fromMoves("EBBETF0430", "Bharat Bond ETF April 2030", "Bonds", false, 0.1, 1607.49, [0.02, 0.08, 0.4, 1.6, 7.2, 24], "INF754K01KO2"),
  fromMoves("LIQUIDBEES", "Nippon India Liquid BeES", "Liquid", false, 0, 1000.01, [0, 0, 0, 0, 0, 0], "INF732E01037"),
  fromMoves("LIQUIDCASE", "Zerodha Nifty 1D Rate Liquid ETF", "Liquid", false, 0.02, 116.13, [0.02, 0.12, 0.5, 1.5, 6.5, 18], "INF0R8F01034"),
  // Stocks
  fromMoves("AUBANK", "AU Small Finance Bank", "Financials", false, 1.2, 1005.2, [-0.8, -2.4, -3.1, -6, 8, 20], "INE949L01017"),
  fromMoves("BSE", "BSE Ltd", "Financials", false, 1.5, 3200, [-1.9, -6.2, -9.5, -14, 40, 400], "INE118H01025"),
  fromMoves("NAM-INDIA", "Nippon Life India Asset Management", "Financials", false, 1.2, 1068.9, [-0.9, -2.8, -4.4, -8, 15, 280], "INE298J01013"),
  fromMoves("ICICIBANK", "ICICI Bank", "Financials", false, 1.0, 1380, [-0.4, -1.3, -0.8, 2, 11, 55], "INE090A01021"),
  fromMoves("HDFCBANK", "HDFC Bank", "Financials", false, 0.9, 980, [-0.3, -1.1, -0.5, 1.4, 9, 20], "INE040A01034"),
  fromMoves("SBIN", "State Bank of India", "Financials", false, 1.1, 870, [-0.5, -1.4, -1.0, 3, 10, 45], "INE062A01020"),
  fromMoves("SBILIFE", "SBI Life Insurance", "Financials", false, 0.8, 1850, [0.2, 0.6, 1.4, 4, 16, 45], "INE123W01016"),
  fromMoves("CUMMINSIND", "Cummins India", "Industrials", false, 1.1, 4819.2, [0.6, 1.2, 2.4, 5, 18, 200], "INE298A01020"),
  fromMoves("LT", "Larsen & Toubro", "Industrials", false, 1.1, 3700, [-0.2, -0.9, 0.6, 3, 10, 75], "INE018A01030"),
  fromMoves("BEL", "Bharat Electronics", "Industrials", false, 1.3, 405, [-0.6, -2.0, -1.5, 4, 30, 300], "INE263A01024"),
  fromMoves("MAZDOCK", "Mazagon Dock Shipbuilders", "Industrials", false, 1.6, 2800, [-1.2, -3.5, -5.0, -9, 12, 900], "INE249Z01020"),
  fromMoves("LTFOODS", "LT Foods", "Consumer Staples", false, 0.9, 402.85, [-0.4, -1.8, -4.2, -9, 12, 300], "INE818H01020"),
  fromMoves("MARICO", "Marico", "Consumer Staples", false, 0.6, 793, [0.1, -0.5, -1.9, -4, 6, 60], "INE196A01026"),
  fromMoves("NESTLEIND", "Nestlé India", "Consumer Staples", false, 0.6, 1345.7, [0.2, 0.4, -1.1, -2, -3, 20], "INE239A01024"),
  fromMoves("VBL", "Varun Beverages", "Consumer Staples", false, 0.9, 430, [-0.7, -2.2, -3.6, -11, -25, 60], "INE200M01039"),
  fromMoves("ITC", "ITC", "Consumer Staples", false, 0.6, 405, [0.1, 0.3, -0.8, -2, -6, 20], "INE154A01025"),
  fromMoves("LUPIN", "Lupin", "Healthcare", false, 0.7, 2060, [-0.3, -1.1, -2.6, -5, 1, 180], "INE326A01037"),
  fromMoves("TORNTPHARM", "Torrent Pharmaceuticals", "Healthcare", false, 0.6, 4915.15, [0.5, 1.4, 3.8, 9, 21, 130], "INE685A01028"),
  fromMoves("RELIANCE", "Reliance Industries", "Energy", false, 1.0, 1420, [-0.4, -1.5, -1.2, 1, 3, 20], "INE002A01018"),
  fromMoves("COALINDIA", "Coal India", "Energy", false, 0.8, 390, [0.3, 0.8, 1.5, 2, -8, 70], "INE522F01014"),
  fromMoves("NATIONALUM", "National Aluminium", "Materials", false, 1.4, 230, [-0.8, -2.5, 1.0, 6, 25, 180], "INE139A01034"),
  fromMoves("TCS", "Tata Consultancy Services", "Technology", true, 0.8, 3050, [-0.6, -1.9, -3.0, -6, -20, -10], "INE467B01029"),
  fromMoves("INFY", "Infosys", "Technology", true, 0.9, 1480, [-0.5, -1.7, -2.4, -4, -12, -5], "INE009A01021"),
  fromMoves("HCLTECH", "HCL Technologies", "Technology", true, 0.9, 1480, [-0.4, -1.5, -2.0, -3, -8, 40], "INE860A01027"),
  fromMoves("BHARTIARTL", "Bharti Airtel", "Communication", false, 0.8, 1950, [0.2, 0.9, 2.1, 5, 22, 150], "INE397D01024"),
];

const indexBy = (quotes: Quote[]) => Object.fromEntries(quotes.map((q) => [q.ticker, q]));

/** Mock quotes by market and ticker. */
export const QUOTES: Record<Market, Record<string, Quote>> = {
  US: indexBy([...US_SAMPLE_QUOTES, ...US_MORE_QUOTES]),
  IN: indexBy(IN_QUOTES),
};

const BY_ISIN: Record<string, Quote> = Object.fromEntries(
  IN_QUOTES.filter((q) => q.isin).map((q) => [q.isin as string, q])
);

/** The book's quote for an ISIN, if it has one. */
export const quoteByIsin = (isin?: string): Quote | undefined => (isin ? BY_ISIN[isin.trim().toUpperCase()] : undefined);

export const KNOWN_TICKERS: Record<Market, string[]> = {
  US: Object.keys(QUOTES.US).sort(),
  IN: Object.keys(QUOTES.IN).sort(),
};

/** "GOLDCASE-E" → "GOLDCASE". Strips NSE series codes, but not names like NAM-INDIA. */
export const cleanTicker = (ticker: string) =>
  ticker.trim().toUpperCase().replace(/-(E|F|EQ|BE|BL|BZ|SM|ST|IL|IV|RR|GB)$/, "");

/** Maps broker sector labels (e.g. Zerodha's "FMCG") onto Aurum's names. */
export function normaliseSector(raw?: string): Sector | undefined {
  if (!raw || raw === "-") {
    return undefined;
  }
  const s = raw.trim().toUpperCase();
  const table: [RegExp, Sector][] = [
    [/FINANC|BANK|INSURANCE/, "Financials"],
    [/FMCG|STAPLE|CONSUMER GOODS|FOOD|BEVERAGE/, "Consumer Staples"],
    [/HEALTH|PHARMA/, "Healthcare"],
    [/ENGINEERING|CAPITAL GOODS|INDUSTRIAL|DEFEN/, "Industrials"],
    [/INFORMATION TECH|^IT$|SOFTWARE|TECHNOLOGY/, "Technology"],
    [/AUTO|CONSUMER DURABLE|RETAIL|CONSUMER DISC/, "Consumer Disc."],
    [/OIL|GAS|POWER|ENERGY/, "Energy"],
    [/METAL|MINING|CHEMICAL|MATERIAL|CEMENT/, "Materials"],
    [/TELECOM|MEDIA|COMMUNICATION/, "Communication"],
    [/ETF|INDEX|FUND/, "Broad Market"],
  ];
  const match = table.find(([re]) => re.test(s));
  return match ? match[1] : raw.trim().replace(/\w\S*/g, (w) => w[0] + w.slice(1).toLowerCase());
}

/**
 * A quote for any position: from the book (by ticker, then ISIN), rescaled to
 * the statement's price if one was given, or a flat quote at a typed price.
 */
export function resolveQuote(position: PositionInput, market: Market): Quote | null {
  const symbol = cleanTicker(position.ticker);
  const known =
    QUOTES[market][symbol] ?? (market === "IN" && position.isin ? BY_ISIN[position.isin.trim().toUpperCase()] : undefined);
  const price = position.price;

  if (known) {
    if (!price || !(price > 0) || Math.abs(price - known.price) < 0.005) {
      return known;
    }
    // Keep the book's simulated shape, but land exactly on your statement's price.
    const k = price / known.price;
    return {
      ...known,
      price,
      prevClose: round2(known.prevClose * k),
      weekAgo: round2(known.weekAgo * k),
      monthAgo: round2(known.monthAgo * k),
      threeMonthsAgo: round2(known.threeMonthsAgo * k),
      yearAgo: round2(known.yearAgo * k),
      inception: round2(known.inception * k),
    };
  }
  if (!symbol || !price || !(price > 0)) {
    return null;
  }
  return {
    ticker: symbol,
    name: position.name?.trim() || symbol,
    sector: normaliseSector(position.sector) ?? "Other",
    tech: normaliseSector(position.sector) === "Technology",
    beta: 1,
    price,
    prevClose: price,
    weekAgo: price,
    monthAgo: price,
    threeMonthsAgo: price,
    yearAgo: price,
    inception: price,
    isin: position.isin,
    custom: true,
  };
}

/* -------------------------------------------------------------------------- */
/* Benchmarks                                                                 */
/* -------------------------------------------------------------------------- */

type Anchors = Pick<Quote, "price" | "prevClose" | "weekAgo" | "monthAgo" | "threeMonthsAgo" | "yearAgo" | "inception">;

export interface Benchmark {
  name: string;
  /** Short label for tight spots, e.g. tooltips. */
  short: string;
  anchors: Anchors;
  returns: { day: number; week: number; month: number; threeMonths: number; year: number };
}

const benchmark = (name: string, short: string, anchors: Anchors): Benchmark => ({
  name,
  short,
  anchors,
  returns: {
    day: (anchors.price / anchors.prevClose - 1) * 100,
    week: (anchors.price / anchors.weekAgo - 1) * 100,
    month: (anchors.price / anchors.monthAgo - 1) * 100,
    threeMonths: (anchors.price / anchors.threeMonthsAgo - 1) * 100,
    year: (anchors.price / anchors.yearAgo - 1) * 100,
  },
});

export const BENCHMARKS: Record<Market, Benchmark> = {
  US: benchmark("S&P 500", "S&P", {
    price: 6480.2,
    prevClose: 6497.1,
    weekAgo: 6552.3,
    monthAgo: 6519.4,
    threeMonthsAgo: 6285.7,
    yearAgo: 5689.8,
    inception: 3824.1,
  }),
  IN: benchmark("Nifty 50", "Nifty", fromMoves("NIFTY", "Nifty 50", "Index", false, 1, 25640, NIFTY_MOVES)),
};

export const CURRENCY: Record<Market, Currency> = { US: "USD", IN: "INR" };

/* -------------------------------------------------------------------------- */
/* Events (US only; there's no mock calendar for Indian stocks)               */
/* -------------------------------------------------------------------------- */

export type EventKind = "earnings" | "ex-dividend" | "dividend-paid";

export interface PortfolioEvent {
  ticker: string;
  kind: EventKind;
  date: Date;
  /** Earnings timing, e.g. "After close". */
  timing?: string;
  /** Per-share dividend, used to compute the cash amount for a holding. */
  perShare?: number;
}

const on = (month: number, day: number) => new Date(2026, month - 1, day);

export const EVENTS: PortfolioEvent[] = [
  { ticker: "VOO", kind: "dividend-paid", date: on(10, 1), perShare: 1.74 },
  { ticker: "SPY", kind: "dividend-paid", date: on(10, 1), perShare: 1.79 },
  { ticker: "JPM", kind: "ex-dividend", date: on(10, 2), perShare: 1.4 },
  { ticker: "KO", kind: "ex-dividend", date: on(10, 2), perShare: 0.51 },
  { ticker: "COST", kind: "earnings", date: on(10, 6), timing: "After close" },
  { ticker: "PG", kind: "earnings", date: on(10, 7), timing: "Before open" },
  { ticker: "JPM", kind: "earnings", date: on(10, 13), timing: "Before open" },
  { ticker: "JNJ", kind: "earnings", date: on(10, 13), timing: "Before open" },
  { ticker: "NFLX", kind: "earnings", date: on(10, 15), timing: "After close" },
  { ticker: "UNH", kind: "earnings", date: on(10, 15), timing: "Before open" },
  { ticker: "V", kind: "earnings", date: on(10, 20), timing: "After close" },
  { ticker: "MSFT", kind: "earnings", date: on(10, 27), timing: "After close" },
  { ticker: "GOOGL", kind: "earnings", date: on(10, 27), timing: "After close" },
  { ticker: "META", kind: "earnings", date: on(10, 28), timing: "After close" },
  { ticker: "AAPL", kind: "earnings", date: on(10, 29), timing: "After close" },
  { ticker: "AMZN", kind: "earnings", date: on(10, 29), timing: "After close" },
  { ticker: "XOM", kind: "earnings", date: on(10, 30), timing: "Before open" },
  { ticker: "AMD", kind: "earnings", date: on(11, 3), timing: "After close" },
];

/* -------------------------------------------------------------------------- */
/* Input                                                                      */
/* -------------------------------------------------------------------------- */

export interface PositionInput {
  ticker: string;
  shares: number;
  avgCost: number;
  /** Today's price. Required outside the price book; from statements it overrides the book. */
  price?: number;
  /** From imports: shown when the ticker isn't in the book. */
  name?: string;
  sector?: string;
  isin?: string;
  /** The statement didn't include a cost, so `avgCost` is a stand-in. */
  costUnknown?: boolean;
}

export interface PortfolioInput {
  holdings: PositionInput[];
  cash: number;
  market?: Market;
  /** Where the holdings came from, e.g. "Zerodha holdings export". */
  source?: string;
}

export const SAMPLE_INPUT: PortfolioInput = {
  market: "US",
  cash: 10_000,
  holdings: [
    { ticker: "NVDA", shares: 214, avgCost: 62.4 },
    { ticker: "VOO", shares: 72, avgCost: 398.2 },
    { ticker: "MSFT", shares: 53, avgCost: 342.1 },
    { ticker: "AAPL", shares: 104, avgCost: 158.3 },
    { ticker: "AMD", shares: 123, avgCost: 118.6 },
    { ticker: "AMZN", shares: 79, avgCost: 148.2 },
    { ticker: "META", shares: 22, avgCost: 402.5 },
    { ticker: "TSLA", shares: 64, avgCost: 262.3 },
    { ticker: "GOOGL", shares: 82, avgCost: 121.4 },
    { ticker: "COST", shares: 14, avgCost: 612.8 },
    { ticker: "JPM", shares: 45, avgCost: 172.4 },
  ],
};

/* -------------------------------------------------------------------------- */
/* Price history                                                              */
/* -------------------------------------------------------------------------- */

export type RangeKey = "1D" | "1W" | "1M" | "3M" | "1Y" | "ALL";

export interface SeriesPoint {
  date: Date;
  portfolio: number;
  /** Benchmark rebased to the portfolio's value at the start of the range. */
  benchmark: number;
}

export interface RangeSeries {
  key: RangeKey;
  points: SeriesPoint[];
  change: number;
  changePct: number;
  benchmarkPct: number;
}

export const RANGE_KEYS: RangeKey[] = ["1D", "1W", "1M", "3M", "1Y", "ALL"];

export const RANGE_LABELS: Record<RangeKey, string> = {
  "1D": "today",
  "1W": "past week",
  "1M": "past month",
  "3M": "past 3 months",
  "1Y": "past year",
  ALL: "since Jan 2023",
};

/** Deterministic PRNG so mock history is identical on server and client. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hashSeed = (text: string) => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  }
  return h >>> 0;
};

/**
 * Random walk that passes exactly through every `[index, value]` anchor.
 * The noise is generated freely, then each segment is bent in log space so
 * its endpoints land on the anchors.
 */
function anchoredWalk(anchors: [number, number][], volatility: number, seed: number): number[] {
  const rand = mulberry32(seed);
  const length = anchors[anchors.length - 1][0] + 1;
  const noise = [0];
  for (let i = 1; i < length; i++) {
    noise.push(noise[i - 1] + (rand() + rand() + rand() - 1.5) * volatility);
  }
  const out = new Array<number>(length);
  for (let s = 0; s < anchors.length - 1; s++) {
    const [i0, v0] = anchors[s];
    const [i1, v1] = anchors[s + 1];
    const span = i1 - i0;
    for (let i = i0; i <= i1; i++) {
      const t = span === 0 ? 0 : (i - i0) / span;
      const base = Math.log(v0) + (Math.log(v1) - Math.log(v0)) * t;
      const bridge = noise[i] - (noise[i0] + (noise[i1] - noise[i0]) * t);
      // Rounded so server (Node) and browser produce identical numbers for hydration.
      out[i] = round2(Math.exp(base + bridge));
    }
  }
  return out;
}

/** Trading days (Mon–Fri) ending at AS_OF, oldest first. */
function tradingDays(count: number): Date[] {
  const days: Date[] = [];
  const cursor = new Date(AS_OF);
  while (days.length < count) {
    const dow = cursor.getDay();
    if (dow !== 0 && dow !== 6) {
      days.unshift(new Date(cursor));
    }
    cursor.setDate(cursor.getDate() - 1);
  }
  return days;
}

/** Jan 2023 → Sep 30 2026. */
const DAILY_COUNT = 978;
const DAILY_DATES = tradingDays(DAILY_COUNT);
const LAST = DAILY_COUNT - 1;
const WEEK_STEPS = 13;
const DAY_STEPS = 78;

const dailyAnchors = (q: Anchors): [number, number][] => [
  [0, q.inception],
  [LAST - 252, q.yearAgo],
  [LAST - 63, q.threeMonthsAgo],
  [LAST - 21, q.monthAgo],
  [LAST - 5, q.weekAgo],
  [LAST - 1, q.prevClose],
  [LAST, q.price],
];

interface PriceHistory {
  daily: number[];
  /** Last 5 sessions, half-hourly, anchored to the daily closes. */
  week: number[];
  /** Today, 5-minute steps from the previous close. */
  day: number[];
}

/** Intraday walk over the last `sessions` sessions, anchored to daily closes. */
function intraday(daily: number[], sessions: number, steps: number, vol: number, seed: number) {
  const anchors: [number, number][] = [];
  for (let s = 0; s <= sessions; s++) {
    anchors.push([s * steps, daily[LAST - sessions + s]]);
  }
  return anchoredWalk(anchors, vol, seed);
}

const flatHistory = (price: number): PriceHistory => ({
  daily: new Array(DAILY_COUNT).fill(price),
  week: new Array(5 * WEEK_STEPS + 1).fill(price),
  day: new Array(DAY_STEPS + 1).fill(price),
});

const historyCache = new Map<string, PriceHistory>();

/** Price history for one quote, generated once and cached. */
function historyFor(q: Anchors & { ticker: string; beta: number; custom?: boolean }, seedKey = q.ticker): PriceHistory {
  const key = `${seedKey}@${q.price}`;
  const cached = historyCache.get(key);
  if (cached) {
    return cached;
  }
  let history: PriceHistory;
  if (q.custom || q.beta === 0) {
    history = flatHistory(q.price);
  } else {
    const seed = hashSeed(seedKey);
    const daily = anchoredWalk(dailyAnchors(q), 0.012 * q.beta, seed);
    history = {
      daily,
      week: intraday(daily, 5, WEEK_STEPS, 0.0022 * q.beta, seed + 1),
      day: intraday(daily, 1, DAY_STEPS, 0.0012 * q.beta, seed + 2),
    };
  }
  historyCache.set(key, history);
  return history;
}

const BENCH_HISTORY: Record<Market, PriceHistory> = {
  US: (() => {
    const daily = anchoredWalk(dailyAnchors(BENCHMARKS.US.anchors), 0.0075, 11);
    return { daily, week: intraday(daily, 5, WEEK_STEPS, 0.0011, 12), day: intraday(daily, 1, DAY_STEPS, 0.0008, 13) };
  })(),
  IN: (() => {
    const daily = anchoredWalk(dailyAnchors(BENCHMARKS.IN.anchors), 0.0075, 21);
    return { daily, week: intraday(daily, 5, WEEK_STEPS, 0.0011, 22), day: intraday(daily, 1, DAY_STEPS, 0.0008, 23) };
  })(),
};

/** Timestamps for one session, 9:30 → 16:00. */
function sessionTimes(day: Date, steps: number): Date[] {
  const open = new Date(day);
  open.setHours(9, 30, 0, 0);
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = new Date(open);
    t.setMinutes(open.getMinutes() + Math.round((i * 390) / steps));
    return t;
  });
}

/** The previous close, then every intraday step of the last `sessions` sessions. */
function intradayDates(sessions: number, steps: number): Date[] {
  const dates = [DAILY_DATES[LAST - sessions]];
  for (let s = 1; s <= sessions; s++) {
    dates.push(...sessionTimes(DAILY_DATES[LAST - sessions + s], steps).slice(1));
  }
  return dates;
}

const WEEK_DATES = intradayDates(5, WEEK_STEPS);
const DAY_DATES = intradayDates(1, DAY_STEPS);

/* -------------------------------------------------------------------------- */
/* Derived portfolio                                                          */
/* -------------------------------------------------------------------------- */

export interface Holding extends Quote {
  shares: number;
  avgCost: number;
  costUnknown: boolean;
  value: number;
  costBasis: number;
  totalReturn: number;
  totalReturnPct: number;
  dayChange: number;
  dayChangePct: number;
  weekChange: number;
  weekChangePct: number;
  monthChange: number;
  monthChangePct: number;
  weight: number;
  /** 1M daily closes, ending at `price`. */
  spark: number[];
}

export interface AllocationSlice {
  label: string;
  value: number;
  weight: number;
  tech: boolean;
}

export interface UpcomingEvent extends PortfolioEvent {
  /** Cash amount for dividends, from this portfolio's share count. */
  amount?: number;
  daysAway: number;
}

export interface Portfolio {
  isSample: boolean;
  market: Market;
  currency: Currency;
  benchmark: Benchmark;
  /** Where the holdings came from, if imported. */
  source?: string;
  /** No events calendar exists for this market. */
  hasEventsCalendar: boolean;
  holdings: Holding[];
  cash: number;
  totals: {
    value: number;
    invested: number;
    costBasis: number;
    prevClose: number;
    weekAgo: number;
    monthAgo: number;
    dayChange: number;
    dayChangePct: number;
    weekChange: number;
    weekChangePct: number;
    monthChange: number;
    monthChangePct: number;
    allTimeReturn: number;
    allTimeReturnPct: number;
  };
  sectorAllocation: AllocationSlice[];
  holdingAllocation: AllocationSlice[];
  risk: {
    techWeight: number;
    techValue: number;
    techTickers: string[];
    topThree: string[];
    topThreeWeight: number;
    /** Largest single stock, ignoring funds (index, bond, gold and liquid). */
    largestStock: Holding | null;
    beta: number;
    /** 0–10. Beta 1.0 (the market) lands at 5. */
    volatilityScore: number;
    /** 0–10, scaled so an even spread across 7 sectors scores 10. */
    diversificationScore: number;
  };
  movers: { day: Holding[]; month: Holding[]; allTime: Holding[] };
  /** This week's change per holding, largest drag first. */
  weekContributions: Holding[];
  ranges: Record<RangeKey, RangeSeries>;
  upcoming: UpcomingEvent[];
  /** Events in the next 7 days. */
  thisWeek: UpcomingEvent[];
  byTicker: (ticker: string) => Holding | undefined;
}

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
const pctChange = (now: number, then: number) => (then > 0 ? (now / then - 1) * 100 : 0);
const DAY_MS = 86_400_000;
const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

export const isFund = (sector: Sector) => FUND_SECTORS.includes(sector);

function buildRange(key: RangeKey, dates: Date[], portfolio: number[], bench: number[]): RangeSeries {
  const start = portfolio[0];
  const points = dates.map((date, i) => ({
    date,
    portfolio: round2(portfolio[i]),
    benchmark: round2((bench[i] / bench[0]) * start),
  }));
  const end = points[points.length - 1];
  return {
    key,
    points,
    change: round2(end.portfolio - start),
    changePct: pctChange(end.portfolio, start),
    benchmarkPct: pctChange(bench[bench.length - 1], bench[0]),
  };
}

/** Merges duplicate tickers (e.g. two lots) into one position with a blended cost. */
function consolidate(input: PositionInput[]): PositionInput[] {
  const merged = new Map<string, PositionInput>();
  for (const p of input) {
    const ticker = cleanTicker(p.ticker);
    const existing = merged.get(ticker);
    if (existing) {
      const shares = existing.shares + p.shares;
      existing.avgCost = (existing.avgCost * existing.shares + p.avgCost * p.shares) / shares;
      existing.shares = shares;
      existing.costUnknown = existing.costUnknown || p.costUnknown;
    } else {
      merged.set(ticker, { ...p, ticker });
    }
  }
  return [...merged.values()];
}

export function buildPortfolio(input: PortfolioInput, isSample = false): Portfolio {
  const market: Market = input.market ?? "US";
  const bench = BENCH_HISTORY[market];
  const cash = Math.max(0, input.cash || 0);
  const positions = consolidate(input.holdings)
    .map((p) => ({ p, q: resolveQuote(p, market) }))
    .filter((x): x is { p: PositionInput; q: Quote } => x.q !== null && x.p.shares > 0);

  const invested = round2(sum(positions.map(({ p, q }) => p.shares * q.price)));
  const total = round2(invested + cash);
  const weightOf = (value: number) => (total > 0 ? (value / total) * 100 : 0);
  const seedKey = (q: Quote) => `${market}:${q.ticker}`;

  const holdings: Holding[] = positions
    .map(({ p, q }) => {
      const value = round2(p.shares * q.price);
      const costBasis = round2(p.shares * p.avgCost);
      return {
        ...q,
        shares: p.shares,
        avgCost: p.avgCost,
        costUnknown: Boolean(p.costUnknown),
        value,
        costBasis,
        totalReturn: round2(value - costBasis),
        totalReturnPct: pctChange(q.price, p.avgCost),
        dayChange: round2(p.shares * (q.price - q.prevClose)),
        dayChangePct: pctChange(q.price, q.prevClose),
        weekChange: round2(p.shares * (q.price - q.weekAgo)),
        weekChangePct: pctChange(q.price, q.weekAgo),
        monthChange: round2(p.shares * (q.price - q.monthAgo)),
        monthChangePct: pctChange(q.price, q.monthAgo),
        weight: weightOf(value),
        spark: historyFor(q, seedKey(q)).daily.slice(LAST - 21),
      };
    })
    .sort((a, b) => b.value - a.value);

  const totalAt = (key: "prevClose" | "weekAgo" | "monthAgo") =>
    round2(sum(holdings.map((h) => h.shares * h[key])) + cash);
  const costBasis = round2(sum(holdings.map((h) => h.costBasis)));
  const prevClose = totalAt("prevClose");
  const weekAgo = totalAt("weekAgo");
  const monthAgo = totalAt("monthAgo");

  /* ---- allocation ---- */
  const sectors = new Map<Sector, number>();
  for (const h of holdings) {
    sectors.set(h.sector, (sectors.get(h.sector) ?? 0) + h.value);
  }
  if (cash > 0) {
    sectors.set("Cash", cash);
  }
  const sectorAllocation: AllocationSlice[] = [...sectors.entries()]
    .map(([label, value]) => ({
      label,
      value: round2(value),
      weight: weightOf(value),
      tech: label === "Technology" || (market === "US" && label === "Communication"),
    }))
    .sort((a, b) => b.value - a.value);

  const holdingAllocation: AllocationSlice[] = [
    ...holdings.map((h) => ({ label: h.ticker, value: h.value, weight: h.weight, tech: h.tech })),
    ...(cash > 0 ? [{ label: "Cash", value: cash, weight: weightOf(cash), tech: false }] : []),
  ];

  /* ---- risk ---- */
  const tech = holdings.filter((h) => h.tech);
  const topThree = holdings.slice(0, 3);
  const beta = sum(holdings.map((h) => (h.weight / 100) * h.beta));
  // Broad index funds already hold the whole market, so they count as spread
  // evenly across 7 sectors rather than as one concentrated bucket.
  const sectorHHI = sum(
    sectorAllocation.map((s) => (s.label === "Broad Market" ? (s.weight / 100) ** 2 / 7 : (s.weight / 100) ** 2))
  );
  const effectiveSectors = sectorHHI > 0 ? 1 / sectorHHI : 0;

  /* ---- history: each position's price path times its shares, plus cash ---- */
  const paths = holdings.map((h) => ({ shares: h.shares, history: historyFor(h, seedKey(h)) }));
  const combine = (pick: (history: PriceHistory) => number[], length: number) =>
    Array.from({ length }, (_, i) => sum(paths.map((p) => p.shares * pick(p.history)[i])) + cash);

  const daily = combine((h) => h.daily, DAILY_COUNT);
  const dailyRange = (key: RangeKey, sessions: number, every = 1) => {
    const from = Math.max(0, LAST - sessions);
    const idx: number[] = [];
    for (let i = LAST; i >= from; i -= every) {
      idx.unshift(i);
    }
    if (idx[0] !== from) {
      idx.unshift(from);
    }
    return buildRange(
      key,
      idx.map((i) => DAILY_DATES[i]),
      idx.map((i) => daily[i]),
      idx.map((i) => bench.daily[i])
    );
  };

  const ranges: Record<RangeKey, RangeSeries> = {
    "1D": buildRange("1D", DAY_DATES, combine((h) => h.day, DAY_DATES.length), bench.day),
    "1W": buildRange("1W", WEEK_DATES, combine((h) => h.week, WEEK_DATES.length), bench.week),
    "1M": dailyRange("1M", 21),
    "3M": dailyRange("3M", 63),
    "1Y": dailyRange("1Y", 252, 2),
    ALL: dailyRange("ALL", LAST, 5),
  };

  /* ---- events ---- */
  const held = new Map(holdings.map((h) => [h.ticker, h]));
  const upcoming: UpcomingEvent[] =
    market === "US"
      ? EVENTS.filter((e) => held.has(e.ticker))
          .map((e) => ({
            ...e,
            amount: e.perShare ? round2(e.perShare * held.get(e.ticker)!.shares) : undefined,
            daysAway: Math.round((startOfDay(e.date).getTime() - startOfDay(AS_OF).getTime()) / DAY_MS),
          }))
          .sort((a, b) => a.date.getTime() - b.date.getTime())
      : [];

  return {
    isSample,
    market,
    currency: CURRENCY[market],
    benchmark: BENCHMARKS[market],
    source: input.source,
    hasEventsCalendar: market === "US",
    holdings,
    cash,
    totals: {
      value: total,
      invested,
      costBasis,
      prevClose,
      weekAgo,
      monthAgo,
      dayChange: round2(total - prevClose),
      dayChangePct: pctChange(total, prevClose),
      weekChange: round2(total - weekAgo),
      weekChangePct: pctChange(total, weekAgo),
      monthChange: round2(total - monthAgo),
      monthChangePct: pctChange(total, monthAgo),
      allTimeReturn: round2(invested - costBasis),
      allTimeReturnPct: pctChange(invested, costBasis),
    },
    sectorAllocation,
    holdingAllocation,
    risk: {
      techWeight: sum(tech.map((h) => h.weight)),
      techValue: round2(sum(tech.map((h) => h.value))),
      techTickers: tech.map((h) => h.ticker),
      topThree: topThree.map((h) => h.ticker),
      topThreeWeight: sum(topThree.map((h) => h.weight)),
      largestStock: holdings.find((h) => !isFund(h.sector)) ?? null,
      beta,
      volatilityScore: Math.min(10, beta * 5),
      diversificationScore: Math.min(10, (effectiveSectors / 7) * 10),
    },
    movers: {
      day: [...holdings].sort((a, b) => b.dayChangePct - a.dayChangePct),
      month: [...holdings].sort((a, b) => b.monthChangePct - a.monthChangePct),
      allTime: [...holdings].sort((a, b) => b.totalReturnPct - a.totalReturnPct),
    },
    weekContributions: [...holdings].sort((a, b) => a.weekChange - b.weekChange),
    ranges,
    upcoming,
    thisWeek: upcoming.filter((e) => e.daysAway >= 0 && e.daysAway <= 7),
    byTicker: (ticker) => held.get(ticker),
  };
}

export const SAMPLE_PORTFOLIO = buildPortfolio(SAMPLE_INPUT, true);

export const volatilityLabel = (score: number) =>
  score >= 7.5 ? "High" : score >= 5.5 ? "Elevated" : score >= 4 ? "Moderate" : "Low";

export const diversificationLabel = (score: number) =>
  score >= 7.5 ? "Strong" : score >= 5 ? "Moderate" : "Weak";
