// The test environment's outbox: emails the test backend "sent", saved as .eml files.
import { existsSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';

import { TEST_ENV } from '../../target.mjs';

export const OUTBOX = path.join(TEST_ENV.dir, 'mail-outbox');
const FILE = /^[\w.-]+\.eml$/;

function decodeBody(body, encoding) {
  const enc = (encoding ?? '').toLowerCase();
  if (enc === 'base64') return Buffer.from(body.replace(/\s+/g, ''), 'base64').toString('utf8');
  if (enc === 'quoted-printable') {
    const soft = body.replace(/=\r?\n/g, '');
    const bytes = [];
    for (let i = 0; i < soft.length; i++) {
      const hex = soft[i] === '=' ? /^[0-9A-F]{2}$/i.exec(soft.slice(i + 1, i + 3)) : null;
      if (hex) {
        bytes.push(Number.parseInt(hex[0], 16));
        i += 2;
      } else {
        bytes.push(...Buffer.from(soft[i], 'utf8'));
      }
    }
    return Buffer.from(bytes).toString('utf8');
  }
  return body;
}

/** Encoded words in headers (=?utf-8?Q?…?= / =?utf-8?B?…?=). */
function decodeHeader(value) {
  return value.replace(/=\?[^?]+\?([QqBb])\?([^?]*)\?=/g, (_, kind, text) =>
    kind.toUpperCase() === 'B'
      ? Buffer.from(text, 'base64').toString('utf8')
      : decodeBody(text.replace(/_/g, ' '), 'quoted-printable'),
  );
}

function splitHead(raw) {
  const at = raw.search(/\r?\n\r?\n/);
  if (at < 0) return { head: raw, body: '' };
  return { head: raw.slice(0, at), body: raw.slice(at).replace(/^\r?\n\r?\n/, '') };
}

function headers(head) {
  const out = {};
  for (const line of head.replace(/\r?\n[ \t]+/g, ' ').split(/\r?\n/)) {
    const m = /^([\w-]+):\s*(.*)$/.exec(line);
    if (m) out[m[1].toLowerCase()] = decodeHeader(m[2].trim());
  }
  return out;
}

/** Walks multipart bodies and returns the text and html parts. */
function parts(raw, found = { text: null, html: null }) {
  const { head, body } = splitHead(raw);
  const h = headers(head);
  const type = h['content-type'] ?? 'text/plain';
  const boundary = /boundary="?([^";]+)"?/i.exec(type)?.[1];
  if (/^multipart\//i.test(type) && boundary) {
    const chunks = body.split(`--${boundary}`).slice(1);
    for (const chunk of chunks) {
      if (chunk.startsWith('--')) break;
      parts(chunk.replace(/^\r?\n/, ''), found);
    }
    return found;
  }
  const decoded = decodeBody(body, h['content-transfer-encoding']);
  if (/^text\/html/i.test(type)) found.html ??= decoded;
  else if (/^text\/plain/i.test(type)) found.text ??= decoded;
  return found;
}

const htmlToText = (html) =>
  html
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h\d|li|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();

function summary(file) {
  const full = path.join(OUTBOX, file);
  const raw = readFileSync(full, 'utf8');
  const h = headers(splitHead(raw).head);
  const name = path.basename(file, '.eml');
  return {
    file,
    // File names: <timestamp>-<template>-<id>.eml
    template: name.replace(/^\d{4}-\d{2}-\d{2}T[\d-]+Z-/, '').replace(/-[0-9a-f]{8}$/, ''),
    to: h.to ?? '',
    from: h.from ?? '',
    subject: h.subject ?? '(no subject)',
    sentAt: (h.date ? new Date(h.date) : statSync(full).mtime).toISOString(),
    size: statSync(full).size,
  };
}

export function listMail() {
  if (!existsSync(OUTBOX)) return [];
  return readdirSync(OUTBOX)
    .filter((f) => FILE.test(f))
    .sort()
    .reverse()
    .map((f) => {
      try {
        return summary(f);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

export function readMail(file) {
  if (!FILE.test(file) || !existsSync(path.join(OUTBOX, file))) return null;
  const raw = readFileSync(path.join(OUTBOX, file), 'utf8');
  const { text, html } = parts(raw);
  const body = text ?? (html ? htmlToText(html) : '');
  const links = [...new Set(`${text ?? ''}\n${html ?? ''}`.match(/https?:\/\/[^\s"'<>)]+/g) ?? [])].map((l) =>
    l.replace(/&amp;/g, '&'),
  );
  return { ...summary(file), text: body, html, links, raw: raw.length > 400_000 ? `${raw.slice(0, 400_000)}\n…` : raw };
}

export function clearMail() {
  if (!existsSync(OUTBOX)) return 0;
  const files = readdirSync(OUTBOX).filter((f) => FILE.test(f));
  for (const f of files) rmSync(path.join(OUTBOX, f), { force: true });
  return files.length;
}

export const mailFile = (file) => (FILE.test(file) ? path.join(OUTBOX, file) : null);
