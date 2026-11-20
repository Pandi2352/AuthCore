// Small helpers and paths the dashboard server modules share.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { ROOT } from '../../target.mjs';

export { ROOT };
export const REPORTS = path.join(ROOT, 'reports');
export const RUNS = path.join(REPORTS, 'runs');
/** Notes, saved setups, schedules, settings: local to this machine (reports/ is ignored). */
export const DATA = path.join(REPORTS, 'dashboard-data');
/** Approved screenshots for visual change checks. */
export const BASELINES = path.join(ROOT, 'visual-baselines');
export const RUN_ID = /^[\w-]+$/;

// eslint-disable-next-line no-control-regex
export const stripAnsi = (s) => s.replace(/\u001b\[[0-9;]*[A-Za-z]/g, '');

export function readJson(file, fallback) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

/** Write then rename, so a reader never sees half a file. */
export function writeJson(file, value) {
  mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(value, null, 1));
  renameSync(tmp, file);
}

export function runIndex() {
  const index = readJson(path.join(REPORTS, 'index.json'), []);
  return index.filter((r) => RUN_ID.test(r.id) && existsSync(path.join(RUNS, r.id, 'run.json')));
}

export const readRun = (id) => (RUN_ID.test(id) ? readJson(path.join(RUNS, id, 'run.json'), null) : null);

export function writeIndex(index) {
  writeJson(path.join(REPORTS, 'index.json'), index);
}

/** A JSON file in the data folder with a default value. */
export function store(name, fallback) {
  const file = path.join(DATA, `${name}.json`);
  return {
    get: () => readJson(file, structuredClone(fallback)),
    set: (value) => writeJson(file, value),
  };
}

export const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Collapse ids, numbers and generated names so the same error groups together. */
export function errorSignature(message) {
  const first = String(message ?? '')
    .split('\n')
    .map((l) => l.trim())
    .find(Boolean);
  if (!first) return '';
  return first
    .replace(/\b[0-9a-f]{24}\b/gi, '<id>')
    .replace(/\b[0-9a-f]{8}-[0-9a-f-]{27}\b/gi, '<id>')
    .replace(/PW[- ][\w-]+/g, 'PW-…')
    .replace(/\d+(\.\d+)?/g, 'N')
    .replace(/\s+/g, ' ')
    .slice(0, 240);
}
