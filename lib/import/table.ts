/**
 * Turns any grid of cells (from XLSX, CSV or a PDF table) into positions.
 *
 * Brokers name columns differently, so columns are found by header aliases
 * rather than position. Everything runs locally; nothing leaves the browser.
 */

import { cleanTicker, type Market, type PositionInput, QUOTES, quoteByIsin } from "@/data/portfolio";

export type Grid = string[][];

type Field = "symbol" | "name" | "isin" | "quantity" | "avgCost" | "price" | "value" | "sector";

/** Header aliases, most specific first. Compared after normalising case and punctuation. */
const ALIASES: Record<Field, string[]> = {
  symbol: ["symbol", "trading symbol", "tradingsymbol", "instrument", "ticker", "scrip", "stock symbol", "nse symbol"],
  name: ["company name", "security name", "stock name", "name of security", "scheme name", "name", "company"],
  isin: ["isin code", "isin"],
  quantity: ["quantity available", "tot qty", "total quantity", "total qty", "quantity", "qty", "units", "shares", "holding quantity"],
  avgCost: ["average price", "avg cost", "avg. cost", "average cost", "avg price", "avg buy price", "buy avg", "buy average", "purchase price", "average buy price"],
  price: ["previous closing price", "ltp", "last traded price", "last price", "current price", "closing price", "close price", "market price", "cmp", "rate", "price"],
  value: ["present value", "current value", "cur val", "cur. val", "market value", "value"],
  sector: ["sector", "industry"],
};

const norm = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Finds each field's column in a header row. A cell is claimed by one field only. */
function mapHeader(row: string[]): Partial<Record<Field, number>> {
  const cells = row.map((c) => norm(c ?? ""));
  const taken = new Set<number>();
  const map: Partial<Record<Field, number>> = {};
  // Symbol, quantity and cost first: they have the most specific names.
  const order: Field[] = ["isin", "symbol", "quantity", "avgCost", "price", "value", "sector", "name"];
  for (const field of order) {
    for (const alias of ALIASES[field]) {
      const target = norm(alias);
      const index = cells.findIndex((c, i) => !taken.has(i) && c === target);
      if (index !== -1) {
        map[field] = index;
        taken.add(index);
        break;
      }
    }
  }
  return map;
}

const isHeader = (map: Partial<Record<Field, number>>) =>
  map.quantity !== undefined && (map.symbol !== undefined || map.name !== undefined || map.isin !== undefined);

/** "1,23,456.78", "₹ 1,234", "(12.5)" → numbers. */
export function parseNumber(text: string | undefined): number {
  if (text === undefined) {
    return Number.NaN;
  }
  const trimmed = String(text).trim();
  if (!trimmed || trimmed === "-") {
    return Number.NaN;
  }
  const negative = /^\(.*\)$/.test(trimmed) || /^[−-]/.test(trimmed);
  const digits = trimmed.replace(/[^0-9.]/g, "");
  const value = Number(digits);
  if (!digits || !Number.isFinite(value)) {
    return Number.NaN;
  }
  return negative ? -value : value;
}

export interface ImportedRow extends PositionInput {
  /** Human-readable problems to fix before saving. */
  warnings: string[];
}

export interface ImportResult {
  rows: ImportedRow[];
  market: Market;
  /** e.g. "Zerodha holdings export". */
  source: string;
  /** Total value printed on the statement, if found, to check the import against. */
  statementValue?: number;
  /** Problems with the file as a whole. */
  notes: string[];
}

/** Guesses the market: Indian ISINs, or tickers found only in the Indian book. */
export function detectMarket(rows: PositionInput[]): Market {
  let india = 0;
  let us = 0;
  for (const r of rows) {
    const t = cleanTicker(r.ticker);
    if (r.isin?.toUpperCase().startsWith("IN") || QUOTES.IN[t]) {
      india++;
    } else if (QUOTES.US[t] || r.isin?.toUpperCase().startsWith("US")) {
      us++;
    }
  }
  return india > us ? "IN" : "US";
}

/** Finds a "Present Value"/"Current Value" style total above or below the table. */
function findStatementValue(grid: Grid): number | undefined {
  for (const row of grid) {
    for (let i = 0; i < row.length - 1; i++) {
      if (/^(present value|current value|total current value|market value)$/.test(norm(row[i] ?? ""))) {
        const value = parseNumber(row[i + 1]);
        if (Number.isFinite(value) && value > 0) {
          return value;
        }
      }
    }
  }
  return undefined;
}

/**
 * Reads holdings out of a grid. `fallbackSymbolFromName` lets PDFs that only
 * carry company names still produce a usable ticker.
 */
export function tableToPositions(grid: Grid, source: string): ImportResult | null {
  const headerIndex = grid.findIndex((row) => isHeader(mapHeader(row)));
  if (headerIndex === -1) {
    return null;
  }
  const map = mapHeader(grid[headerIndex]);
  const get = (row: string[], field: Field) => (map[field] === undefined ? undefined : row[map[field] as number]);
  const rows: ImportedRow[] = [];

  for (const row of grid.slice(headerIndex + 1)) {
    const first = norm(row.find((c) => c && c.trim()) ?? "");
    if (!first) {
      continue;
    }
    // Stop at totals or the start of another table.
    if (/^(total|grand total|sub total)/.test(first) || isHeader(mapHeader(row))) {
      break;
    }
    const quantity = parseNumber(get(row, "quantity"));
    if (!(quantity > 0)) {
      continue;
    }
    const rawSymbol = (get(row, "symbol") ?? "").trim();
    const name = (get(row, "name") ?? "").trim() || undefined;
    const isin = (get(row, "isin") ?? "").trim().toUpperCase() || undefined;
    let price = parseNumber(get(row, "price"));
    const value = parseNumber(get(row, "value"));
    if (!(price > 0) && value > 0) {
      price = value / quantity;
    }
    const avgCost = parseNumber(get(row, "avgCost"));
    const warnings: string[] = [];

    // Statements that only carry names: the ISIN finds the proper ticker when the book knows it.
    let ticker = cleanTicker(rawSymbol) || quoteByIsin(isin)?.ticker || "";
    if (!ticker && name) {
      // Statements that only list company names: use a tidy version as the label.
      ticker = name.toUpperCase().replace(/\b(LIMITED|LTD|INDIA|THE)\b\.?/g, "").replace(/[^A-Z0-9&]+/g, " ").trim().split(" ").slice(0, 2).join(" ");
    }
    if (!ticker) {
      continue;
    }
    const costUnknown = !(avgCost > 0);
    if (costUnknown) {
      warnings.push("This file has no purchase price. Add your average cost to see returns.");
    }
    if (!(price > 0)) {
      warnings.push("No current price in the file.");
    }
    rows.push({
      ticker,
      shares: quantity,
      avgCost: costUnknown ? (price > 0 ? price : 0) : avgCost,
      costUnknown,
      price: price > 0 ? price : undefined,
      name,
      isin,
      sector: get(row, "sector")?.trim() || undefined,
      warnings,
    });
  }

  const notes: string[] = [];
  if (rows.length === 0) {
    notes.push("Found the holdings table, but it has no rows.");
  }
  return {
    rows,
    market: detectMarket(rows),
    source,
    statementValue: findStatementValue(grid),
    notes,
  };
}

/** Among several sheets/tables, keep the one with the most holdings (avoids double-counting summary sheets). */
export function bestResult(results: (ImportResult | null)[]): ImportResult | null {
  return results.reduce<ImportResult | null>((best, r) => {
    if (!r) {
      return best;
    }
    if (!best || r.rows.length > best.rows.length) {
      return r;
    }
    return best;
  }, null);
}
