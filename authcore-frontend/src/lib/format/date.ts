import { getFormatDefaults } from './locale';

export type DateInput = string | number | Date | null | undefined;

const toDate = (value: DateInput): Date | null => {
  if (value === null || value === undefined || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

export interface FormatDateOptions {
  /** date: "17 Nov 2026" · time: "14:05" · datetime: both · relative: "3 hours ago". */
  style?: 'date' | 'time' | 'datetime' | 'relative';
  /** IANA zone; default: the user's preference (setFormatDefaults) or the browser's. */
  timeZone?: string;
  /** BCP 47 locale; default: the user's preference or the browser's. */
  locale?: string;
}

const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 31_536_000],
  ['month', 2_592_000],
  ['week', 604_800],
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
  ['second', 1],
];

/** "3 hours ago", "in 2 days", "just now". */
export function formatRelative(
  value: DateInput,
  locale?: string,
  now: number = Date.now(),
): string {
  const d = toDate(value);
  if (!d) return '-';
  const seconds = Math.round((d.getTime() - now) / 1000);
  if (Math.abs(seconds) < 45) return 'just now';
  const rtf = new Intl.RelativeTimeFormat(locale ?? getFormatDefaults().locale, {
    numeric: 'auto',
  });
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return rtf.format(seconds, 'second');
}

/** Localised date / time ("-" for empty or invalid values). */
export function formatDateTime(value: DateInput, options: FormatDateOptions = {}): string {
  const fallback = getFormatDefaults();
  const { style = 'datetime', timeZone = fallback.timeZone, locale = fallback.locale } = options;
  const d = toDate(value);
  if (!d) return '-';
  if (style === 'relative') return formatRelative(d, locale);
  const parts: Intl.DateTimeFormatOptions =
    style === 'date'
      ? { year: 'numeric', month: 'short', day: 'numeric' }
      : style === 'time'
        ? { hour: '2-digit', minute: '2-digit' }
        : { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
  try {
    return new Intl.DateTimeFormat(locale, { ...parts, timeZone }).format(d);
  } catch {
    // unknown time zone → browser zone
    return new Intl.DateTimeFormat(locale, parts).format(d);
  }
}

/** Short date + time in the user's locale ("-" for empty values). */
export const formatDate = (value: DateInput): string => formatDateTime(value);
