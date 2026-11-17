/**
 * Locale and time zone used by every formatter when the call doesn't pass one.
 * Defaults: the browser's. After sign-in the auth layer sets the user's preferences
 * (profile → language / timezone), so dates and numbers follow the user everywhere.
 */
interface FormatDefaults {
  locale: string | undefined;
  timeZone: string | undefined;
}

const defaults: FormatDefaults = { locale: undefined, timeZone: undefined };

const isValidTimeZone = (zone: string): boolean => {
  try {
    new Intl.DateTimeFormat('en', { timeZone: zone }).format(0);
    return true;
  } catch {
    return false;
  }
};

const isValidLocale = (locale: string): boolean => {
  try {
    return Intl.DateTimeFormat.supportedLocalesOf([locale]).length > 0;
  } catch {
    return false;
  }
};

/** Set (or clear with null) the app-wide locale / time zone. Invalid values are ignored. */
export function setFormatDefaults(next: {
  locale?: string | null;
  timeZone?: string | null;
}): void {
  if (next.locale !== undefined) {
    defaults.locale = next.locale && isValidLocale(next.locale) ? next.locale : undefined;
  }
  if (next.timeZone !== undefined) {
    defaults.timeZone = next.timeZone && isValidTimeZone(next.timeZone) ? next.timeZone : undefined;
  }
}

export const getFormatDefaults = (): Readonly<FormatDefaults> => ({ ...defaults });
