import { getFormatDefaults } from './locale';

type Num = number | bigint | null | undefined;
const DASH = '-';
const ok = (value: Num): value is number | bigint =>
  value !== null && value !== undefined && (typeof value === 'bigint' || Number.isFinite(value));

/** 1234567.891 → "1,234,567.89" (locale grouping; up to 2 decimals by default). */
export function formatNumber(
  value: Num,
  options: Intl.NumberFormatOptions & { locale?: string } = {},
): string {
  if (!ok(value)) return DASH;
  const { locale, ...rest } = options;
  return new Intl.NumberFormat(locale ?? getFormatDefaults().locale, {
    maximumFractionDigits: 2,
    ...rest,
  }).format(value);
}

/** 1532 → "1.5K", 2_400_000 → "2.4M" (dashboards, badges). */
export function formatCompact(value: Num, locale?: string): string {
  if (!ok(value)) return DASH;
  return new Intl.NumberFormat(locale ?? getFormatDefaults().locale, {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

/**
 * Money in a currency (ISO 4217): formatCurrency(1999.5, 'INR') → "₹1,999.50".
 * Amounts are in major units (rupees, dollars) — convert from minor units (paise, cents) first.
 */
export function formatCurrency(
  value: Num,
  currency: string,
  options: Intl.NumberFormatOptions & { locale?: string } = {},
): string {
  if (!ok(value)) return DASH;
  const { locale, ...rest } = options;
  try {
    return new Intl.NumberFormat(locale ?? getFormatDefaults().locale, {
      style: 'currency',
      currency,
      ...rest,
    }).format(value);
  } catch {
    // unknown currency code
    return `${formatNumber(value, { locale })} ${currency}`;
  }
}

/**
 * A ratio as a percentage: formatPercent(0.256) → "25.6%".
 * Pass `{ fromPercent: true }` when the value is already 0–100.
 */
export function formatPercent(
  value: Num,
  options: { fromPercent?: boolean; maximumFractionDigits?: number; locale?: string } = {},
): string {
  if (!ok(value)) return DASH;
  const { fromPercent = false, maximumFractionDigits = 1, locale } = options;
  const ratio = typeof value === 'bigint' ? Number(value) : value;
  return new Intl.NumberFormat(locale ?? getFormatDefaults().locale, {
    style: 'percent',
    maximumFractionDigits,
  }).format(fromPercent ? ratio / 100 : ratio);
}

/** "1 user" / "5 users" using the locale's plural rules. */
export function formatCount(count: number, one: string, other: string, locale?: string): string {
  const rule = new Intl.PluralRules(locale ?? getFormatDefaults().locale).select(count);
  return `${formatNumber(count, { locale })} ${rule === 'one' ? one : other}`;
}
