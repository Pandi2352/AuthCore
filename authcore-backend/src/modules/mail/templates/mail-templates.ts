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
