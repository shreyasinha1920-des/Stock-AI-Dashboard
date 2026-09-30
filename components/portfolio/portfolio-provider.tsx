"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import {
  buildPortfolio,
  type Portfolio,
  type PortfolioInput,
  SAMPLE_INPUT,
  SAMPLE_PORTFOLIO,
} from "@/data/portfolio";
import { makeMoney } from "@/lib/format";

/* -------------------------------------------------------------------------- */
/* Storage: this browser only. Falls back to memory if storage is blocked.     */
/* -------------------------------------------------------------------------- */

export const STORAGE_KEY = "aurum.portfolio.v1";
const CHANGE_EVENT = "aurum-portfolio-change";
let memory: string | null = null;

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return memory;
  }
}

function writeRaw(value: string | null) {
  memory = value;
  try {
    if (value === null) {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, value);
    }
  } catch {
    // Private mode or blocked storage: the in-memory copy still works this session.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

/** Parses saved input, rejecting anything malformed rather than crashing. */
function parse(raw: string | null): PortfolioInput | null {
  if (!raw) {
    return null;
  }
  try {
    const data = JSON.parse(raw) as PortfolioInput;
    if (!Array.isArray(data.holdings)) {
      return null;
    }
    const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 120) : undefined);
    return {
      market: data.market === "IN" ? "IN" : "US",
      source: text(data.source),
      cash: Number(data.cash) || 0,
      holdings: data.holdings
        .filter((h) => typeof h.ticker === "string" && Number(h.shares) > 0)
        .map((h) => ({
          ticker: h.ticker,
          shares: Number(h.shares),
          avgCost: Number(h.avgCost) || 0,
          price: h.price ? Number(h.price) : undefined,
          name: text(h.name),
          isin: text(h.isin),
          sector: text(h.sector),
          costUnknown: h.costUnknown === true ? true : undefined,
        })),
    };
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* Context                                                                    */
/* -------------------------------------------------------------------------- */

interface PortfolioContextValue {
  portfolio: Portfolio;
  /** What the editor starts from: your saved holdings, or the sample. */
  input: PortfolioInput;
  save: (input: PortfolioInput) => void;
  resetToSample: () => void;
  editorOpen: boolean;
  openEditor: () => void;
  closeEditor: () => void;
}

const PortfolioContext = createContext<PortfolioContextValue | null>(null);

export function usePortfolio() {
  const value = useContext(PortfolioContext);
  if (!value) {
    throw new Error("usePortfolio must be used inside <PortfolioProvider>");
  }
  return value;
}

export function PortfolioProvider({ children }: { children: ReactNode }) {
  // The server (and first client render) always sees the sample; saved
  // holdings swap in right after hydration without a mismatch.
  const raw = useSyncExternalStore(subscribe, readRaw, () => null);
  const saved = useMemo(() => parse(raw), [raw]);
  const portfolio = useMemo(() => (saved ? buildPortfolio(saved) : SAMPLE_PORTFOLIO), [saved]);
  const [editorOpen, setEditorOpen] = useState(false);

  // The pre-paint script hides the dashboard while saved holdings load, so
  // nobody sees the sample numbers flash first. Reveal once they're in.
  useEffect(() => {
    document.documentElement.classList.remove("portfolio-pending");
  }, [portfolio]);

  const save = useCallback((input: PortfolioInput) => writeRaw(JSON.stringify(input)), []);
  const resetToSample = useCallback(() => writeRaw(null), []);
  const openEditor = useCallback(() => setEditorOpen(true), []);
  const closeEditor = useCallback(() => setEditorOpen(false), []);

  const value = useMemo<PortfolioContextValue>(
    () => ({
      portfolio,
      input: saved ?? SAMPLE_INPUT,
      save,
      resetToSample,
      editorOpen,
      openEditor,
      closeEditor,
    }),
    [portfolio, saved, save, resetToSample, editorOpen, openEditor, closeEditor]
  );

  return <PortfolioContext.Provider value={value}>{children}</PortfolioContext.Provider>;
}

/** Money formatters in the current portfolio's currency ($ or ₹). */
export function useMoney() {
  const { portfolio } = usePortfolio();
  return useMemo(() => makeMoney(portfolio.currency), [portfolio.currency]);
}
