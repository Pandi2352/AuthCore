import { escapeHtml } from '@common/utils/html.util';

import { MailContent } from '../interfaces/mail-message.interface';

/*
 * Plain, dependency-free templates. Every value from a user (names, reasons)
 * is HTML-escaped. Rich templating comes with the Email & Notification module.
 */

interface Layout {
  appName: string;
  heading: string;
  paragraphs: string[];
  /** Already-escaped HTML block inserted after the paragraphs. */
  highlightHtml?: string;
  footer?: string;
}

function renderHtml(layout: Layout): string {
  const paragraphs = layout.paragraphs
    .map((text) => `<p style="margin:0 0 16px">${escapeHtml(text)}</p>`)
    .join('');
  const footer = layout.footer
    ? `<p style="margin:24px 0 0;color:#6b7280;font-size:13px">${escapeHtml(layout.footer)}</p>`
    : '';
  return (
    '<!doctype html><html><body style="margin:0;padding:24px;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827">' +
    '<div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:8px;padding:32px">' +
    `<p style="margin:0 0 24px;font-weight:bold;color:#4f46e5">${escapeHtml(layout.appName)}</p>` +
    `<h1 style="margin:0 0 16px;font-size:20px">${escapeHtml(layout.heading)}</h1>` +
    paragraphs +
    (layout.highlightHtml ?? '') +
    footer +
    '</div></body></html>'
  );
}

function greeting(firstName: string): string {
  return `Hi ${firstName},`;
}

export function verificationCodeEmail(params: {
  appName: string;
  firstName: string;
  code: string;
  ttlMinutes: number;
}): MailContent {
  const { appName, firstName, code, ttlMinutes } = params;
  const intro = `Use this code to verify your email address for ${appName}. It expires in ${ttlMinutes} minutes.`;
  const footer =
    "If you didn't create an account, you can ignore this email. Never share this code with anyone.";
  return {
    subject: `${code} is your ${appName} verification code`,
    text: `${greeting(firstName)}\n\n${intro}\n\n${code}\n\n${footer}\n`,
    html: renderHtml({
      appName,
      heading: 'Verify your email',
      paragraphs: [greeting(firstName), intro],
      highlightHtml: `<p style="margin:8px 0 24px;font-size:32px;letter-spacing:8px;font-weight:bold">${escapeHtml(code)}</p>`,
      footer,
    }),
  };
}

export function verificationLinkEmail(params: {
  appName: string;
  firstName: string;
  link: string;
  ttlMinutes: number;
}): MailContent {
  const { appName, firstName, link, ttlMinutes } = params;
  const intro = `Confirm your email address for ${appName} with the button below. The link expires in ${ttlMinutes} minutes and works once.`;
  const footer = "If you didn't create an account, you can ignore this email.";
  const safeLink = escapeHtml(link);
  return {
    subject: `Verify your email for ${appName}`,
    text: `${greeting(firstName)}\n\n${intro}\n\n${link}\n\n${footer}\n`,
    html: renderHtml({
      appName,
      heading: 'Verify your email',
      paragraphs: [greeting(firstName), intro],
      highlightHtml:
        `<p style="margin:8px 0 16px"><a href="${safeLink}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:6px">Verify email</a></p>` +
        `<p style="margin:0 0 16px;font-size:13px;color:#6b7280;word-break:break-all">${safeLink}</p>`,
      footer,
    }),
  };
}

export function pendingApprovalEmail(params: {
  appName: string;
  firstName: string;
}): MailContent {
  const { appName, firstName } = params;
  const body = `Thanks for registering with ${appName}. Your account is waiting for approval by an administrator. We'll email you as soon as it has been reviewed.`;
  return {
    subject: `Your ${appName} account is waiting for approval`,
    text: `${greeting(firstName)}\n\n${body}\n`,
    html: renderHtml({
      appName,
      heading: 'Account pending approval',
      paragraphs: [greeting(firstName), body],
    }),
  };
}

export function accountApprovedEmail(params: {
  appName: string;
  firstName: string;
}): MailContent {
  const { appName, firstName } = params;
  const body = `Good news: your ${appName} account has been approved. You can now sign in.`;
  return {
    subject: `Your ${appName} account has been approved`,
    text: `${greeting(firstName)}\n\n${body}\n`,
    html: renderHtml({
      appName,
      heading: 'Account approved',
      paragraphs: [greeting(firstName), body],
    }),
  };
}

export function accountRejectedEmail(params: {
  appName: string;
  firstName: string;
  reason?: string;
}): MailContent {
  const { appName, firstName, reason } = params;
  const body = `Your registration for ${appName} was not approved.`;
  const paragraphs = [greeting(firstName), body];
  if (reason) {
    paragraphs.push(`Reason: ${reason}`);
  }
  return {
    subject: `Your ${appName} registration was not approved`,
    text: `${paragraphs.join('\n\n')}\n`,
    html: renderHtml({
      appName,
      heading: 'Registration not approved',
      paragraphs,
    }),
  };
}

export function passwordResetCodeEmail(params: {
  appName: string;
  firstName: string;
  code: string;
  ttlMinutes: number;
}): MailContent {
  const { appName, firstName, code, ttlMinutes } = params;
  const intro = `Use this code to reset your ${appName} password. It expires in ${ttlMinutes} minutes.`;
  const footer =
    "If you didn't ask to reset your password, ignore this email: your password stays the same. Never share this code with anyone.";
  return {
    subject: `${code} is your ${appName} password reset code`,
    text: `${greeting(firstName)}\n\n${intro}\n\n${code}\n\n${footer}\n`,
    html: renderHtml({
      appName,
      heading: 'Reset your password',
      paragraphs: [greeting(firstName), intro],
      highlightHtml: `<p style="margin:8px 0 24px;font-size:32px;letter-spacing:8px;font-weight:bold">${escapeHtml(code)}</p>`,
      footer,
    }),
  };
}

export function passwordResetLinkEmail(params: {
  appName: string;
  firstName: string;
  link: string;
  ttlMinutes: number;
}): MailContent {
  const { appName, firstName, link, ttlMinutes } = params;
  const intro = `Reset your ${appName} password with the button below. The link expires in ${ttlMinutes} minutes and works once.`;
  const footer =
    "If you didn't ask to reset your password, ignore this email: your password stays the same.";
  const safeLink = escapeHtml(link);
  return {
    subject: `Reset your ${appName} password`,
    text: `${greeting(firstName)}\n\n${intro}\n\n${link}\n\n${footer}\n`,
    html: renderHtml({
      appName,
      heading: 'Reset your password',
      paragraphs: [greeting(firstName), intro],
      highlightHtml:
        `<p style="margin:8px 0 16px"><a href="${safeLink}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:6px">Reset password</a></p>` +
        `<p style="margin:0 0 16px;font-size:13px;color:#6b7280;word-break:break-all">${safeLink}</p>`,
      footer,
    }),
  };
}

export function passwordChangedEmail(params: {
  appName: string;
  firstName: string;
  isReset: boolean;
}): MailContent {
  const { appName, firstName, isReset } = params;
  const body = isReset
    ? `Your ${appName} password was reset. For your security, you have been signed out on all devices.`
    : `Your ${appName} password was changed. For your security, you have been signed out on your other devices.`;
  const footer =
    "If you didn't do this, reset your password right away and contact support.";
  return {
    subject: `Your ${appName} password was ${isReset ? 'reset' : 'changed'}`,
    text: `${greeting(firstName)}\n\n${body}\n\n${footer}\n`,
    html: renderHtml({
      appName,
      heading: isReset ? 'Password reset' : 'Password changed',
      paragraphs: [greeting(firstName), body],
      footer,
    }),
  };
}

export function passwordExpiryReminderEmail(params: {
  appName: string;
  firstName: string;
  daysLeft: number;
  expiresAt: Date;
}): MailContent {
  const { appName, firstName, daysLeft, expiresAt } = params;
  const when = daysLeft === 1 ? 'tomorrow' : `in ${String(daysLeft)} days`;
  const body = `Your ${appName} password expires ${when} (${expiresAt.toUTCString()}). Change it before then to keep signing in without interruption.`;
  const footer = 'You can change your password from your account settings.';
  return {
    subject: `Your ${appName} password expires ${when}`,
    text: `${greeting(firstName)}

${body}

${footer}
`,
    html: renderHtml({
      appName,
      heading: 'Your password expires soon',
      paragraphs: [greeting(firstName), body],
      footer,
    }),
  };
}

function codeEmail(params: {
  appName: string;
  firstName: string;
  code: string;
  ttlMinutes: number;
  subject: string;
  heading: string;
  intro: string;
  footer: string;
}): MailContent {
  const { appName, firstName, code, ttlMinutes } = params;
  const intro = `${params.intro} It expires in ${String(ttlMinutes)} minutes.`;
  return {
    subject: params.subject,
    text: `${greeting(firstName)}\n\n${intro}\n\n${code}\n\n${params.footer}\n`,
    html: renderHtml({
      appName,
      heading: params.heading,
      paragraphs: [greeting(firstName), intro],
      highlightHtml: `<p style="margin:8px 0 24px;font-size:32px;letter-spacing:8px;font-weight:bold">${escapeHtml(code)}</p>`,
      footer: params.footer,
    }),
  };
}

function noticeEmail(params: {
  appName: string;
  firstName: string;
  subject: string;
  heading: string;
  paragraphs: string[];
  footer?: string;
}): MailContent {
  const paragraphs = [greeting(params.firstName), ...params.paragraphs];
  return {
    subject: params.subject,
    text: `${paragraphs.join('\n\n')}${params.footer ? `\n\n${params.footer}` : ''}\n`,
    html: renderHtml({
      appName: params.appName,
      heading: params.heading,
      paragraphs,
      ...(params.footer ? { footer: params.footer } : {}),
    }),
  };
}

const NOT_YOU = "If you didn't do this, contact support right away.";

export function emailChangeCodeEmail(params: {
  appName: string;
  firstName: string;
  code: string;
  ttlMinutes: number;
}): MailContent {
  return codeEmail({
    ...params,
    subject: `${params.code} is your ${params.appName} email change code`,
    heading: 'Confirm your new email address',
    intro: `Use this code to confirm this address as your new ${params.appName} sign-in email.`,
    footer: "If you didn't ask for this, ignore this email: nothing changes.",
  });
}

export function emailChangedNoticeEmail(params: {
  appName: string;
  firstName: string;
  newEmail: string;
}): MailContent {
  return noticeEmail({
    ...params,
    subject: `Your ${params.appName} email address was changed`,
    heading: 'Email address changed',
    paragraphs: [
      `The sign-in email of your ${params.appName} account was changed to ${params.newEmail}. This address will no longer receive account emails.`,
    ],
    footer: NOT_YOU,
  });
}

export function accountDeactivatedEmail(params: {
  appName: string;
  firstName: string;
}): MailContent {
  return noticeEmail({
    ...params,
    subject: `Your ${params.appName} account was deactivated`,
    heading: 'Account deactivated',
    paragraphs: [
      'Your account was deactivated and you were signed out on all devices. You can reactivate it any time with account recovery.',
    ],
    footer: NOT_YOU,
  });
}

export function accountDeletionScheduledEmail(params: {
  appName: string;
  firstName: string;
  deletionDate: Date;
}): MailContent {
  const date = params.deletionDate.toUTCString();
  return noticeEmail({
    ...params,
    subject: `Your ${params.appName} account will be deleted`,
    heading: 'Account deletion scheduled',
    paragraphs: [
      `As requested, your account and its data will be permanently deleted on ${date}. You were signed out on all devices.`,
      'Changed your mind? Use account recovery before that date to keep your account.',
    ],
    footer: NOT_YOU,
  });
}

export function accountRecoveryCodeEmail(params: {
  appName: string;
  firstName: string;
  code: string;
  ttlMinutes: number;
}): MailContent {
  return codeEmail({
    ...params,
    subject: `${params.code} is your ${params.appName} account recovery code`,
    heading: 'Reactivate your account',
    intro: `Use this code to reactivate your ${params.appName} account.`,
    footer:
      "If you didn't ask for this, ignore this email: your account stays as it is.",
  });
}

export function accountRecoveredEmail(params: {
  appName: string;
  firstName: string;
}): MailContent {
  return noticeEmail({
    ...params,
    subject: `Your ${params.appName} account is active again`,
    heading: 'Account reactivated',
    paragraphs: [
      'Your account was reactivated (any scheduled deletion was cancelled). You can sign in again.',
    ],
    footer: NOT_YOU,
  });
}

export function accountStatusChangedEmail(params: {
  appName: string;
  firstName: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'BANNED' | 'INACTIVE';
  reason: string | null;
}): MailContent {
  const lines: Record<typeof params.status, [string, string]> = {
    ACTIVE: ['Account activated', 'Your account is active. You can sign in.'],
    SUSPENDED: [
      'Account suspended',
      'Your account was suspended by an administrator and you were signed out.',
    ],
    BANNED: [
      'Account blocked',
      'Your account was blocked by an administrator and you were signed out.',
    ],
    INACTIVE: [
      'Account deactivated',
      'Your account was deactivated by an administrator and you were signed out.',
    ],
  };
  const [heading, body] = lines[params.status];
  return noticeEmail({
    ...params,
    subject: `${params.appName}: ${heading.toLowerCase()}`,
    heading,
    paragraphs: [body, ...(params.reason ? [`Reason: ${params.reason}`] : [])],
    footer: 'Questions? Contact support.',
  });
}

export function adminCreatedAccountEmail(params: {
  appName: string;
  firstName: string;
  email: string;
  mustChangePassword: boolean;
}): MailContent {
  return noticeEmail({
    ...params,
    subject: `An ${params.appName} account was created for you`,
    heading: 'Your account is ready',
    paragraphs: [
      `An administrator created a ${params.appName} account for ${params.email}. Your administrator will give you the password.`,
      ...(params.mustChangePassword
        ? [
            'You will be asked to choose your own password when you first sign in.',
          ]
        : []),
    ],
  });
}

export function userInviteEmail(params: {
  appName: string;
  firstName: string | null;
  inviterName: string;
  link: string;
  expiresAt: Date;
  message: string | null;
}): MailContent {
  const name = params.firstName ?? 'there';
  const intro = `${params.inviterName} invited you to join ${params.appName}. Accept the invitation to create your account. The invitation is valid until ${params.expiresAt.toUTCString()}.`;
  const paragraphs = [
    `Hi ${name},`,
    intro,
    ...(params.message ? [`Message: ${params.message}`] : []),
  ];
  const safeLink = escapeHtml(params.link);
  return {
    subject: `${params.inviterName} invited you to ${params.appName}`,
    text: `${paragraphs.join('\n\n')}\n\n${params.link}\n`,
    html: renderHtml({
      appName: params.appName,
      heading: "You're invited",
      paragraphs,
      highlightHtml:
        `<p style="margin:8px 0 16px"><a href="${safeLink}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:6px">Accept invitation</a></p>` +
        `<p style="margin:0 0 16px;font-size:13px;color:#6b7280;word-break:break-all">${safeLink}</p>`,
      footer: "If you weren't expecting this, you can ignore this email.",
    }),
  };
}

export function passwordSetByAdminEmail(params: {
  appName: string;
  firstName: string;
  mustChangePassword: boolean;
}): MailContent {
  return noticeEmail({
    ...params,
    subject: `Your ${params.appName} password was reset by an administrator`,
    heading: 'Password reset by an administrator',
    paragraphs: [
      'An administrator set a new password for your account and you were signed out. Your administrator will give you the new password.',
      ...(params.mustChangePassword
        ? [
            'You will be asked to choose your own password when you next sign in.',
          ]
        : []),
    ],
    footer: NOT_YOU,
  });
}
