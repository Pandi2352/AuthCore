// Read-only views across runs: search, quality trends (accessibility, page speed),
// test catalog health, and visual baselines (approved screenshots).
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';

import { BASELINES, errorSignature, readJson, readRun, REPORTS, ROOT, RUNS, runIndex, writeJson } from './util.mjs';

const indexStamp = () => {
  const f = path.join(REPORTS, 'index.json');
  return existsSync(f) ? String(statSync(f).mtimeMs) : 'none';
};

// --------------------------------------------------------------------------- search

/** Tests in every kept run whose name, file or error contains `q`. */
export function search(q, { state = 'all', limit = 300 } = {}) {
  const needle = q.trim().toLowerCase();
  if (needle.length < 2) return { hits: [], runsSearched: 0, truncated: false };
  const hits = [];
  const runs = runIndex();
  let truncated = false;
  for (const summary of runs) {
    const run = readRun(summary.id);
    if (!run) continue;
    run.tests.forEach((t, index) => {
      if (truncated) return;
      if (state !== 'all' && !(t.state === state || (state === 'failed' && t.state === 'timedOut'))) return;
      const errors = t.results.flatMap((r) => r.errors.map((e) => e.message ?? ''));
      const where = t.fullTitle.toLowerCase().includes(needle)
        ? 'name'
        : (t.file ?? '').toLowerCase().includes(needle)
          ? 'file'
          : errors.some((e) => e.toLowerCase().includes(needle))
            ? 'error'
            : null;
      if (!where) return;
      const err = errors.find((e) => e.toLowerCase().includes(needle)) ?? errors[0] ?? '';
      const at = err.toLowerCase().indexOf(needle);
      hits.push({
        runId: run.id,
        runLabel: run.label,
        startedAt: run.startedAt,
        index,
        title: t.fullTitle,
        project: t.project,
        file: t.file,
        line: t.line,
        state: t.state,
        where,
        snippet: err ? err.slice(Math.max(0, at - 80), Math.max(0, at) + 160).replace(/\s+/g, ' ') : '',
      });
      if (hits.length >= limit) truncated = true;
    });
    if (truncated) break;
  }
  return { hits, runsSearched: runs.length, truncated };
}

// ------------------------------------------------------------------- error groups

/** Failures of one run grouped by the same error (ids and numbers ignored). */
export function errorGroups(run) {
  const groups = new Map();
  run.tests.forEach((t, index) => {
    if (!['failed', 'timedOut', 'flaky'].includes(t.state)) return;
    const message = t.results.flatMap((r) => r.errors).find((e) => e.message)?.message ?? '';
    const sig = errorSignature(message) || '(no error message)';
    const g = groups.get(sig) ?? { signature: sig, example: message.split('\n').find((l) => l.trim()) ?? '', tests: [] };
    g.tests.push({ index, title: t.fullTitle, project: t.project, state: t.state });
    groups.set(sig, g);
  });
  return [...groups.values()].sort((a, b) => b.tests.length - a.tests.length);
}

// ----------------------------------------------------------------- quality trends

let qualityMemo = null;
let qualityStamp = '';

export function qualityTrend() {
  const stamp = indexStamp();
  if (qualityMemo && stamp === qualityStamp) return qualityMemo;
  const runs = [];
  for (const summary of runIndex()) {
    const run = readRun(summary.id);
    if (!run) continue;
    const a11y = run.a11y ?? [];
    const impacts = { critical: 0, serious: 0, moderate: 0, minor: 0 };
    let rules = 0;
    for (const page of a11y) {
      for (const v of page.violations ?? []) {
        rules++;
        impacts[v.impact] = (impacts[v.impact] ?? 0) + 1;
      }
    }
    runs.push({
      id: run.id,
      startedAt: run.startedAt,
      label: run.label,
      a11y: a11y.length ? { pages: a11y.length, violations: rules, ...impacts } : null,
      loads: (run.metrics ?? []).filter((m) => m.kind === 'page-load').map((m) => ({ name: m.name, project: m.project, ms: m.ms })),
    });
  }
  qualityMemo = { runs };
  qualityStamp = stamp;
  return qualityMemo;
}

// ------------------------------------------------------------------- catalog health

const TEST_DIR = path.join(ROOT, 'tests');

function specFiles(dir = TEST_DIR) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return specFiles(full);
    return /\.(spec|test)\.[mc]?[jt]s$/.test(e.name) ? [full] : [];
  });
}

const countSteps = (steps, category) =>
  (steps ?? []).reduce((n, s) => n + (s.category === category ? 1 : 0) + countSteps(s.steps, category), 0);

/** Problems in the tests themselves: focused or skipped tests, tests that check nothing, … */
export function catalogHealth(catalog) {
  const issues = [];
  const rel = (f) => path.relative(ROOT, f).split(path.sep).join('/');
  for (const file of specFiles()) {
    const lines = readFileSync(file, 'utf8').split(/\r?\n/);
    lines.forEach((text, i) => {
      const at = { file: rel(file), line: i + 1, code: text.trim().slice(0, 200) };
      if (/\b(test|describe|it)(\.describe)?\.only\s*\(/.test(text)) {
        issues.push({ ...at, kind: 'only', severity: 'danger', title: 'Only this test runs', text: '.only makes Playwright skip every other test. Remove it before committing.' });
      }
      if (/\b(test|describe)(\.describe)?\.(skip|fixme)\s*\(/.test(text)) {
        issues.push({ ...at, kind: 'skip', severity: 'warning', title: 'Skipped test', text: 'Marked skip or fixme: it never runs. Fix it or remove it.' });
      }
      if (/\bpage\.pause\s*\(/.test(text)) {
        issues.push({ ...at, kind: 'pause', severity: 'danger', title: 'page.pause() left in', text: 'Stops the test and waits for the inspector.' });
      }
      if (/\bwaitForTimeout\s*\(/.test(text)) {
        issues.push({ ...at, kind: 'sleep', severity: 'warning', title: 'Fixed wait', text: 'waitForTimeout waits a fixed time: slow, and still flaky. Wait for something visible instead.' });
      }
    });
  }
  // From the latest full run: tests that checked nothing, tests close to their time limit.
  const latest = runIndex().find((r) => r.status !== 'interrupted');
  const run = latest ? readRun(latest.id) : null;
  for (const [index, t] of (run?.tests ?? []).entries()) {
    const last = t.results.at(-1);
    if (!last) continue;
    if (t.state === 'passed' && countSteps(last.steps, 'expect') === 0) {
      issues.push({ kind: 'no-checks', severity: 'warning', title: 'Passes without checking anything', text: `${t.fullTitle} (${t.project}) made no expect() checks in the latest run.`, file: t.file, line: t.line, runId: run.id, index });
    }
    if (t.timeout > 0 && last.duration > t.timeout * 0.7 && last.status === 'passed') {
      issues.push({ kind: 'near-timeout', severity: 'warning', title: 'Close to its time limit', text: `${t.fullTitle} (${t.project}) took ${Math.round(last.duration / 1000)} s of ${Math.round(t.timeout / 1000)} s.`, file: t.file, line: t.line, runId: run.id, index });
    }
  }
  if (catalog?.error) issues.unshift({ kind: 'list-error', severity: 'danger', title: 'Playwright could not list the tests', text: catalog.error });
  const perFile = {};
  for (const t of catalog?.tests ?? []) perFile[t.file] = (perFile[t.file] ?? 0) + 1;
  return { issues, files: Object.entries(perFile).map(([file, tests]) => ({ file, tests })), latestRunId: run?.id ?? null };
}

// ----------------------------------------------------------------- visual baselines

const BASELINE_INDEX = path.join(BASELINES, 'baselines.json');
const baselineFile = (key) => `${createHash('sha1').update(key).digest('hex').slice(0, 20)}.png`;
export const baselinePath = (file) => (/^[0-9a-f]{20}\.png$/.test(file) ? path.join(BASELINES, file) : null);

/** Every page screenshot in a run, with the approved one when there is one. */
export function visual(runId) {
  const id = runId ?? runIndex().find((r) => r.status !== 'interrupted')?.id;
  const run = id ? readRun(id) : null;
  const baselines = readJson(BASELINE_INDEX, {});
  if (!run) return { run: null, items: [], baselines: Object.keys(baselines).length };
  const pageOf = new Map((run.a11y ?? []).map((a) => [`${a.test}`, a.page]));
  const items = [];
  run.tests.forEach((t, index) => {
    const shot = t.results.flatMap((r) => r.attachments).filter((a) => a.name === 'page-screenshot' && a.file).at(-1);
    if (!shot) return;
    const key = `${t.project}|${t.file}|${t.fullTitle}`;
    const base = baselines[key];
    items.push({
      key,
      index,
      title: t.fullTitle,
      page: pageOf.get(`${index}`) ?? null,
      project: t.project,
      state: t.state,
      current: `/api/runs/${encodeURIComponent(run.id)}/files/${encodeURIComponent(shot.file)}`,
      baseline: base ? `/api/visual/baseline/${base.file}?v=${encodeURIComponent(base.approvedAt)}` : null,
      approvedAt: base?.approvedAt ?? null,
      approvedFrom: base?.runId ?? null,
    });
  });
  return { run: { id: run.id, startedAt: run.startedAt, label: run.label }, items, baselines: Object.keys(baselines).length };
}

export function approveBaseline(runId, key) {
  const run = readRun(runId);
  const t = run?.tests.find((x) => `${x.project}|${x.file}|${x.fullTitle}` === key);
  const shot = t?.results.flatMap((r) => r.attachments).filter((a) => a.name === 'page-screenshot' && a.file).at(-1);
  if (!shot) throw new Error('That screenshot is not in the run');
  mkdirSync(BASELINES, { recursive: true });
  const file = baselineFile(key);
  copyFileSync(path.join(RUNS, runId, 'attachments', shot.file), path.join(BASELINES, file));
  const index = readJson(BASELINE_INDEX, {});
  index[key] = { file, runId, approvedAt: new Date().toISOString(), title: t.fullTitle, project: t.project };
  writeJson(BASELINE_INDEX, index);
  return index[key];
}

export function removeBaseline(key) {
  const index = readJson(BASELINE_INDEX, {});
  const entry = index[key];
  if (!entry) return false;
  rmSync(path.join(BASELINES, entry.file), { force: true });
  delete index[key];
  writeJson(BASELINE_INDEX, index);
  return true;
}
