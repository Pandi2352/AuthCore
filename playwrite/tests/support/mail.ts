import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import { expect } from '@playwright/test';

import { TEST_ENV } from '../../target.mjs';

/**
 * Emails "sent" by the test environment: the backend writes each one as an .eml file to
 * .test-env/mail-outbox instead of sending it. Only for PW_ENV=test.
 */
export interface OutboxEmail {
  file: string;
  template: string;
  to: string;
  subject: string;
  /** Decoded text body (plain part, else HTML with tags removed). */
  text: string;
  /** Every http(s) link in the email. */
  links: string[];
  sentAt: Date;
}

const OUTBOX = path.join(TEST_ENV.dir, 'mail-outbox');

function decodeQuotedPrintable(s: string): string {
  return s
    .replace(/=\r?\n/g, '')
    .replace(/=([0-9A-F]{2})/gi, (_, h: string) => String.fromCharCode(Number.parseInt(h, 16)));
}

function parse(file: string): OutboxEmail {
  const raw = readFileSync(path.join(OUTBOX, file), 'utf8');
  const header = (name: string) =>
    new RegExp(`^${name}:\\s*(.+(?:\\r?\\n[ \\t].+)*)`, 'im').exec(raw)?.[1]?.replace(/\r?\n[ \t]/g, ' ').trim() ?? '';
  // Body parts: prefer text/plain, decode quoted-printable / base64.
  const parts = raw.split(/\r?\n--[^\r\n]+\r?\n/);
  const pick = (type: string) => parts.find((p) => new RegExp(`content-type:\\s*${type}`, 'i').test(p));
  const part = pick('text/plain') ?? pick('text/html') ?? raw;
  const [head = '', ...rest] = part.split(/\r?\n\r?\n/);
  let body = rest.join('\n\n');
  if (/content-transfer-encoding:\s*quoted-printable/i.test(head)) body = decodeQuotedPrintable(body);
  if (/content-transfer-encoding:\s*base64/i.test(head)) body = Buffer.from(body.replace(/\s+/g, ''), 'base64').toString('utf8');
  const text = /content-type:\s*text\/html/i.test(head) ? body.replace(/<[^>]+>/g, ' ') : body;
  const name = path.basename(file, '.eml');
  return {
    file,
    // File names: <timestamp>-<template>-<id>.eml
    template: name.replace(/^\d{4}-\d{2}-\d{2}T[\d-]+Z-/, '').replace(/-[0-9a-f]{8}$/, ''),
    to: header('To'),
    subject: header('Subject'),
    text: text.replace(/[ \t]+/g, ' ').trim(),
    links: [...new Set(body.match(/https?:\/\/[^\s"'<>)]+/g) ?? [])],
    sentAt: statSync(path.join(OUTBOX, file)).mtime,
  };
}

/** All emails in the outbox, newest first (optionally only to this address). */
export function outbox(to?: string): OutboxEmail[] {
  let files: string[];
  try {
    files = readdirSync(OUTBOX).filter((f) => f.endsWith('.eml'));
  } catch {
    return [];
  }
  return files
    .sort()
    .reverse()
    .map(parse)
    .filter((m) => !to || m.to.toLowerCase().includes(to.toLowerCase()));
}

/**
 * Waits for an email to `to` (sent after `since`, optionally of a template such as
 * "invite") and returns it.
 */
export async function waitForEmail(
  to: string,
  { since = new Date(0), template, timeout = 15_000 }: { since?: Date; template?: string; timeout?: number } = {},
): Promise<OutboxEmail> {
  let found: OutboxEmail | undefined;
  await expect
    .poll(
      () => {
        found = outbox(to).find((m) => m.sentAt >= since && (!template || m.template.includes(template)));
        return Boolean(found);
      },
      { timeout, message: `No email${template ? ` (${template})` : ''} to ${to} in the test outbox` },
    )
    .toBe(true);
  return found!;
}
