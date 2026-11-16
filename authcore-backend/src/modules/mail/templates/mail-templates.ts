import { escapeHtml } from '@common/utils/html.util';
import { PROJECT } from '@config/project';

import { MailContent } from '../interfaces/mail-message.interface';
import type { MailMessages } from '../locales/en.locale';
import { formatMailDate, messagesFor } from '../locales/mail-locales';

/*
 * Plain, dependency-free templates in the reader's language (locales/*):
 * pass `locale` (user.preferences.language) and `timeZone`
 * (user.preferences.timezone); unknown languages fall back to English. Every
 * value from a user (names, reasons) is HTML-escaped.
 */

/** Language and time zone of the reader. */
export interface MailLocaleParams {
  locale?: string | null;
  timeZone?: string | null;
}

interface Layout {
  appName: string;
  language: string;
  heading: string;
  paragraphs: string[];
  /** Already-escaped HTML block inserted after the paragraphs. */
  highlightHtml?: string;
  footer?: string;
  /** "Need help? …" line (project support email), localized. */
  helpLine?: string;
}

const BRAND = PROJECT.branding;

function brandHeader(appName: string): string {
  return BRAND.logoUrl
    ? `<p style="margin:0 0 24px"><img src="${escapeHtml(BRAND.logoUrl)}" alt="${escapeHtml(appName)}" style="max-height:40px;border:0"></p>`
    : `<p style="margin:0 0 24px;font-weight:bold;color:${BRAND.primaryColor}">${escapeHtml(appName)}</p>`;
}

function renderHtml(layout: Layout): string {
  const paragraphs = layout.paragraphs
    .map((text) => `<p style="margin:0 0 16px">${escapeHtml(text)}</p>`)
    .join('');
  const footer = layout.footer
    ? `<p style="margin:24px 0 0;color:#6b7280;font-size:13px">${escapeHtml(layout.footer)}</p>`
    : '';
  return (
    `<!doctype html><html lang="${escapeHtml(layout.language)}"><head><meta charset="utf-8"></head>` +
    '<body style="margin:0;padding:24px;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827">' +
    '<div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:8px;padding:32px">' +
    brandHeader(layout.appName) +
    `<h1 style="margin:0 0 16px;font-size:20px">${escapeHtml(layout.heading)}</h1>` +
    paragraphs +
    (layout.highlightHtml ?? '') +
    footer +
    (layout.helpLine
      ? `<p style="margin:8px 0 0;color:#6b7280;font-size:13px">${escapeHtml(layout.helpLine)}</p>`
      : '') +
    '</div></body></html>'
  );
}

function codeBlock(code: string): string {
  return `<p style="margin:8px 0 24px;font-size:32px;letter-spacing:8px;font-weight:bold">${escapeHtml(code)}</p>`;
}

function buttonBlock(link: string, label: string): string {
  const safeLink = escapeHtml(link);
  return (
    `<p style="margin:8px 0 16px"><a href="${safeLink}" style="display:inline-block;background:${BRAND.primaryColor};color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:6px">${escapeHtml(label)}</a></p>` +
    `<p style="margin:0 0 16px;font-size:13px;color:#6b7280;word-break:break-all">${safeLink}</p>`
  );
}

function languageOf(params: MailLocaleParams): string {
  return messagesFor(params.locale).dateLocale.split('-')[0] ?? 'en';
}

/** Greeting + paragraphs (+ code / button), as text and HTML. */
function build(params: {
  appName: string;
  locale: MailLocaleParams;
  subject: string;
  heading: string;
  greeting: string;
  paragraphs: string[];
  code?: string;
  button?: { link: string; label: string };
  footer?: string;
}): MailContent {
  const paragraphs = [params.greeting, ...params.paragraphs];
  const extraText = params.code ?? params.button?.link;
  const helpLine = BRAND.supportEmail
    ? messagesFor(params.locale.locale).common.needHelp(BRAND.supportEmail)
    : undefined;
  const text =
    paragraphs.join('\n\n') +
    (extraText ? `\n\n${extraText}` : '') +
    (params.footer ? `\n\n${params.footer}` : '') +
    (helpLine ? `\n\n${helpLine}` : '') +
    '\n';
  return {
    subject: params.subject,
    text,
    html: renderHtml({
      appName: params.appName,
      language: languageOf(params.locale),
      heading: params.heading,
      paragraphs,
      ...(params.code ? { highlightHtml: codeBlock(params.code) } : {}),
      ...(params.button
        ? {
            highlightHtml: buttonBlock(params.button.link, params.button.label),
          }
        : {}),
      ...(params.footer ? { footer: params.footer } : {}),
      ...(helpLine ? { helpLine } : {}),
    }),
  };
}

type Base = { appName: string; firstName: string } & MailLocaleParams;

function setup(params: Base): { m: MailMessages; greeting: string } {
  const m = messagesFor(params.locale);
  return { m, greeting: m.common.greeting(params.firstName) };
}

export function verificationCodeEmail(
  params: Base & { code: string; ttlMinutes: number },
): MailContent {
  const { m, greeting } = setup(params);
  const t = m.verificationCode;
  return build({
    appName: params.appName,
    locale: params,
    subject: t.subject(params.code, params.appName),
    heading: t.heading,
    greeting,
    paragraphs: [t.intro(params.appName, params.ttlMinutes)],
    code: params.code,
    footer: t.footer,
  });
}

export function verificationLinkEmail(
  params: Base & { link: string; ttlMinutes: number },
): MailContent {
  const { m, greeting } = setup(params);
  const t = m.verificationLink;
  return build({
    appName: params.appName,
    locale: params,
    subject: t.subject(params.appName),
    heading: t.heading,
    greeting,
    paragraphs: [t.intro(params.appName, params.ttlMinutes)],
    button: { link: params.link, label: t.button },
    footer: t.footer,
  });
}

export function pendingApprovalEmail(params: Base): MailContent {
  const { m, greeting } = setup(params);
  const t = m.pendingApproval;
  return build({
    appName: params.appName,
    locale: params,
    subject: t.subject(params.appName),
    heading: t.heading,
    greeting,
    paragraphs: [t.body(params.appName)],
  });
}

export function accountApprovedEmail(params: Base): MailContent {
  const { m, greeting } = setup(params);
  const t = m.accountApproved;
  return build({
    appName: params.appName,
    locale: params,
    subject: t.subject(params.appName),
    heading: t.heading,
    greeting,
    paragraphs: [t.body(params.appName)],
  });
}

export function accountRejectedEmail(
  params: Base & { reason?: string },
): MailContent {
  const { m, greeting } = setup(params);
  const t = m.accountRejected;
  return build({
    appName: params.appName,
    locale: params,
    subject: t.subject(params.appName),
    heading: t.heading,
    greeting,
    paragraphs: [
      t.body(params.appName),
      ...(params.reason ? [m.common.reason(params.reason)] : []),
    ],
  });
}

export function passwordResetCodeEmail(
  params: Base & { code: string; ttlMinutes: number },
): MailContent {
  const { m, greeting } = setup(params);
  const t = m.passwordResetCode;
  return build({
    appName: params.appName,
    locale: params,
    subject: t.subject(params.code, params.appName),
    heading: t.heading,
    greeting,
    paragraphs: [t.intro(params.appName, params.ttlMinutes)],
    code: params.code,
    footer: t.footer,
  });
}

export function passwordResetLinkEmail(
  params: Base & { link: string; ttlMinutes: number },
): MailContent {
  const { m, greeting } = setup(params);
  const t = m.passwordResetLink;
  return build({
    appName: params.appName,
    locale: params,
    subject: t.subject(params.appName),
    heading: t.heading,
    greeting,
    paragraphs: [t.intro(params.appName, params.ttlMinutes)],
    button: { link: params.link, label: t.button },
    footer: t.footer,
  });
}

export function passwordChangedEmail(
  params: Base & { isReset: boolean },
): MailContent {
  const { m, greeting } = setup(params);
  const t = m.passwordChanged;
  return build({
    appName: params.appName,
    locale: params,
    subject: params.isReset
      ? t.subjectReset(params.appName)
      : t.subjectChanged(params.appName),
    heading: params.isReset ? t.headingReset : t.headingChanged,
    greeting,
    paragraphs: [
      params.isReset
        ? t.bodyReset(params.appName)
        : t.bodyChanged(params.appName),
    ],
    footer: t.footer,
  });
}

export function passwordExpiryReminderEmail(
  params: Base & { daysLeft: number; expiresAt: Date },
): MailContent {
  const { m, greeting } = setup(params);
  const t = m.passwordExpiry;
  const when = params.daysLeft === 1 ? t.tomorrow : t.inDays(params.daysLeft);
  return build({
    appName: params.appName,
    locale: params,
    subject: t.subject(params.appName, when),
    heading: t.heading,
    greeting,
    paragraphs: [
      t.body(
        params.appName,
        when,
        formatMailDate(params.expiresAt, m, params.timeZone),
      ),
    ],
    footer: t.footer,
  });
}

export function emailChangeCodeEmail(
  params: Base & { code: string; ttlMinutes: number },
): MailContent {
  const { m, greeting } = setup(params);
  const t = m.emailChangeCode;
  return build({
    appName: params.appName,
    locale: params,
    subject: t.subject(params.code, params.appName),
    heading: t.heading,
    greeting,
    paragraphs: [
      `${t.intro(params.appName)} ${m.common.expiresIn(params.ttlMinutes)}`,
    ],
    code: params.code,
    footer: t.footer,
  });
}

export function emailChangedNoticeEmail(
  params: Base & { newEmail: string },
): MailContent {
  const { m, greeting } = setup(params);
  const t = m.emailChanged;
  return build({
    appName: params.appName,
    locale: params,
    subject: t.subject(params.appName),
    heading: t.heading,
    greeting,
    paragraphs: [t.body(params.appName, params.newEmail)],
    footer: m.common.notYou,
  });
}

export function accountDeactivatedEmail(params: Base): MailContent {
  const { m, greeting } = setup(params);
  const t = m.accountDeactivated;
  return build({
    appName: params.appName,
    locale: params,
    subject: t.subject(params.appName),
    heading: t.heading,
    greeting,
    paragraphs: [t.body],
    footer: m.common.notYou,
  });
}

export function accountDeletionScheduledEmail(
  params: Base & { deletionDate: Date },
): MailContent {
  const { m, greeting } = setup(params);
  const t = m.deletionScheduled;
  return build({
    appName: params.appName,
    locale: params,
    subject: t.subject(params.appName),
    heading: t.heading,
    greeting,
    paragraphs: [
      t.body(formatMailDate(params.deletionDate, m, params.timeZone)),
      t.undo,
    ],
    footer: m.common.notYou,
  });
}

export function accountRecoveryCodeEmail(
  params: Base & { code: string; ttlMinutes: number },
): MailContent {
  const { m, greeting } = setup(params);
  const t = m.recoveryCode;
  return build({
    appName: params.appName,
    locale: params,
    subject: t.subject(params.code, params.appName),
    heading: t.heading,
    greeting,
    paragraphs: [
      `${t.intro(params.appName)} ${m.common.expiresIn(params.ttlMinutes)}`,
    ],
    code: params.code,
    footer: t.footer,
  });
}

export function accountRecoveredEmail(params: Base): MailContent {
  const { m, greeting } = setup(params);
  const t = m.recovered;
  return build({
    appName: params.appName,
    locale: params,
    subject: t.subject(params.appName),
    heading: t.heading,
    greeting,
    paragraphs: [t.body],
    footer: m.common.notYou,
  });
}

export function accountStatusChangedEmail(
  params: Base & {
    status: 'ACTIVE' | 'SUSPENDED' | 'BANNED' | 'INACTIVE';
    reason: string | null;
  },
): MailContent {
  const { m, greeting } = setup(params);
  const t = m.statusChanged;
  const heading = t.headings[params.status];
  return build({
    appName: params.appName,
    locale: params,
    subject: t.subject(params.appName, heading),
    heading,
    greeting,
    paragraphs: [
      t.bodies[params.status],
      ...(params.reason ? [m.common.reason(params.reason)] : []),
    ],
    footer: m.common.contactSupport,
  });
}

export function adminCreatedAccountEmail(
  params: Base & { email: string; mustChangePassword: boolean },
): MailContent {
  const { m, greeting } = setup(params);
  const t = m.adminCreated;
  return build({
    appName: params.appName,
    locale: params,
    subject: t.subject(params.appName),
    heading: t.heading,
    greeting,
    paragraphs: [
      t.body(params.appName, params.email),
      ...(params.mustChangePassword ? [t.mustChange] : []),
    ],
  });
}

export function userInviteEmail(
  params: {
    appName: string;
    firstName: string | null;
    inviterName: string;
    link: string;
    expiresAt: Date;
    message: string | null;
  } & MailLocaleParams,
): MailContent {
  const m = messagesFor(params.locale);
  const t = m.invite;
  return build({
    appName: params.appName,
    locale: params,
    subject: t.subject(params.inviterName, params.appName),
    heading: t.heading,
    greeting: params.firstName
      ? m.common.greeting(params.firstName)
      : m.common.greetingAnonymous,
    paragraphs: [
      t.intro(
        params.inviterName,
        params.appName,
        formatMailDate(params.expiresAt, m, params.timeZone),
      ),
      ...(params.message ? [m.common.message(params.message)] : []),
    ],
    button: { link: params.link, label: t.button },
    footer: t.footer,
  });
}

export function passwordSetByAdminEmail(
  params: Base & { mustChangePassword: boolean },
): MailContent {
  const { m, greeting } = setup(params);
  const t = m.passwordSetByAdmin;
  return build({
    appName: params.appName,
    locale: params,
    subject: t.subject(params.appName),
    heading: t.heading,
    greeting,
    paragraphs: [t.body, ...(params.mustChangePassword ? [t.mustChange] : [])],
    footer: m.common.notYou,
  });
}

export function newDeviceLoginEmail(
  params: Base & { at: Date; deviceName: string; ipAddress: string },
): MailContent {
  const { m, greeting } = setup(params);
  const t = m.newDevice;
  return build({
    appName: params.appName,
    locale: params,
    subject: t.subject(params.appName),
    heading: t.heading,
    greeting,
    paragraphs: [
      t.intro,
      t.when(formatMailDate(params.at, m, params.timeZone)),
      t.device(params.deviceName),
      t.ip(params.ipAddress),
      t.ifYou,
    ],
    footer: t.footer,
  });
}

export function accountLockedEmail(
  params: Base & {
    lockedUntil: Date;
    attempts: number;
    ipAddress: string;
    /** ip: only that IP address is locked out; account: every sign-in. */
    scope?: 'ip' | 'account';
  },
): MailContent {
  const { m, greeting } = setup(params);
  const t = m.accountLocked;
  return build({
    appName: params.appName,
    locale: params,
    subject: t.subject(params.appName),
    heading: t.heading,
    greeting,
    paragraphs: [
      params.scope === 'ip'
        ? t.bodyIp(params.attempts, params.ipAddress)
        : t.body(params.attempts, params.ipAddress),
      t.retry(formatMailDate(params.lockedUntil, m, params.timeZone)),
      t.forgot,
    ],
    footer: t.footer,
  });
}
