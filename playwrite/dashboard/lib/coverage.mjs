// Coverage: which app pages and which API endpoints the tests reached.
//   App pages come from authcore-frontend/src/config/paths.ts (every URL of the app).
//   API endpoints come from the backend's OpenAPI document (test environment, else dev),
//   saved locally so coverage still works when no backend is running.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { resolveTarget, TEST_ENV } from '../../target.mjs';
import { DATA, readJson, readRun, ROOT, runIndex, writeJson } from './util.mjs';

const PATHS_FILE = path.resolve(ROOT, '..', 'authcore-frontend', 'src', 'config', 'paths.ts');
const SPEC_CACHE = path.join(DATA, 'openapi.json');
const METHODS = ['get', 'post', 'put', 'patch', 'delete'];

/** Every page of the app, from paths.ts (constants and route patterns). */
export function appPages() {
  if (!existsSync(PATHS_FILE)) return [];
  const src = readFileSync(PATHS_FILE, 'utf8');
  const pages = new Map();
  const add = (name, pattern) => {
    if (pages.has(pattern)) return;
    const section = pattern.split('/')[1] || 'root';
    pages.set(pattern, {
      name,
      path: pattern,
      section,
      // Roots only redirect; dev pages aren't in normal builds.
      optional: ['/', '/admin', '/settings'].includes(pattern) || section === 'dev',
      re: new RegExp(`^${pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/:[A-Za-z]+/g, '[^/]+')}/?$`),
    });
  };
  // Constants: name: '/path'
  for (const m of src.matchAll(/(\w+):\s*'(\/[^']*)'/g)) add(m[1], m[2]);
  const list = [...pages.values()].sort((a, b) => a.path.localeCompare(b.path));
  // One section per area with several pages; single pages (/login, /profile, …) share one.
  const counts = {};
  for (const p of list) counts[p.section] = (counts[p.section] ?? 0) + 1;
  for (const p of list) if (counts[p.section] < 3) p.section = 'other';
  return list;
}

let specMemo = null;
let specAt = 0;

/** The OpenAPI document: fetched from a running backend, else the saved copy. */
export async function apiSpec(force = false) {
  if (specMemo && !force && Date.now() - specAt < 300_000) return specMemo;
  const sources = [`http://localhost:${TEST_ENV.apiPort}/api/docs/openapi.json`];
  const dev = resolveTarget('dev').baseURL;
  if (dev) sources.push(new URL('/api/docs/openapi.json', dev).toString());
  for (const url of sources) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (!res.ok) continue;
      const doc = await res.json();
      if (!doc?.paths) continue;
      specMemo = { doc, source: url, fetchedAt: new Date().toISOString() };
      writeJson(SPEC_CACHE, specMemo);
      specAt = Date.now();
      return specMemo;
    } catch {
      /* next */
    }
  }
  specMemo = readJson(SPEC_CACHE, null);
  specAt = Date.now();
  return specMemo;
}

function operations(doc) {
  const ops = [];
  for (const [p, item] of Object.entries(doc?.paths ?? {})) {
    for (const method of METHODS) {
      const op = item[method];
      if (!op) continue;
      const params = (p.match(/\{[^}]+\}/g) ?? []).length;
      ops.push({
        method: method.toUpperCase(),
        path: p,
        tag: op.tags?.[0] ?? 'Other',
        summary: op.summary ?? '',
        params,
        re: new RegExp(`^${p.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\\?\{[^}]+\\?\}/g, '[^/]+')}/?$`),
      });
    }
  }
  // Fixed paths first (/roles/stats before /roles/{id}).
  return ops.sort((a, b) => a.params - b.params);
}

/** Coverage of the given runs (one id, or every kept run). */
export async function coverage(runId) {
  const ids = runId === 'all' ? runIndex().map((r) => r.id) : [runId ?? runIndex()[0]?.id].filter(Boolean);
  const runs = ids.map(readRun).filter((r) => r?.coverage);
  const spec = await apiSpec();
  const ops = operations(spec?.doc);
  const pages = appPages();

  const testName = (run, i) => ({ runId: run.id, index: i, title: run.tests[i]?.fullTitle ?? `#${i}`, project: run.tests[i]?.project ?? '' });

  const pageHits = new Map();
  const unknownPages = new Map();
  for (const run of runs) {
    for (const [visited, tests] of Object.entries(run.coverage.pages ?? {})) {
      const page = pages.find((p) => p.re.test(visited));
      const bucket = page ? pageHits : unknownPages;
      const key = page ? page.path : visited;
      const entry = bucket.get(key) ?? { urls: new Set(), tests: [] };
      entry.urls.add(visited);
      for (const i of tests) if (entry.tests.length < 50) entry.tests.push(testName(run, i));
      bucket.set(key, entry);
    }
  }

  const opHits = new Map();
  const unknownCalls = new Map();
  for (const run of runs) {
    for (const call of Object.values(run.coverage.api ?? {})) {
      const op = ops.find((o) => o.method === call.method && o.re.test(call.path));
      const key = op ? `${op.method} ${op.path}` : `${call.method} ${call.path}`;
      const bucket = op ? opHits : unknownCalls;
      const entry = bucket.get(key) ?? { count: 0, statuses: {}, tests: [], examples: new Set() };
      entry.count += call.count;
      for (const [s, n] of Object.entries(call.statuses)) entry.statuses[s] = (entry.statuses[s] ?? 0) + n;
      for (const i of call.tests) if (entry.tests.length < 30) entry.tests.push(testName(run, i));
      if (entry.examples.size < 5) entry.examples.add(call.path);
      bucket.set(key, entry);
    }
  }

  return {
    runs: runs.map((r) => ({ id: r.id, startedAt: r.startedAt, label: r.label })),
    recorded: runs.length > 0,
    spec: spec ? { source: spec.source, fetchedAt: spec.fetchedAt, operations: ops.length } : null,
    pages: pages.map((p) => {
      const hit = pageHits.get(p.path);
      return { name: p.name, path: p.path, section: p.section, optional: p.optional, covered: Boolean(hit), urls: hit ? [...hit.urls] : [], tests: hit?.tests ?? [] };
    }),
    otherPages: [...unknownPages.entries()].map(([url, e]) => ({ url, tests: e.tests })),
    api: ops.map((o) => {
      const hit = opHits.get(`${o.method} ${o.path}`);
      return { method: o.method, path: o.path, tag: o.tag, summary: o.summary, covered: Boolean(hit), count: hit?.count ?? 0, statuses: hit?.statuses ?? {}, tests: hit?.tests ?? [], examples: hit ? [...hit.examples] : [] };
    }),
    otherCalls: [...unknownCalls.entries()].map(([key, e]) => ({ key, count: e.count, statuses: e.statuses, tests: e.tests })),
  };
}
