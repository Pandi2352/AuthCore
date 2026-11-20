// AuthCore test dashboard: serves the UI, the run history written by
// reporters/dashboard-reporter.ts, and starts / stops Playwright runs.
// Node built-ins only. Listens on 127.0.0.1 (this machine) only.
import { execFile, spawn } from 'node:child_process';
import {
  createReadStream,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const PUBLIC = path.join(import.meta.dirname, 'public');
const REPORTS = path.join(ROOT, 'reports');
const RUNS = path.join(REPORTS, 'runs');
const HTML_REPORT = path.join(ROOT, 'playwright-report');
const CLI = path.join(ROOT, 'node_modules', '@playwright', 'test', 'cli.js');
const PORT = Number(process.env.PW_DASHBOARD_PORT ?? 9400);
const HOST = '127.0.0.1';

import { resolveTarget, TARGETS, TEST_ENV } from '../target.mjs';
import { coverage } from './lib/coverage.mjs';
import { exportRun } from './lib/export.mjs';
import { approveBaseline, baselinePath, catalogHealth, errorGroups, qualityTrend, removeBaseline, search, visual } from './lib/insights.mjs';
import { clearMail, listMail, mailFile, readMail } from './lib/mail.mjs';
import { deleteSchedule, listSchedules, markRun, saveSchedule, startScheduler } from './lib/scheduler.mjs';
import { cleanLeftovers, envStatus, leftovers, logChunk, logWindow, onEnvChange, startEnv, stopEnv } from './lib/testenv.mjs';
import { newId, readRun, store } from './lib/util.mjs';

const notes = store('notes', {});
const presets = store('presets', []);
const settings = store('settings', { keep: 50, maxAgeDays: null });

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webm': 'video/webm',
  '.mp4': 'video/mp4',
  '.zip': 'application/zip',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.log': 'text/plain; charset=utf-8',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

// ----------------------------------------------------------------------------- helpers

const readJson = (file, fallback) => {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
};

const send = (res, status, body, type = 'application/json; charset=utf-8') => {
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
};

const fail = (res, status, message) => send(res, status, { error: message });

/** Resolve `rel` inside `base`, or null if it escapes it. */
const inside = (base, rel) => {
  const full = path.resolve(base, rel);
  return full === base || full.startsWith(base + path.sep) ? full : null;
};

/** Serve a file, with byte ranges (videos seek). */
function serveFile(req, res, file, downloadName) {
  if (!file || !existsSync(file) || !statSync(file).isFile()) return fail(res, 404, 'Not found');
  const size = statSync(file).size;
  const type = TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
  const headers = { 'content-type': type, 'accept-ranges': 'bytes', 'cache-control': 'no-store' };
  if (downloadName) headers['content-disposition'] = `attachment; filename="${downloadName}"`;
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '');
  if (range) {
    const start = range[1] ? Number(range[1]) : size - Number(range[2]);
    const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start >= size || start < 0 || end < start) {
      res.writeHead(416, { 'content-range': `bytes */${size}` });
      return res.end();
    }
    res.writeHead(206, { ...headers, 'content-range': `bytes ${start}-${end}/${size}`, 'content-length': end - start + 1 });
    return createReadStream(file, { start, end }).pipe(res);
  }
  res.writeHead(200, { ...headers, 'content-length': size });
  createReadStream(file).pipe(res);
}

const readBody = (req) =>
  new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
      if (data.length > 100_000) reject(new Error('Body too large'));
    });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
  });

const RUN_ID = /^[\w-]+$/;

function dirSize(dir) {
  if (!existsSync(dir)) return 0;
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    total += entry.isDirectory() ? dirSize(full) : statSync(full).size;
  }
  return total;
}

function runIndex() {
  const index = readJson(path.join(REPORTS, 'index.json'), []);
  return index.filter((r) => RUN_ID.test(r.id) && existsSync(path.join(RUNS, r.id, 'run.json')));
}

// ----------------------------------------------------------------------- test catalog

let catalog = null;
let catalogAt = 0;

/** Every test Playwright knows about (playwright test --list), cached for a minute. */
function loadCatalog(force = false) {
  if (catalog && !force && Date.now() - catalogAt < 60_000) return Promise.resolve(catalog);
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [CLI, 'test', '--list', '--reporter=json'],
      { cwd: ROOT, maxBuffer: 64 * 1024 * 1024, env: { ...process.env, FORCE_COLOR: '0' } },
      (error, stdout) => {
        try {
          const json = JSON.parse(stdout.slice(stdout.indexOf('{')));
          const tests = [];
          const walk = (suite, describe) => {
            for (const spec of suite.specs ?? []) {
              const file = `tests/${spec.file}`.replace(/\\/g, '/');
              const fullTitle = [...describe, spec.title].join(' › ');
              for (const t of spec.tests ?? []) {
                tests.push({
                  key: `${t.projectName}|${file}|${fullTitle}`,
                  title: spec.title,
                  fullTitle,
                  file,
                  line: spec.line,
                  project: t.projectName,
                  tags: spec.tags?.map((tag) => (tag.startsWith('@') ? tag : `@${tag}`)) ?? [],
                });
              }
            }
            for (const child of suite.suites ?? []) {
              walk(child, [...describe, child.title]);
            }
          };
          for (const s of json.suites ?? []) walk(s, []);
          catalog = {
            tests,
            projects: (json.config?.projects ?? []).map((p) => ({
              name: p.name,
              grep: p.grep?.map?.((g) => g.source ?? String(g)) ?? [],
            })),
            files: [...new Set(tests.map((t) => t.file))].sort(),
            tags: [...new Set(tests.flatMap((t) => t.tags))].sort(),
            version: json.config?.version ?? null,
            workers: json.config?.workers ?? null,
            error: null,
          };
        } catch (e) {
          catalog = { tests: [], projects: [], files: [], tags: [], version: null, workers: null, error: String(error?.message ?? e) };
        }
        catalogAt = Date.now();
        resolve(catalog);
      },
    );
  });
}

// --------------------------------------------------------------------------- history

let historyCache = null;
let historyStamp = '';

/**
 * Every test across the kept runs: key "project|file|title" → newest-first list of
 * { runId, startedAt, state, duration, retries, error }. Rebuilt when the run index changes.
 */
function history() {
  const indexFile = path.join(REPORTS, 'index.json');
  const stamp = existsSync(indexFile) ? String(statSync(indexFile).mtimeMs) : 'none';
  if (historyCache && stamp === historyStamp) return historyCache;
  const byKey = {};
  for (const run of runIndex()) {
    const full = readJson(path.join(RUNS, run.id, 'run.json'), null);
    if (!full) continue;
    full.tests.forEach((t, index) => {
      const key = `${t.project}|${t.file}|${t.fullTitle}`;
      const lastError = t.results.at(-1)?.errors?.[0]?.message;
      (byKey[key] ??= []).push({
        runId: run.id,
        index,
        startedAt: run.startedAt,
        state: t.state,
        duration: t.duration,
        attempts: t.attempts,
        error: lastError ? lastError.split('\n')[0].slice(0, 240) : null,
      });
    });
  }
  historyCache = byKey;
  historyStamp = stamp;
  return byKey;
}

// ------------------------------------------------------------------------- live runs

const clients = new Set();
let child = null;
let current = null; // { startedAt, options, args, log: string[], exitCode, runId }
let liveTimer = null;

function broadcast(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) res.write(payload);
}

function liveState() {
  const live = readJson(path.join(REPORTS, 'live.json'), null);
  const fresh = live && current && new Date(live.startedAt) >= new Date(current.startedAt) - 5_000;
  return {
    running: Boolean(child),
    startedAt: current?.startedAt ?? null,
    options: current?.options ?? null,
    command: current ? `npx playwright ${current.args.join(' ')}` : null,
    exitCode: current?.exitCode ?? null,
    runId: current?.runId ?? null,
    progress: fresh ? live : null,
  };
}

/** Turn the form into CLI arguments; everything is checked against known values. */
async function buildArgs(options) {
  const cat = await loadCatalog();
  const args = ['test'];
  const projects = (options.projects ?? []).filter((p) => cat.projects.some((k) => k.name === p));
  for (const p of projects) args.push(`--project=${p}`);
  const files = (options.files ?? []).filter((f) => cat.files.includes(f));
  const tags = (options.tags ?? []).filter((t) => cat.tags.includes(t));
  const grepParts = [];
  if (tags.length) grepParts.push(tags.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'));
  if (typeof options.grep === 'string' && options.grep.trim()) grepParts.push(options.grep.trim().slice(0, 200));
  if (grepParts.length === 1) args.push(`--grep=${grepParts[0]}`);
  if (grepParts.length === 2) args.push(`--grep=(?=.*(${grepParts[0]}))(?=.*(${grepParts[1]}))`);
  if (typeof options.grepInvert === 'string' && options.grepInvert.trim()) {
    args.push(`--grep-invert=${options.grepInvert.trim().slice(0, 200)}`);
  }
  const int = (v, min, max) => (Number.isInteger(v) && v >= min && v <= max ? v : null);
  const workers = int(options.workers, 1, 8);
  if (workers) args.push(`--workers=${workers}`);
  const retries = int(options.retries, 0, 5);
  if (retries !== null && options.retries !== undefined) args.push(`--retries=${retries}`);
  const repeat = int(options.repeatEach, 1, 20);
  if (repeat && repeat > 1) args.push(`--repeat-each=${repeat}`);
  const maxFailures = int(options.maxFailures, 1, 1000);
  if (maxFailures) args.push(`--max-failures=${maxFailures}`);
  if (options.headed === true) args.push('--headed');
  if (options.lastFailed === true) args.push('--last-failed');
  if (options.trace === true) args.push('--trace=on');
  // Exact tests (re-run the failed ones of any run): file:line, checked against the test list.
  const exact = (Array.isArray(options.tests) ? options.tests : [])
    .filter((t) => t && cat.files.includes(t.file) && Number.isInteger(t.line) && t.line > 0)
    .slice(0, 300)
    .map((t) => `${t.file}:${t.line}`);
  args.push(...(exact.length ? [...new Set(exact)] : files));
  return args;
}

async function startRun(options, trigger = 'ui') {
  if (child) throw new Error('A run is already going');
  const args = await buildArgs(options);
  const label = typeof options.label === 'string' ? options.label.trim().slice(0, 80) : '';
  const target = TARGETS.includes(options.target) ? options.target : resolveTarget().name;
  current = { startedAt: new Date().toISOString(), options, args, log: [], exitCode: null, trigger, target };
  child = spawn(process.execPath, [CLI, ...args], {
    cwd: ROOT,
    env: {
      ...process.env,
      PW_RUN_TRIGGER: trigger,
      PW_RUN_LABEL: label,
      PW_ENV: target,
      FORCE_COLOR: '0',
      CI: '',
    },
    windowsHide: true,
  });
  const onData = (chunk) => {
    for (const line of chunk.toString().split(/\r?\n/)) {
      if (!line.trim()) continue;
      current.log.push(line);
      if (current.log.length > 5000) current.log.shift();
      broadcast('log', { line });
    }
  };
  child.stdout.on('data', onData);
  child.stderr.on('data', onData);
  liveTimer = setInterval(() => broadcast('progress', liveState()), 700);
  child.on('close', (code) => {
    clearInterval(liveTimer);
    current.exitCode = code;
    const live = readJson(path.join(REPORTS, 'live.json'), null);
    current.runId = live?.runId ?? null;
    if (current.stopped) recordStoppedRun(live);
    child = null;
    catalog = null;
    if (current.scheduleId) markRun(current.scheduleId, { lastRunId: current.runId, lastExitCode: code });
    broadcast('finished', { exitCode: code, runId: current.runId, label: current.options?.label ?? '', trigger: current.trigger, state: liveState() });
  });
  broadcast('started', liveState());
  return liveState();
}

/**
 * A stopped run is killed before the reporter can save it; keep what is known (the
 * progress so far) so it still shows in the history, marked as stopped.
 */
function recordStoppedRun(live) {
  if (!live?.runId || !RUN_ID.test(live.runId)) return;
  const dir = path.join(RUNS, live.runId);
  if (existsSync(path.join(dir, 'run.json'))) return;
  const counts = {
    total: live.total ?? 0,
    passed: live.passed ?? 0,
    failed: live.failed ?? 0,
    flaky: live.flaky ?? 0,
    skipped: live.skipped ?? 0,
    timedOut: live.timedOut ?? 0,
    interrupted: Math.max(0, (live.total ?? 0) - (live.done ?? 0)),
  };
  const executed = counts.total - counts.skipped - counts.interrupted;
  const summary = {
    id: live.runId,
    label: current.options?.label ? `${current.options.label} (stopped)` : 'Stopped run',
    trigger: current.trigger === 'schedule' ? 'schedule' : 'dashboard',
    status: 'interrupted',
    startedAt: live.startedAt,
    duration: Date.now() - new Date(live.startedAt).getTime(),
    counts,
    passRate: executed > 0 ? Math.round(((counts.passed + counts.flaky) / executed) * 1000) / 10 : null,
    projects: current.options?.projects ?? [],
    branch: null,
    commit: null,
    errors: 0,
  };
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    path.join(dir, 'run.json'),
    JSON.stringify({
      ...summary,
      environment: { command: `npx playwright ${current.args.join(' ')}` },
      config: {},
      globalErrors: [{ message: 'Stopped from the dashboard before it finished. Only the progress counts were kept; open a finished run for test details.' }],
      globalOutput: current.log.join('\n'),
      tests: [],
    }),
  );
  writeIndex([summary, ...runIndex().filter((r) => r.id !== summary.id)]);
}

function stopRun() {
  if (!child) return false;
  current.stopped = true;
  if (process.platform === 'win32') {
    execFile('taskkill', ['/pid', String(child.pid), '/T', '/F'], () => undefined);
  } else {
    child.kill('SIGTERM');
  }
  return true;
}

// --------------------------------------------------------------------------- routes

async function baseUrlStatus(baseURL) {
  const started = Date.now();
  try {
    const res = await fetch(baseURL, { method: 'GET', signal: AbortSignal.timeout(3000) });
    return { reachable: true, status: res.status, ms: Date.now() - started };
  } catch (e) {
    return { reachable: false, error: e.name === 'TimeoutError' ? 'No answer in 3 s' : e.message };
  }
}

async function handleApi(req, res, url) {
  const parts = url.pathname.split('/').filter(Boolean).slice(1); // after "api"
  const method = req.method;

  if (method === 'GET' && parts[0] === 'runs' && parts.length === 1) return send(res, 200, runIndex());

  if (parts[0] === 'runs' && parts[1]) {
    const id = parts[1];
    if (!RUN_ID.test(id)) return fail(res, 400, 'Bad run id');
    const dir = path.join(RUNS, id);
    if (method === 'GET' && parts.length === 2) {
      const run = readJson(path.join(dir, 'run.json'), null);
      return run ? send(res, 200, run) : fail(res, 404, 'Run not found');
    }
    if (method === 'GET' && (parts[2] === 'export.html' || parts[2] === 'print')) {
      const run = readRun(id);
      if (!run) return fail(res, 404, 'Run not found');
      const page = exportRun(run, { print: parts[2] === 'print' });
      const headers = { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' };
      if (parts[2] === 'export.html') headers['content-disposition'] = `attachment; filename="playwright-run-${id}.html"`;
      res.writeHead(200, headers);
      return res.end(page);
    }
    if (method === 'GET' && parts[2] === 'groups') {
      const run = readRun(id);
      return run ? send(res, 200, errorGroups(run)) : fail(res, 404, 'Run not found');
    }
    if (method === 'GET' && parts[2] === 'download') {
      return serveFile(req, res, path.join(dir, 'run.json'), `playwright-run-${id}.json`);
    }
    if (method === 'GET' && parts[2] === 'files' && parts[3]) {
      const file = inside(path.join(dir, 'attachments'), decodeURIComponent(parts.slice(3).join('/')));
      return serveFile(req, res, file, url.searchParams.has('download') ? path.basename(file ?? 'file') : undefined);
    }
    if (method === 'POST' && parts[2] === 'trace' && parts[3]) {
      const file = inside(path.join(dir, 'attachments'), decodeURIComponent(parts[3]));
      if (!file || !existsSync(file)) return fail(res, 404, 'Trace not found');
      const viewer = spawn(process.execPath, [CLI, 'show-trace', file], { cwd: ROOT, detached: true, stdio: 'ignore', windowsHide: true });
      viewer.unref();
      return send(res, 200, { opened: true });
    }
    if (method === 'DELETE' && parts.length === 2) {
      rmSync(dir, { recursive: true, force: true });
      const index = readJson(path.join(REPORTS, 'index.json'), []).filter((r) => r.id !== id);
      writeIndex(index);
      return send(res, 200, { deleted: id });
    }
  }

  if (method === 'DELETE' && parts[0] === 'runs' && parts.length === 1) {
    if (child) return fail(res, 409, 'Stop the running tests first');
    rmSync(RUNS, { recursive: true, force: true });
    writeIndex([]);
    return send(res, 200, { cleared: true });
  }

  if (method === 'GET' && parts[0] === 'history') return send(res, 200, history());

  if (method === 'GET' && parts[0] === 'catalog') {
    return send(res, 200, await loadCatalog(url.searchParams.has('refresh')));
  }

  if (method === 'GET' && parts[0] === 'environment') {
    const cat = await loadCatalog();
    const current = resolveTarget();
    const targets = await Promise.all(
      TARGETS.map(async (name) => {
        const t = resolveTarget(name);
        return { name, label: t.label, baseURL: t.baseURL, account: t.email, passwordSet: Boolean(t.password), status: await baseUrlStatus(t.baseURL) };
      }),
    );
    return send(res, 200, {
      target: current.name,
      targets,
      testEnv: { api: `http://localhost:${TEST_ENV.apiPort}`, database: TEST_ENV.mongoUri, outbox: path.join(TEST_ENV.dir, 'mail-outbox'), logs: path.join(TEST_ENV.dir, 'logs') },
      baseURL: current.baseURL,
      base: await baseUrlStatus(current.baseURL),
      account: current.email,
      passwordSet: Boolean(current.password),
      envFile: existsSync(path.join(ROOT, '.env')),
      playwright: cat.version,
      node: process.version,
      os: `${os.type()} ${os.release()} (${os.arch()})`,
      cpus: os.cpus().length,
      memoryGb: Math.round(os.totalmem() / 1024 ** 3),
      reportsBytes: dirSize(REPORTS),
      runsKept: runIndex().length,
      keep: Number(process.env.PW_DASHBOARD_KEEP ?? settings.get().keep ?? 50),
      maxAgeDays: settings.get().maxAgeDays ?? null,
      keepFromEnv: Boolean(process.env.PW_DASHBOARD_KEEP),
      htmlReport: existsSync(path.join(HTML_REPORT, 'index.html')),
      root: ROOT,
      dashboard: `http://${HOST}:${PORT}`,
      catalogError: cat.error,
      testCount: cat.tests.length,
    });
  }

  if (method === 'GET' && parts[0] === 'live' && parts[1] === 'state') return send(res, 200, { ...liveState(), log: current?.log ?? [] });

  if (method === 'GET' && parts[0] === 'live') {
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' });
    res.write(`event: hello\ndata: ${JSON.stringify(liveState())}\n\n`);
    clients.add(res);
    const ping = setInterval(() => res.write(': ping\n\n'), 20_000);
    req.on('close', () => {
      clearInterval(ping);
      clients.delete(res);
    });
    return;
  }

  if (method === 'POST' && parts[0] === 'run') {
    try {
      return send(res, 200, await startRun(await readBody(req)));
    } catch (e) {
      return fail(res, 409, e.message);
    }
  }

  if (method === 'POST' && parts[0] === 'stop') return send(res, 200, { stopping: stopRun() });

  // ------------------------------------------------------------ test environment
  if (parts[0] === 'testenv') {
    if (method === 'GET' && parts[1] === 'status') return send(res, 200, await envStatus());
    if (method === 'POST' && parts[1] === 'start') {
      const body = await readBody(req);
      try {
        startEnv({ reset: body.reset === true, rebuild: body.rebuild === true });
        return send(res, 200, await envStatus());
      } catch (e) {
        return fail(res, 409, e.message);
      }
    }
    if (method === 'POST' && parts[1] === 'stop') {
      if (child && current?.target === 'test') return fail(res, 409, 'Tests are running against it: stop the run first');
      await stopEnv();
      return send(res, 200, await envStatus());
    }
    if (method === 'GET' && parts[1] === 'logs') {
      const from = url.searchParams.get('from');
      const to = url.searchParams.get('to');
      if (from && to) return send(res, 200, logWindow(from, to));
      const offset = url.searchParams.has('offset') ? Number(url.searchParams.get('offset')) : undefined;
      return send(res, 200, logChunk(offset));
    }
    if (method === 'GET' && parts[1] === 'leftovers') {
      try {
        return send(res, 200, await leftovers());
      } catch (e) {
        return fail(res, 503, `Could not read the test database: ${e.message}`);
      }
    }
    if (method === 'POST' && parts[1] === 'cleanup') {
      const body = await readBody(req);
      try {
        return send(res, 200, await cleanLeftovers(Array.isArray(body.kinds) ? body.kinds : []));
      } catch (e) {
        return fail(res, 503, e.message);
      }
    }
  }

  // ---------------------------------------------------------------------- emails
  if (parts[0] === 'mail') {
    if (method === 'GET' && parts.length === 1) return send(res, 200, listMail());
    if (method === 'DELETE' && parts.length === 1) return send(res, 200, { removed: clearMail() });
    if (method === 'GET' && parts[1] && parts[2] === 'raw') {
      const name = decodeURIComponent(parts[1]);
      return serveFile(req, res, mailFile(name), name);
    }
    if (method === 'GET' && parts[1]) {
      const mail = readMail(decodeURIComponent(parts[1]));
      return mail ? send(res, 200, mail) : fail(res, 404, 'Email not found');
    }
  }

  // ------------------------------------------------------------- insights & quality
  if (method === 'GET' && parts[0] === 'coverage') return send(res, 200, await coverage(url.searchParams.get('run') || undefined));
  if (method === 'GET' && parts[0] === 'quality') return send(res, 200, qualityTrend());
  if (method === 'GET' && parts[0] === 'health') return send(res, 200, catalogHealth(await loadCatalog()));
  if (method === 'GET' && parts[0] === 'search') {
    return send(res, 200, search(url.searchParams.get('q') ?? '', { state: url.searchParams.get('state') ?? 'all' }));
  }
  if (parts[0] === 'visual') {
    if (method === 'GET' && parts.length === 1) return send(res, 200, visual(url.searchParams.get('run') || undefined));
    if (method === 'GET' && parts[1] === 'baseline' && parts[2]) return serveFile(req, res, baselinePath(parts[2]));
    if (method === 'POST' && parts[1] === 'approve') {
      const body = await readBody(req);
      try {
        const keys = Array.isArray(body.keys) ? body.keys : [body.key];
        return send(res, 200, keys.filter(Boolean).map((k) => approveBaseline(String(body.runId), String(k))));
      } catch (e) {
        return fail(res, 400, e.message);
      }
    }
    if (method === 'POST' && parts[1] === 'remove') {
      const body = await readBody(req);
      return send(res, 200, { removed: removeBaseline(String(body.key)) });
    }
  }

  // ------------------------------------------------------------ notes & mutes
  if (parts[0] === 'notes') {
    if (method === 'GET') return send(res, 200, notes.get());
    if (method === 'PUT') {
      const body = await readBody(req);
      const key = String(body.key ?? '');
      if (!key || key.length > 600) return fail(res, 400, 'Missing test');
      const all = notes.get();
      const note = String(body.note ?? '').trim().slice(0, 4000);
      if (!note && !body.muted) delete all[key];
      else all[key] = { note, muted: Boolean(body.muted), updatedAt: new Date().toISOString() };
      notes.set(all);
      return send(res, 200, all[key] ?? null);
    }
  }

  // ------------------------------------------------------------- saved setups
  if (parts[0] === 'presets') {
    if (method === 'GET') return send(res, 200, presets.get());
    if (method === 'POST') {
      const body = await readBody(req);
      const name = String(body.name ?? '').trim().slice(0, 60);
      if (!name) return fail(res, 400, 'Enter a name');
      const list = presets.get().filter((p) => p.name.toLowerCase() !== name.toLowerCase());
      const item = { id: newId(), name, options: body.options ?? {}, createdAt: new Date().toISOString() };
      presets.set([item, ...list].slice(0, 50));
      return send(res, 200, item);
    }
    if (method === 'DELETE' && parts[1]) {
      presets.set(presets.get().filter((p) => p.id !== parts[1]));
      return send(res, 200, { deleted: parts[1] });
    }
  }

  // ---------------------------------------------------------------- schedules
  if (parts[0] === 'schedules') {
    if (method === 'GET') return send(res, 200, listSchedules());
    if (method === 'POST' || method === 'PUT') {
      try {
        return send(res, 200, saveSchedule(await readBody(req)));
      } catch (e) {
        return fail(res, 400, e.message);
      }
    }
    if (method === 'DELETE' && parts[1]) return send(res, 200, { deleted: deleteSchedule(parts[1]) });
  }

  // ----------------------------------------------------------------- settings
  if (parts[0] === 'settings') {
    if (method === 'GET') return send(res, 200, settings.get());
    if (method === 'PUT') {
      const body = await readBody(req);
      const keep = Number.parseInt(body.keep, 10);
      const maxAgeDays = body.maxAgeDays === null || body.maxAgeDays === '' || body.maxAgeDays === undefined ? null : Number.parseInt(body.maxAgeDays, 10);
      if (!(keep >= 1 && keep <= 500)) return fail(res, 400, 'Keep 1 to 500 runs');
      if (maxAgeDays !== null && !(maxAgeDays >= 1 && maxAgeDays <= 3650)) return fail(res, 400, 'Days must be 1 to 3650, or empty for no limit');
      settings.set({ ...settings.get(), keep, maxAgeDays });
      return send(res, 200, { ...settings.get(), removed: prune() });
    }
  }

  if (method === 'POST' && parts[0] === 'open-report') {
    if (!existsSync(path.join(HTML_REPORT, 'index.html'))) return fail(res, 404, 'No HTML report yet');
    return send(res, 200, { url: '/html-report/index.html' });
  }

  return fail(res, 404, 'Unknown endpoint');
}

function writeIndex(index) {
  mkdirSync(REPORTS, { recursive: true });
  writeFileSync(path.join(REPORTS, 'index.json'), JSON.stringify(index));
}

/** Drops runs beyond the number to keep or older than the age limit (Setup page). */
function prune() {
  if (child) return 0;
  const { keep = 50, maxAgeDays = null } = settings.get();
  const limit = Number(process.env.PW_DASHBOARD_KEEP ?? keep);
  const index = runIndex();
  const old = (r) => maxAgeDays && Date.now() - new Date(r.startedAt).getTime() > maxAgeDays * 864e5;
  const stay = index.filter((r, i) => i < limit && !old(r));
  const drop = index.filter((r) => !stay.includes(r));
  for (const r of drop) rmSync(path.join(RUNS, r.id), { recursive: true, force: true });
  if (drop.length) writeIndex(stay);
  return drop.length;
}
setInterval(prune, 3_600_000);

// Test environment changes go to every open page.
let envTimer = null;
onEnvChange((type, data) => {
  if (type === 'line') broadcast('env-line', { line: data });
  clearTimeout(envTimer);
  envTimer = setTimeout(async () => broadcast('env', await envStatus()), 150);
});

/** Waits until the test environment answers (scheduled runs that start it first). */
async function envReady(ms = 6 * 60_000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    const st = await envStatus();
    if (st.phase === 'ready') return;
    if (st.phase === 'failed') throw new Error('The test environment did not start');
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error('The test environment did not start in time');
}

startScheduler({
  busy: () => Boolean(child),
  log: (line) => console.log(line),
  run: async (schedule) => {
    const target = TARGETS.includes(schedule.options?.target) ? schedule.options.target : resolveTarget().name;
    if (target === 'test' && schedule.startEnv) {
      const st = await envStatus();
      if (st.phase !== 'ready') {
        if (st.phase !== 'starting') startEnv({});
        await envReady();
      }
    }
    await startRun({ ...schedule.options, label: `Scheduled: ${schedule.name}`.slice(0, 80) }, 'schedule');
    current.scheduleId = schedule.id;
  },
});

const server = http.createServer(async (req, res) => {
  try {
    // Only this machine, by name (blocks DNS-rebinding pages).
    const host = req.headers.host ?? '';
    if (host !== `${HOST}:${PORT}` && host !== `localhost:${PORT}`) return fail(res, 403, 'Forbidden host');
    const url = new URL(req.url ?? '/', `http://${host}`);

    if (url.pathname.startsWith('/api/')) {
      // Changes need our own header: other websites cannot send it without permission.
      if (req.method !== 'GET' && req.headers['x-dashboard'] !== '1') return fail(res, 403, 'Missing header');
      return await handleApi(req, res, url);
    }
    if (url.pathname.startsWith('/html-report/')) {
      const rel = decodeURIComponent(url.pathname.slice('/html-report/'.length)) || 'index.html';
      return serveFile(req, res, inside(HTML_REPORT, rel));
    }
    const rel = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
    return serveFile(req, res, inside(PUBLIC, rel));
  } catch (e) {
    if (!res.headersSent) fail(res, 500, e.message);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`AuthCore test dashboard: http://${HOST}:${PORT}`);
  loadCatalog();
  prune();
});
