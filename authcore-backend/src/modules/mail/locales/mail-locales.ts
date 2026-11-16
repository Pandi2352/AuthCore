import { EN_MESSAGES, type MailMessages } from './en.locale';
import { HI_MESSAGES } from './hi.locale';
import { TA_MESSAGES } from './ta.locale';

/** Languages emails are available in (base language codes). */
export const MAIL_LANGUAGES: Record<string, MailMessages> = {
  en: EN_MESSAGES,
  ta: TA_MESSAGES,
  hi: HI_MESSAGES,
};

export const SUPPORTED_MAIL_LANGUAGES = Object.keys(MAIL_LANGUAGES);

/** Language + time zone from a user's preferences (for template params). */
export function mailLocaleOf(user: {
  preferences?: { language?: string; timezone?: string } | null;
}): { locale: string | null; timeZone: string | null } {
  return {
    locale: user.preferences?.language ?? null,
    timeZone: user.preferences?.timezone ?? null,
  };
}

/** "ta-IN" → Tamil, "fr" → English (fallback). */
export function messagesFor(language?: string | null): MailMessages {
  const base = (language ?? 'en').toLowerCase().split('-')[0] ?? 'en';
  return MAIL_LANGUAGES[base] ?? EN_MESSAGES;
}

/**
 * Date and time in the reader's language and time zone, e.g.
 * "16 November 2026 at 15:42 (Asia/Kolkata)". Unknown zones fall back to UTC.
 */
export function formatMailDate(
  date: Date,
  messages: MailMessages,
  timeZone?: string | null,
): string {
  const zone = timeZone ?? 'UTC';
  try {
    return `${new Intl.DateTimeFormat(messages.dateLocale, {
      dateStyle: 'long',
      timeStyle: 'short',
      timeZone: zone,
    }).format(date)} (${zone})`;
  } catch {
    return `${new Intl.DateTimeFormat(messages.dateLocale, {
      dateStyle: 'long',
      timeStyle: 'short',
      timeZone: 'UTC',
    }).format(date)} (UTC)`;
  }
}
