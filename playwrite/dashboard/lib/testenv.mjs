// Start / stop the test environment (test-env/start.mjs), read its backend log, and find or
// remove data that tests left behind in the test database.
import { execFile, spawn } from 'node:child_process';
import { closeSync, existsSync, openSync, readFileSync, readSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { TEST_ENV } from '../../target.mjs';
import { ROOT, stripAnsi } from './util.mjs';

const STATE = path.join(TEST_ENV.dir, 'state.json');
const LOG = path.join(TEST_ENV.dir, 'logs', 'backend.log');
const WEB = `http://localhost:${TEST_ENV.webPort}`;
const API = `http://localhost:${TEST_ENV.apiPort}`;
const BACKEND = path.resolve(ROOT, '..', 'authcore-backend');

let child = null;
let phase = 'stopped'; // starting | ready | failed | stopped
let startedAt = null;
let output = [];
let options = null;
const listeners = new Set();

export const onEnvChange = (fn) => (listeners.add(fn), () => listeners.delete(fn));
const emit = (type, data) => listeners.forEach((fn) => fn(type, data));

const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

async function reachable(url) {
  const started = Date.now();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2500) });
    return { up: res.status < 500, status: res.status, ms: Date.now() - started };
  } catch {
    return { up: false };
  }
}

export async function envStatus() {
  const state = existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')) : null;
  const [web, api] = await Promise.all([reachable(WEB), reachable(`${API}/api/v1/health/live`)]);
  const external = !child && state && alive(state.pid);
  let current = phase;
  if (!child) current = web.up && api.up ? 'ready' : phase === 'failed' ? 'failed' : 'stopped';
  return {
    phase: current,
    managed: Boolean(child),
    external: Boolean(external),
    startedAt: child ? startedAt : (state?.startedAt ?? null),
    pid: child?.pid ?? state?.pid ?? null,
    options,
    web: { url: WEB, ...web },
    api: { url: `${API}/api/v1`, docs: `${API}/api/docs`, ...api },
    database: TEST_ENV.mongoUri,
    admin: TEST_ENV.adminEmail,
    output: output.slice(-400),
  };
}

export function startEnv({ reset = false, rebuild = false } = {}) {
  if (child) throw new Error('The test environment is already starting or running');
  const args = [path.join(ROOT, 'test-env', 'start.mjs')];
  if (reset) args.push('--reset');
  if (rebuild) args.push('--rebuild');
  output = [];
  options = { reset, rebuild };
  phase = 'starting';
  startedAt = new Date().toISOString();
  child = spawn(process.execPath, args, { cwd: ROOT, windowsHide: true, env: { ...process.env, FORCE_COLOR: '0' } });
  const onData = (chunk) => {
    for (const line of stripAnsi(chunk.toString()).split(/\r?\n/)) {
      if (!line.trim()) continue;
      output.push(line);
      if (output.length > 1000) output.shift();
      if (line.includes('[test-env] Ready.')) phase = 'ready';
      emit('line', line);
    }
    emit('state', phase);
  };
  child.stdout.on('data', onData);
  child.stderr.on('data', onData);
  child.on('close', (code) => {
    phase = code === 0 || stopping ? 'stopped' : 'failed';
    output.push(`[dashboard] The test environment stopped${code ? ` (exit ${code})` : ''}.`);
    child = null;
    stopping = false;
    emit('state', phase);
  });
  emit('state', phase);
}

let stopping = false;
const killTree = (pid) =>
  new Promise((resolve) => {
    if (process.platform === 'win32') execFile('taskkill', ['/pid', String(pid), '/T', '/F'], () => resolve());
    else {
      try {
        process.kill(pid, 'SIGTERM');
      } catch {
        /* gone */
      }
      resolve();
    }
  });

/** Stops the environment, also one started outside the dashboard (from a terminal). */
export async function stopEnv() {
  const state = existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')) : null;
  if (child) {
    stopping = true;
    await killTree(child.pid);
  }
  if (state?.pid && alive(state.pid)) await killTree(state.pid);
  if (state?.backendPid && alive(state.backendPid)) await killTree(state.backendPid);
  rmSync(STATE, { force: true });
  phase = 'stopped';
  emit('state', phase);
  return true;
}

// ------------------------------------------------------------------------- backend log

const TIME = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)\s+(\w+)\s+(.*)$/;

function parseLines(text) {
  const out = [];
  for (const rawLine of stripAnsi(text).split(/\r?\n/)) {
    if (!rawLine) continue;
    const m = TIME.exec(rawLine);
    if (m) out.push({ t: m[1], level: m[2].toLowerCase(), text: m[3] });
    else if (out.length) out.at(-1).text += `\n${rawLine}`;
    else out.push({ t: null, level: 'info', text: rawLine });
  }
  return out;
}

function readRange(start, end) {
  const fd = openSync(LOG, 'r');
  try {
    const buf = Buffer.alloc(end - start);
    readSync(fd, buf, 0, buf.length, start);
    return buf.toString('utf8');
  } finally {
    closeSync(fd);
  }
}

/**
 * Follow the log: lines after byte `offset` (or the last part of the file). `reset` tells
 * the page the file was started anew (environment restarted).
 */
export function logChunk(offset) {
  if (!existsSync(LOG)) return { offset: 0, size: 0, lines: [], missing: true };
  const size = statSync(LOG).size;
  let start = Number.isInteger(offset) && offset >= 0 ? offset : Math.max(0, size - 200_000);
  let reset = false;
  if (start > size) {
    start = Math.max(0, size - 200_000);
    reset = true;
  }
  const end = Math.min(size, start + 512_000);
  let text = end > start ? readRange(start, end) : '';
  // Start on a full line when jumping into the middle.
  if (offset === undefined && start > 0) text = text.slice(text.indexOf('\n') + 1);
  // Keep a half-written last line for the next call.
  const lastNl = text.lastIndexOf('\n');
  const usable = end === size && lastNl >= 0 ? text.slice(0, lastNl + 1) : text;
  return { offset: start + Buffer.byteLength(usable), size, lines: parseLines(usable), reset };
}

/** Log lines between two times (for one test's attempt). */
export function logWindow(from, to) {
  if (!existsSync(LOG)) return { lines: [], missing: true };
  const size = statSync(LOG).size;
  const start = Math.max(0, size - 30_000_000);
  const lines = parseLines(readRange(start, size));
  const a = new Date(from).getTime() - 500;
  const b = new Date(to).getTime() + 1500;
  const first = lines.find((l) => l.t)?.t ?? null;
  return {
    logStartedAt: first,
    lines: lines.filter((l) => l.t && new Date(l.t).getTime() >= a && new Date(l.t).getTime() <= b).slice(0, 3000),
  };
}

// --------------------------------------------------------------------- leftover test data

let db = null;
async function database() {
  const dbName = new URL(TEST_ENV.mongoUri.replace(/^mongodb(\+srv)?:/, 'http:')).pathname.slice(1);
  if (!/_(e2e|test)$/.test(dbName)) throw new Error(`Refusing: "${dbName}" is not a test database (name must end in _test)`);
  if (db?.readyState === 1) return db;
  const { default: mongoose } = await import(pathToFileURL(path.join(BACKEND, 'node_modules', 'mongoose', 'index.js')).href);
  db = await mongoose.createConnection(TEST_ENV.mongoUri, { serverSelectionTimeoutMS: 4000 }).asPromise();
  return db;
}

/** What tests make: keys and names start with PW, users pw.… @authcore.test. */
const KINDS = [
  { kind: 'roles', label: 'Roles', collection: 'roles', query: { roleKey: /^PW-/ }, name: (d) => `${d.roleName} (${d.roleKey})`, api: (id) => `/roles/${id}` },
  { kind: 'groups', label: 'Groups', collection: 'groups', query: { groupName: /^PW / }, name: (d) => `${d.groupName}${d.groupId ? ` (${d.groupId})` : ''}`, api: (id) => `/groups/${id}`, sort: { level: -1 } },
  { kind: 'users', label: 'Users', collection: 'users', query: { email: /^pw[.-].*@authcore\.test$/i }, name: (d) => d.email, api: (id) => `/admin/users/${id}` },
  { kind: 'roleCategories', label: 'Role categories', collection: 'role_categories', query: { label: /^PW / }, name: (d) => `${d.label} (${d.value})`, usedBy: { collection: 'roles', field: 'category' } },
  { kind: 'groupCategories', label: 'Group categories', collection: 'group_categories', query: { label: /^PW / }, name: (d) => `${d.label} (${d.value})`, usedBy: { collection: 'groups', field: 'category' } },
];

export async function leftovers() {
  const conn = await database();
  const out = [];
  for (const k of KINDS) {
    // Deleted records stay in the database marked isDeleted: they are already cleaned up.
    const base = { ...k.query, isDeleted: { $ne: true } };
    const query = k.kind === 'users' ? { ...base, email: { $regex: k.query.email, $ne: TEST_ENV.adminEmail } } : base;
    const docs = await conn.collection(k.collection).find(query).sort(k.sort ?? { createdAt: -1 }).limit(500).toArray();
    out.push({
      kind: k.kind,
      label: k.label,
      how: k.api ? 'Deleted through the API, like the app does' : 'Removed from the database (the app has no delete for these) once nothing uses them',
      items: docs.map((d) => ({ id: String(d._id), name: k.name(d), createdAt: d.createdAt ?? null })),
    });
  }
  return out;
}

async function signIn() {
  const password = process.env.E2E_TEST_ADMIN_PASSWORD;
  if (!password) throw new Error('E2E_TEST_ADMIN_PASSWORD is not set in playwrite/.env');
  const res = await fetch(`${API}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: TEST_ENV.adminEmail, password }),
  });
  const body = await res.json().catch(() => ({}));
  const token = body?.data?.accessToken ?? body?.accessToken;
  if (!res.ok || !token) throw new Error(`Could not sign in as the test admin (HTTP ${res.status}). Is the test environment running?`);
  return token;
}

/** Removes the given kinds (all when empty). Returns what happened per item. */
export async function cleanLeftovers(kinds = []) {
  const wanted = (k) => !kinds.length || kinds.includes(k.kind);
  const found = await leftovers();
  const conn = await database();
  const results = [];
  let token = null;
  for (const k of KINDS.filter(wanted)) {
    const items = found.find((f) => f.kind === k.kind)?.items ?? [];
    for (const item of items) {
      if (k.api) {
        token ??= await signIn();
        // The API limits deletes per minute: on "too many requests", wait as told and retry.
        let res;
        for (let attempt = 0; attempt < 6; attempt++) {
          res = await fetch(`${API}/api/v1${k.api(item.id)}`, { method: 'DELETE', headers: { authorization: `Bearer ${token}` } });
          if (res.status !== 429) break;
          const wait = Math.min(65, Number(res.headers.get('retry-after')) || 15);
          await new Promise((r) => setTimeout(r, wait * 1000));
        }
        const body = res.ok ? null : await res.json().catch(() => ({}));
        results.push({ kind: k.kind, name: item.name, ok: res.ok, message: res.ok ? 'Deleted' : (body?.message ?? `HTTP ${res.status}`) });
      } else {
        // Ids here are text (UUIDs) or ObjectIds: match on the string form.
        const doc = (await conn.collection(k.collection).find(k.query).toArray()).find((d) => String(d._id) === item.id);
        if (!doc) continue;
        const inUse = await conn.collection(k.usedBy.collection).countDocuments({ [k.usedBy.field]: doc.value, isDeleted: { $ne: true } });
        if (inUse) {
          results.push({ kind: k.kind, name: item.name, ok: false, message: `Still used by ${inUse} record(s)` });
          continue;
        }
        await conn.collection(k.collection).deleteOne({ _id: doc._id });
        results.push({ kind: k.kind, name: item.name, ok: true, message: 'Removed' });
      }
    }
  }
  return results;
}
