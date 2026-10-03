/**
 * Display formatting.
 *
 * Currency and locale come from hotel settings, so every helper accepts them
 * rather than hard-coding a locale. Defaults match the seeded hotel (INR).
 */

export interface CurrencyOptions {
  currency?: string;
  locale?: string;
  symbol?: string;
  maximumFractionDigits?: number;
}

export function formatCurrency(
  amount: number | null | undefined,
  options: CurrencyOptions = {},
): string {
  const value = typeof amount === "number" && Number.isFinite(amount) ? amount : 0;
  const { currency = "INR", locale = "en-IN", maximumFractionDigits = 2 } = options;

  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits,
    }).format(value);
  } catch {
    // An unrecognised currency code should degrade, not crash a page.
    return `${options.symbol ?? ""}${value.toFixed(2)}`;
  }
}

/** Compact form for chart axes and stat tiles: ₹1.2L, ₹48.5K. */
export function formatCompactCurrency(
  amount: number,
  options: CurrencyOptions = {},
): string {
  const { currency = "INR", locale = "en-IN" } = options;
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(amount);
  } catch {
    return formatCurrency(amount, options);
  }
}

export function formatNumber(value: number, locale = "en-IN"): string {
  return new Intl.NumberFormat(locale).format(value);
}

export function formatPercent(value: number, fractionDigits = 1): string {
  return `${value.toFixed(fractionDigits)}%`;
}

/**
 * Stay dates are stored at UTC midnight, so they are formatted in UTC. Reading
 * them in the browser's local zone would shift "10 Oct" to "9 Oct" west of
 * Greenwich.
 */
export function formatStayDate(
  value: string | Date | null | undefined,
  locale = "en-IN",
): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

export function formatStayDateShort(
  value: string | Date | null | undefined,
  locale = "en-IN",
): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  }).format(d);
}

/** Actual timestamps (check-in/out times, payments) are real moments in time. */
export function formatDateTime(
  value: string | Date | null | undefined,
  locale = "en-IN",
): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function formatTime(
  value: string | Date | null | undefined,
  locale = "en-IN",
): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function formatRelative(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return "—";
  const diff = Date.now() - then;
  const minutes = Math.round(diff / 60_000);

  if (Math.abs(minutes) < 1) return "just now";
  if (Math.abs(minutes) < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) return `${days}d ago`;
  return formatStayDate(value);
}

export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** `YYYY-MM-DD` for `<input type="date">`, computed in UTC. */
export function toDateInputValue(value: string | Date | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}
