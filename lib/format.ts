export type Currency = "USD" | "INR";

const LOCALE: Record<Currency, string> = { USD: "en-US", INR: "en-IN" };

/**
 * Money formatters for one currency. INR uses Indian grouping and lakh/crore
 * compact forms (₹10,07,827 · ₹10.1L · ₹3.5Cr); USD the usual $247,111.
 */
export function makeMoney(currency: Currency) {
  const locale = LOCALE[currency];
  const exact = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const whole = new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 });
  const compact = (value: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      notation: "compact",
      maximumFractionDigits: Math.abs(value) >= 100_000 && currency === "USD" ? 0 : 1,
    }).format(value);

  /** $247,111.10 / ₹10,07,827.06 */
  const money = (value: number) => exact.format(value);
  /** $247,111 / ₹10,07,827 */
  const moneyWhole = (value: number) => whole.format(value);
  /** +$1,234 / −₹1,234, using a true minus sign. */
  const signedMoney = (value: number, cents = false) => {
    const body = (cents ? money : moneyWhole)(Math.abs(value));
    if (Math.round(value * (cents ? 100 : 1)) === 0) {
      return body;
    }
    return `${value > 0 ? "+" : "−"}${body}`;
  };
  /** $36k / ₹10.1L, keeping the sign as a true minus. */
  const moneyCompact = (value: number) => (value < 0 ? `−${compact(-value)}` : compact(value));

  return { money, moneyWhole, signedMoney, moneyCompact };
}

export type Money = ReturnType<typeof makeMoney>;

/** 3.41% */
export const pct = (value: number, digits = 2) => `${Math.abs(value).toFixed(digits)}%`;

/** +3.41% / −3.41% */
export const signedPct = (value: number, digits = 2) => {
  const rounded = Number(value.toFixed(digits));
  if (rounded === 0) {
    return `${(0).toFixed(digits)}%`;
  }
  return `${rounded > 0 ? "+" : "−"}${pct(value, digits)}`;
};

export const shortDate = (date: Date) =>
  date.toLocaleDateString("en-US", { month: "short", day: "numeric" });

export const weekdayDate = (date: Date) =>
  date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

export const longDate = (date: Date) =>
  date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

export const time = (date: Date) =>
  date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

export const trend = (value: number): "up" | "down" | "flat" =>
  Math.abs(value) < 0.005 ? "flat" : value > 0 ? "up" : "down";
