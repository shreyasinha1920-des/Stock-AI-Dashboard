"use client";

import { FileUp, Plus, Trash2, X } from "lucide-react";
import { type DragEvent, type FormEvent, useEffect, useId, useRef, useState } from "react";
import { Segmented } from "@/components/dashboard/segmented";
import { usePortfolio } from "@/components/portfolio/portfolio-provider";
import {
  AS_OF,
  cleanTicker,
  CURRENCY,
  KNOWN_TICKERS,
  type Market,
  type PortfolioInput,
  type PositionInput,
  QUOTES,
  resolveQuote,
} from "@/data/portfolio";
import { makeMoney } from "@/lib/format";
import { type ImportResult, importHoldings, PdfPasswordError } from "@/lib/import";
import { DURATION, EASE_ENTER, EASE_FRAMER, gsap, prefersReducedMotion, useGSAP } from "@/lib/motion";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* Draft rows: strings while editing, numbers once validated                  */
/* -------------------------------------------------------------------------- */

interface Row {
  key: number;
  ticker: string;
  shares: string;
  avgCost: string;
  /** Typed for tickers outside the book, or carried over from a statement. */
  price: string;
  /** From an import; cleared if you retype the ticker. */
  meta?: Pick<PositionInput, "name" | "isin" | "sector">;
  /** The statement had no purchase price; a blank cost is allowed. */
  costUnknown?: boolean;
}

interface RowErrors {
  ticker?: string;
  shares?: string;
  avgCost?: string;
  price?: string;
}

let nextKey = 1;
const blankRow = (): Row => ({ key: nextKey++, ticker: "", shares: "", avgCost: "", price: "" });

const fromPosition = (h: PositionInput): Row => ({
  key: nextKey++,
  ticker: h.ticker,
  shares: String(h.shares),
  avgCost: h.costUnknown ? "" : String(Number(h.avgCost.toFixed(4))),
  price: h.price ? String(h.price) : "",
  meta: h.name || h.isin || h.sector ? { name: h.name, isin: h.isin, sector: h.sector } : undefined,
  costUnknown: h.costUnknown,
});

const num = (text: string) => {
  const value = Number(text.replace(/[$₹,\s]/g, ""));
  return Number.isFinite(value) ? value : Number.NaN;
};

const isBlank = (row: Row) => !row.ticker.trim() && !row.shares.trim() && !row.avgCost.trim() && !row.price.trim();

const toPosition = (row: Row): PositionInput => ({
  ticker: row.ticker.trim().toUpperCase(),
  shares: num(row.shares),
  price: row.price.trim() ? num(row.price) : undefined,
  avgCost: row.avgCost.trim() ? num(row.avgCost) : num(row.price) || 0,
  costUnknown: row.costUnknown && !row.avgCost.trim() ? true : undefined,
  ...row.meta,
});

function validate(row: Row, market: Market): RowErrors {
  const errors: RowErrors = {};
  const ticker = cleanTicker(row.ticker);
  if (!ticker) {
    errors.ticker = "Enter a ticker.";
  } else if (!/^[A-Z0-9][A-Z0-9.&\- ]{0,24}$/.test(ticker)) {
    errors.ticker = "Use letters and numbers, e.g. AAPL.";
  }
  if (!(num(row.shares) > 0)) {
    errors.shares = "Shares must be more than 0.";
  }
  if (!row.costUnknown && (row.avgCost.trim() === "" || !(num(row.avgCost) >= 0))) {
    errors.avgCost = "Enter what you paid per share.";
  }
  const known = resolveQuote({ ticker, shares: 1, avgCost: 0, isin: row.meta?.isin }, market);
  if (ticker && !known && !(num(row.price) > 0)) {
    errors.price = "Not in the price book. Enter today's price.";
  }
  return errors;
}

/** "NVDA, 214, 62.40" per line, optionally with a price for unknown tickers. */
function parsePasted(text: string, market: Market): { rows: Row[]; errors: string[] } {
  const rows: Row[] = [];
  const errors: string[] = [];
  text.split(/\r?\n/).forEach((line, index) => {
    const cells = line.split(/[,\t;]|\s{2,}/).map((c) => c.trim()).filter(Boolean);
    if (cells.length === 0) {
      return;
    }
    // Skip a header row like "ticker, shares, avg cost".
    if (index === 0 && Number.isNaN(num(cells[1] ?? ""))) {
      return;
    }
    if (cells.length < 3) {
      errors.push(`Line ${index + 1}: expected ticker, shares and average cost.`);
      return;
    }
    const row: Row = { key: nextKey++, ticker: cells[0].toUpperCase(), shares: cells[1], avgCost: cells[2], price: cells[3] ?? "" };
    const problems = Object.values(validate(row, market));
    if (problems.length) {
      errors.push(`Line ${index + 1} (${row.ticker}): ${problems[0]}`);
    }
    rows.push(row);
  });
  return { rows, errors };
}

/* -------------------------------------------------------------------------- */
/* Import panel                                                               */
/* -------------------------------------------------------------------------- */

function ImportPanel({ onImported }: { onImported: (result: ImportResult) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [dragging, setDragging] = useState(false);
  const inputId = useId();

  const run = async (chosen: File, pass?: string) => {
    setFile(chosen);
    setBusy(true);
    setError(null);
    try {
      const result = await importHoldings(chosen, pass);
      if (result.rows.length === 0) {
        setError(
          `Found the holdings table in this ${result.source.toLowerCase().includes("statement") ? "statement" : "file"}, but it lists no holdings.`
        );
      } else {
        onImported(result);
      }
      setNeedsPassword(false);
    } catch (err) {
      if (err instanceof PdfPasswordError) {
        setNeedsPassword(true);
        setError(err.incorrect ? "That password didn't work. Try again." : null);
      } else {
        setError((err as Error).message || "Couldn't read that file.");
      }
    } finally {
      setBusy(false);
      setPassword("");
    }
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    const dropped = event.dataTransfer.files[0];
    if (dropped) {
      void run(dropped);
    }
  };

  return (
    <div className="flex flex-col gap-4" data-editor-item>
      <label
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-[12px] border border-dashed px-6 py-10 text-center transition-colors duration-150",
          dragging ? "border-brand-text bg-brand/10" : "border-edge hover:border-brand-text"
        )}
        htmlFor={inputId}
        onDragLeave={() => setDragging(false)}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDrop={onDrop}
      >
        <FileUp aria-hidden className="size-6 text-brand-text" />
        <span className="text-[15px] text-ink">{busy ? `Reading ${file?.name}…` : "Drop a holdings file, or browse"}</span>
        <span className="max-w-[380px] text-[12px] text-ink-2 leading-5">
          Excel (.xlsx), CSV or a text PDF. Tested with Zerodha&apos;s holdings export; other brokers&apos; exports and
          CDSL/NSDL holding statements work when they have a clear holdings table.
        </span>
        <input
          accept=".xlsx,.csv,.tsv,.pdf"
          className="sr-only"
          disabled={busy}
          id={inputId}
          onChange={(event) => {
            const chosen = event.target.files?.[0];
            if (chosen) {
              void run(chosen);
            }
            event.target.value = "";
          }}
          type="file"
        />
      </label>

      <p className="text-[12px] text-ink-2 leading-5">
        Your file is read on this device and never uploaded. Only the holdings are kept; names, account numbers and PAN
        in the file are ignored.
      </p>

      {needsPassword && file ? (
        <form
          className="flex flex-col gap-2 rounded-[10px] border border-edge p-4"
          onSubmit={(event) => {
            event.preventDefault();
            void run(file, password);
          }}
        >
          <label className="text-[14px] text-ink" htmlFor="pdf-password">
            This PDF is password-protected
          </label>
          <p className="text-[12px] text-ink-2">
            Brokers often use your PAN or date of birth. It&apos;s only used to open the file here.
          </p>
          <div className="flex gap-2">
            <input
              autoComplete="off"
              className="h-10 min-w-0 flex-1 rounded-[8px] border border-edge bg-black px-3 text-[14px] text-ink focus:border-brand-text focus:outline-none"
              id="pdf-password"
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              value={password}
            />
            <button className="h-10 rounded-[8px] bg-ink px-4 font-medium text-[14px] text-black" type="submit">
              Open
            </button>
          </div>
        </form>
      ) : null}

      {error ? (
        <p className="text-[13px] text-down" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Editor                                                                     */
/* -------------------------------------------------------------------------- */

const MODES = ["Holdings", "Import file", "Paste"] as const;
type Mode = (typeof MODES)[number];
const MARKETS = ["US · $", "India · ₹"] as const;
const MARKET_OF: Record<(typeof MARKETS)[number], Market> = { "US · $": "US", "India · ₹": "IN" };
const LABEL_OF: Record<Market, (typeof MARKETS)[number]> = { US: "US · $", IN: "India · ₹" };

interface ImportSummary {
  count: number;
  source: string;
  matches: boolean | null;
  statementValue?: number;
  missingCost: number;
}

function EditorForm({ onClose }: { onClose: () => void }) {
  const { input, portfolio, save, resetToSample } = usePortfolio();
  const [market, setMarket] = useState<Market>(input.market ?? "US");
  const [rows, setRows] = useState<Row[]>(() => (input.holdings.length ? input.holdings.map(fromPosition) : [blankRow()]));
  const [cash, setCash] = useState(String(input.cash));
  const [source, setSource] = useState(input.source);
  const [mode, setMode] = useState<Mode>("Holdings");
  const [pasted, setPasted] = useState("");
  const [pasteErrors, setPasteErrors] = useState<string[]>([]);
  const [imported, setImported] = useState<ImportSummary | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const listId = useId();
  const firstField = useRef<HTMLInputElement>(null);
  const m = makeMoney(CURRENCY[market]);

  useEffect(() => {
    firstField.current?.focus();
  }, []);

  const filled = rows.filter((r) => !isBlank(r));
  const errors = new Map(filled.map((r) => [r.key, validate(r, market)]));
  const invalidCount = [...errors.values()].filter((e) => Object.keys(e).length).length;
  const cashValue = cash.trim() === "" ? 0 : num(cash);
  const cashError = !(cashValue >= 0) ? "Cash can't be negative." : undefined;

  const valueOf = (r: Row) => {
    const quote = resolveQuote(toPosition(r), market);
    const shares = num(r.shares);
    return quote && shares > 0 ? quote.price * shares : 0;
  };
  const total = filled.reduce((acc, r) => acc + valueOf(r), 0) + (cashValue > 0 ? cashValue : 0);

  const update = (key: number, patch: Partial<Row>) =>
    setRows((current) => current.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (invalidCount > 0 || cashError || filled.length === 0) {
      return;
    }
    const next: PortfolioInput = {
      market,
      source,
      cash: cashValue > 0 ? cashValue : 0,
      holdings: filled.map(toPosition),
    };
    save(next);
    onClose();
  };

  const onImported = (result: ImportResult) => {
    const nextRows = result.rows.map(fromPosition);
    setRows(nextRows);
    setMarket(result.market);
    setSource(result.source);
    // Holdings exports don't include cash, and the old figure may be another currency.
    setCash("0");
    const importedValue = result.rows.reduce((acc, r) => {
      const quote = resolveQuote(r, result.market);
      return acc + (quote ? quote.price * r.shares : 0);
    }, 0);
    setImported({
      count: result.rows.length,
      source: result.source,
      statementValue: result.statementValue,
      matches: result.statementValue ? Math.abs(importedValue - result.statementValue) < Math.max(1, result.statementValue * 0.001) : null,
      missingCost: result.rows.filter((r) => r.costUnknown).length,
    });
    setSubmitted(true);
    setMode("Holdings");
  };

  const fieldClass = (invalid: boolean) =>
    cn(
      "num h-10 w-full min-w-0 rounded-[8px] border bg-black px-3 text-[14px] text-ink placeholder:text-ink-muted focus:border-brand-text focus:outline-none",
      invalid ? "border-down" : "border-edge"
    );

  return (
    <form className="flex min-h-0 flex-1 flex-col" noValidate onSubmit={onSubmit}>
      <datalist id={listId}>
        {KNOWN_TICKERS[market].map((t) => (
          <option key={t} value={t}>
            {QUOTES[market][t].name}
          </option>
        ))}
      </datalist>

      <div className="flex flex-wrap items-center justify-between gap-3 px-6 pt-4 max-md:px-4" data-editor-item>
        <Segmented label="Entry mode" onChange={setMode} options={MODES} value={mode} />
        <Segmented
          label="Market and currency"
          onChange={(label) => setMarket(MARKET_OF[label])}
          options={MARKETS}
          value={LABEL_OF[market]}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-4 max-md:px-4">
        {mode === "Import file" ? (
          <ImportPanel onImported={onImported} />
        ) : mode === "Holdings" ? (
          <div className="flex flex-col gap-3" data-editor-item>
            {imported ? (
              <div className="rounded-[10px] border border-brand-text/60 bg-brand/10 p-3 text-[13px] text-ink-2 leading-5" role="status">
                <p className="text-ink">
                  Imported {imported.count} {imported.count === 1 ? "holding" : "holdings"} from {imported.source}.
                </p>
                {imported.matches !== null && imported.statementValue ? (
                  <p className={imported.matches ? "text-up" : "text-warn"}>
                    {imported.matches
                      ? `Total matches your statement: ${m.money(imported.statementValue)}.`
                      : `Total differs from your statement's ${m.money(imported.statementValue)}; check the rows below.`}
                  </p>
                ) : null}
                {imported.missingCost ? (
                  <p className="text-warn">
                    {imported.missingCost} {imported.missingCost === 1 ? "holding has" : "holdings have"} no purchase price in
                    the file. Add your average cost to see returns, or save as is.
                  </p>
                ) : null}
                <p>Review the rows, then save.</p>
              </div>
            ) : null}

            <div aria-hidden className="grid grid-cols-[1.1fr_0.9fr_1fr_40px] gap-2 text-[12px] text-ink-2">
              <span>Ticker</span>
              <span>Shares</span>
              <span>Avg cost</span>
              <span />
            </div>

            <ul className="flex flex-col gap-3">
              {rows.map((row, index) => {
                const e = submitted ? (errors.get(row.key) ?? {}) : {};
                const ticker = cleanTicker(row.ticker);
                const quote = ticker ? resolveQuote(toPosition(row), market) : null;
                const known = quote && !quote.custom ? quote : null;
                const needsPrice = ticker.length > 0 && !known;
                const shares = num(row.shares);
                const describedBy = `row-${row.key}-help`;
                const messages = Object.values(e);
                return (
                  <li className="flex flex-col gap-1.5" key={row.key}>
                    <div className="grid grid-cols-[1.1fr_0.9fr_1fr_40px] gap-2">
                      <input
                        aria-describedby={describedBy}
                        aria-invalid={Boolean(e.ticker)}
                        aria-label={`Ticker, holding ${index + 1}`}
                        autoCapitalize="characters"
                        autoComplete="off"
                        className={cn(fieldClass(Boolean(e.ticker)), "uppercase")}
                        list={listId}
                        onChange={(ev) =>
                          // A new ticker means the statement's name, ISIN and price no longer apply.
                          update(row.key, { ticker: ev.target.value.toUpperCase(), meta: undefined, price: row.meta ? "" : row.price })
                        }
                        placeholder={market === "IN" ? "NIFTYBEES" : "AAPL"}
                        ref={index === 0 ? firstField : undefined}
                        spellCheck={false}
                        value={row.ticker}
                      />
                      <input
                        aria-describedby={describedBy}
                        aria-invalid={Boolean(e.shares)}
                        aria-label={`Shares, holding ${index + 1}`}
                        className={fieldClass(Boolean(e.shares))}
                        inputMode="decimal"
                        onChange={(ev) => update(row.key, { shares: ev.target.value })}
                        placeholder="10"
                        value={row.shares}
                      />
                      <input
                        aria-describedby={describedBy}
                        aria-invalid={Boolean(e.avgCost)}
                        aria-label={`Average cost per share, holding ${index + 1}`}
                        className={cn(fieldClass(Boolean(e.avgCost)), row.costUnknown && !row.avgCost && "border-warn/70")}
                        inputMode="decimal"
                        onChange={(ev) => update(row.key, { avgCost: ev.target.value })}
                        placeholder={row.costUnknown ? "Add cost" : "150.00"}
                        value={row.avgCost}
                      />
                      <button
                        aria-label={`Remove ${ticker || `holding ${index + 1}`}`}
                        className="inline-flex size-10 items-center justify-center rounded-[8px] text-ink-2 transition-colors duration-150 hover:bg-hairline hover:text-down"
                        onClick={() => setRows((current) => (current.length > 1 ? current.filter((r) => r.key !== row.key) : [blankRow()]))}
                        type="button"
                      >
                        <Trash2 aria-hidden className="size-4" />
                      </button>
                    </div>

                    {needsPrice && !row.meta ? (
                      <div className="grid grid-cols-[1.1fr_1.9fr_40px] items-center gap-2">
                        <label className="text-[12px] text-ink-2" htmlFor={`price-${row.key}`}>
                          Today&apos;s price
                        </label>
                        <input
                          aria-describedby={describedBy}
                          aria-invalid={Boolean(e.price)}
                          className={fieldClass(Boolean(e.price))}
                          id={`price-${row.key}`}
                          inputMode="decimal"
                          onChange={(ev) => update(row.key, { price: ev.target.value })}
                          placeholder="25.00"
                          value={row.price}
                        />
                      </div>
                    ) : null}

                    <p className="text-[12px] leading-4" id={describedBy}>
                      {messages.length ? (
                        <span className="text-down">{messages.join(" ")}</span>
                      ) : quote ? (
                        <span className="text-ink-2">
                          {quote.name} · {m.money(quote.price)}
                          {row.meta && row.price ? " (from your statement)" : ""}
                          {shares > 0 ? <span className="num text-ink"> · {m.money(quote.price * shares)}</span> : null}
                          {quote.custom ? " · no price history, shown flat" : ""}
                          {row.costUnknown && !row.avgCost ? <span className="text-warn"> · no purchase price</span> : null}
                        </span>
                      ) : null}
                    </p>
                  </li>
                );
              })}
            </ul>

            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded-[8px] border border-edge border-dashed text-[14px] text-ink-2 transition-colors duration-150 hover:border-brand-text hover:text-ink"
              onClick={() => setRows((current) => [...current, blankRow()])}
              type="button"
            >
              <Plus aria-hidden className="size-4" /> Add holding
            </button>

            <div className="mt-2 grid grid-cols-[1.1fr_1.9fr_40px] items-center gap-2 border-hairline border-t pt-4">
              <label className="text-[14px] text-ink" htmlFor="editor-cash">
                Cash
              </label>
              <input
                aria-describedby="editor-cash-help"
                aria-invalid={Boolean(cashError)}
                className={fieldClass(Boolean(cashError))}
                id="editor-cash"
                inputMode="decimal"
                onChange={(ev) => setCash(ev.target.value)}
                placeholder="0"
                value={cash}
              />
            </div>
            <p className="text-[12px] text-ink-2" id="editor-cash-help">
              {cashError ? <span className="text-down">{cashError}</span> : `Uninvested cash, in ${market === "IN" ? "rupees" : "dollars"}.`}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3" data-editor-item>
            <label className="text-[14px] text-ink" htmlFor="editor-paste">
              One holding per line: ticker, shares, average cost
            </label>
            <p className="text-[12px] text-ink-2" id="editor-paste-help">
              Add a fourth column with today&apos;s price for tickers outside the price book. Importing replaces the rows in
              the Holdings tab.
            </p>
            <textarea
              aria-describedby="editor-paste-help"
              className="num min-h-56 w-full rounded-[10px] border border-edge bg-black p-3 text-[14px] text-ink leading-6 placeholder:text-ink-muted focus:border-brand-text focus:outline-none"
              id="editor-paste"
              onChange={(ev) => setPasted(ev.target.value)}
              placeholder={market === "IN" ? "NIFTYBEES, 100, 250.50\nTCS, 2, 3400" : "NVDA, 214, 62.40\nAAPL, 104, 158.30"}
              spellCheck={false}
              value={pasted}
            />
            {pasteErrors.length ? (
              <ul className="flex flex-col gap-1 text-[12px] text-down" role="alert">
                {pasteErrors.map((err) => (
                  <li key={err}>{err}</li>
                ))}
              </ul>
            ) : null}
            <button
              className="inline-flex h-10 items-center justify-center rounded-[8px] border border-edge text-[14px] text-ink transition-colors duration-150 hover:border-brand-text disabled:border-hairline disabled:text-ink-muted"
              disabled={!pasted.trim()}
              onClick={() => {
                const parsed = parsePasted(pasted, market);
                setPasteErrors(parsed.errors);
                if (parsed.rows.length) {
                  setRows(parsed.rows);
                  setImported(null);
                  setSource(undefined);
                  setMode("Holdings");
                  setSubmitted(true);
                }
              }}
              type="button"
            >
              Use these rows
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 border-hairline border-t px-6 py-4 max-md:px-4" data-editor-item>
        <p className="flex items-baseline justify-between text-[13px] text-ink-2">
          <span>
            {filled.length} {filled.length === 1 ? "holding" : "holdings"}
            {cashValue > 0 ? " + cash" : ""}
          </span>
          <span className="num text-[15px] text-ink">{m.money(total)}</span>
        </p>
        {submitted && (invalidCount > 0 || filled.length === 0) ? (
          <p className="text-[13px] text-down" role="alert">
            {filled.length === 0
              ? "Add at least one holding to save."
              : `Fix ${invalidCount} ${invalidCount === 1 ? "holding" : "holdings"} to save.`}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="mr-auto h-10 rounded-[8px] px-3 text-[14px] text-ink-2 transition-colors duration-150 hover:text-ink disabled:text-ink-muted"
            disabled={portfolio.isSample}
            onClick={() => {
              resetToSample();
              onClose();
            }}
            type="button"
          >
            Reset to sample
          </button>
          <button
            className="h-10 rounded-[8px] border border-edge px-4 text-[14px] text-ink transition-colors duration-150 hover:border-ink-2"
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="h-10 rounded-[8px] bg-ink px-4 font-medium text-[14px] text-black transition-opacity duration-150 hover:opacity-90"
            type="submit"
          >
            Save portfolio
          </button>
        </div>
      </div>
    </form>
  );
}

/**
 * Side sheet for entering or importing your holdings. Prices come from your
 * statement or the mock price book; everything is saved in this browser only.
 */
export function PortfolioEditor() {
  const { editorOpen, closeEditor, portfolio } = usePortfolio();
  const [present, setPresent] = useState(editorOpen);
  const root = useRef<HTMLDivElement>(null);
  const invoker = useRef<HTMLElement | null>(null);

  // Mount on open; on close, play the exit before unmounting.
  if (editorOpen && !present) {
    setPresent(true);
  }

  const { contextSafe } = useGSAP(
    () => {
      if (!present || !editorOpen || !root.current) {
        return;
      }
      invoker.current = document.activeElement as HTMLElement | null;
      if (prefersReducedMotion()) {
        return;
      }
      gsap
        .timeline({ defaults: { ease: EASE_ENTER } })
        .fromTo("[data-editor-backdrop]", { opacity: 0 }, { opacity: 1, duration: DURATION.base }, 0)
        .fromTo("[data-editor-panel]", { x: 48, opacity: 0 }, { x: 0, opacity: 1, duration: DURATION.transition }, 0)
        .fromTo("[data-editor-item]", { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: DURATION.base, stagger: 0.05 }, 0.15);
    },
    { scope: root, dependencies: [present, editorOpen] }
  );

  useEffect(() => {
    if (editorOpen || !present) {
      return;
    }
    const finish = () => {
      setPresent(false);
      invoker.current?.focus({ preventScroll: true });
    };
    if (prefersReducedMotion()) {
      finish();
      return;
    }
    const exit = contextSafe(() => {
      gsap
        .timeline({ defaults: { ease: EASE_FRAMER }, onComplete: finish })
        .to("[data-editor-panel]", { x: 48, opacity: 0, duration: DURATION.base }, 0)
        .to("[data-editor-backdrop]", { opacity: 0, duration: DURATION.base }, 0);
    });
    exit();
  }, [editorOpen, present, contextSafe]);

  // Lock the page behind the sheet.
  useEffect(() => {
    if (!present) {
      return;
    }
    const html = document.documentElement;
    const previous = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      html.style.overflow = previous;
    };
  }, [present]);

  if (!present) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[9] flex justify-end"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          closeEditor();
        }
      }}
      ref={root}
    >
      <div aria-hidden className="absolute inset-0 bg-black/75" data-editor-backdrop onClick={closeEditor} />
      <div
        aria-describedby="editor-description"
        aria-labelledby="editor-title"
        aria-modal="true"
        className="relative flex h-full w-full max-w-[560px] flex-col border-hairline border-l bg-black"
        data-editor-panel
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4 border-hairline border-b px-6 py-5 max-md:px-4" data-editor-item>
          <div>
            <h2 className="font-display text-[28px] text-ink leading-tight" id="editor-title">
              Your portfolio
            </h2>
            <p className="mt-1 max-w-[420px] text-[13px] text-ink-2 leading-5" id="editor-description">
              Enter or import what you hold and every chart, stat and answer updates to match. Prices come from your
              statement or mock quotes as of{" "}
              {AS_OF.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}; earlier moves are
              simulated. Saved only in this browser.
              {portfolio.isSample ? " You're looking at the sample right now." : ""}
            </p>
          </div>
          <button
            aria-label="Close"
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-[8px] border border-edge text-ink-2 transition-colors duration-150 hover:text-ink"
            onClick={closeEditor}
            type="button"
          >
            <X aria-hidden className="size-4" />
          </button>
        </div>
        {editorOpen ? <EditorForm onClose={closeEditor} /> : <div className="flex-1" />}
      </div>
    </div>
  );
}
