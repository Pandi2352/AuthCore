#!/usr/bin/env node
// The AuthCore test environment for Playwright, separate from your dev servers:
//
//   backend   authcore-backend built into dist-pw/   http://localhost:3998
//   frontend  built into .test-env/web, served here   http://localhost:5174 (/api → backend)
//   database  mongodb://localhost:27017/authcore_pw_test (its own)
//   email     never sent: written as .eml files to .test-env/mail-outbox
//   files     .test-env/uploads
//
//   npm run env:test              build what changed, start, keep running (Ctrl+C stops)
//   npm run env:test -- --reset   also start from an empty database, outbox and uploads
//   npm run env:test -- --rebuild build backend and frontend even if nothing changed
//
// Settings come from authcore-backend/.env.example plus the overrides below, never from
// your backend .env, so it can't send real email or touch your dev database.
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes, randomInt } from 'node:crypto';
import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { ROOT, TEST_ENV } from '../target.mjs';

const AUTHCORE = path.resolve(ROOT, '..');
const BACKEND = path.join(AUTHCORE, 'authcore-backend');
const FRONTEND = path.join(AUTHCORE, 'authcore-frontend');
const DIR = TEST_ENV.dir;
const WEB = path.join(DIR, 'web');
const OUTBOX = path.join(DIR, 'mail-outbox');
const UPLOADS = path.join(DIR, 'uploads');
const LOGS = path.join(DIR, 'logs');
const BACKEND_DIST = path.join(BACKEND, 'dist-pw');
const ENV_FILE = path.join(ROOT, '.env');
const API = `http://localhost:${TEST_ENV.apiPort}`;
const WEB_URL = `http://localhost:${TEST_ENV.webPort}`;

const args = new Set(process.argv.slice(2));
const log = (msg) => console.log(`[test-env] ${msg}`);
const fail = (msg) => {
  console.error(`[test-env] ${msg}`);
  process.exit(1);
};

// ------------------------------------------------------------------------- helpers

function newestMtime(target, skip = /node_modules|dist|\.git/) {
  if (!existsSync(target)) return 0;
  const st = statSync(target);
  if (!st.isDirectory()) return st.mtimeMs;
  let newest = 0;
  for (const entry of readdirSync(target, { withFileTypes: true })) {
    if (skip.test(entry.name)) continue;
    newest = Math.max(newest, newestMtime(path.join(target, entry.name), skip));
  }
  return newest;
}

function portIsFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => server.close(() => resolve(true)));
    server.listen(port, '0.0.0.0');
  });
}

function parseEnvFile(file) {
  const values = {};
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && m[2] !== '') values[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return values;
}

/** Set KEY=value in playwrite/.env (adds or replaces the line). */
function setEnvValue(key, value) {
  const text = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, 'utf8') : '';
  const line = `${key}=${value}`;
  const next = new RegExp(`^${key}=.*$`, 'm').test(text)
    ? text.replace(new RegExp(`^${key}=.*$`, 'm'), line)
    : `${text.replace(/\n*$/, '\n')}${line}\n`;
  writeFileSync(ENV_FILE, next);
}

function strongPassword() {
  const sets = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnopqrstuvwxyz', '23456789', '!@#%^*-_+=?'];
  const all = sets.join('');
  const pick = (s) => s[randomInt(s.length)];
  const chars = [...sets.map(pick), ...Array.from({ length: 20 }, () => pick(all))];
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

function run(cmd, cmdArgs, cwd, label) {
  log(`${label}…`);
  const started = Date.now();
  const res = spawnSync(cmd, cmdArgs, { cwd, stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32', encoding: 'utf8' });
  if (res.status !== 0) {
    console.error(`${res.stdout ?? ''}\n${res.stderr ?? ''}`.trim().split('\n').slice(-30).join('\n'));
    fail(`${label} failed`);
  }
  log(`${label}: done in ${Math.round((Date.now() - started) / 1000)} s`);
}

async function waitFor(url, label, ms = 90_000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (res.status < 500) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 700));
  }
  fail(`${label} did not start within ${ms / 1000} s (see .test-env/logs)`);
}

// --------------------------------------------------------------------------- steps

async function resetData() {
  const dbName = new URL(TEST_ENV.mongoUri.replace(/^mongodb(\+srv)?:/, 'http:')).pathname.slice(1);
  if (!/_(e2e|test)$/.test(dbName)) fail(`Refusing to reset "${dbName}": the test database name must end in _test`);
  const { default: mongoose } = await import(pathToFileURL(path.join(BACKEND, 'node_modules', 'mongoose', 'index.js')).href);
  await mongoose.connect(TEST_ENV.mongoUri, { serverSelectionTimeoutMS: 5000 });
  await mongoose.connection.db.dropDatabase();
  await mongoose.disconnect();
  rmSync(OUTBOX, { recursive: true, force: true });
  rmSync(UPLOADS, { recursive: true, force: true });
  log(`Reset: database ${dbName}, outbox and uploads emptied`);
}

function buildBackend() {
  const built = existsSync(path.join(BACKEND_DIST, 'main.js')) ? statSync(path.join(BACKEND_DIST, 'main.js')).mtimeMs : 0;
  const source = Math.max(newestMtime(path.join(BACKEND, 'src')), newestMtime(path.join(BACKEND, 'package.json')));
  if (!args.has('--rebuild') && built > source) return log('Backend: up to date');
  run('npx', ['nest', 'build', '-p', path.relative(BACKEND, path.join(ROOT, 'test-env', 'tsconfig.backend.json'))], BACKEND, 'Building the backend (into dist-pw, your dist/ is untouched)');
}

function buildFrontend() {
  const built = existsSync(path.join(WEB, 'index.html')) ? statSync(path.join(WEB, 'index.html')).mtimeMs : 0;
  const source = Math.max(
    newestMtime(path.join(FRONTEND, 'src')),
    newestMtime(path.join(FRONTEND, 'public')),
    ...['index.html', 'vite.config.ts', 'package.json', '.env'].map((f) => newestMtime(path.join(FRONTEND, f))),
  );
  if (!args.has('--rebuild') && built > source) return log('Frontend: up to date');
  run('npx', ['vite', 'build', '--outDir', WEB, '--emptyOutDir', '--logLevel', 'warn'], FRONTEND, 'Building the frontend');
}

function secrets() {
  const file = path.join(DIR, 'secrets.json');
  // Kept between restarts so sign-ins and links stay valid; never committed.
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'));
  const value = {
    JWT_ACCESS_SECRET: randomBytes(48).toString('base64'),
    VERIFICATION_TOKEN_SECRET: randomBytes(48).toString('base64'),
  };
  writeFileSync(file, JSON.stringify(value, null, 2));
  return value;
}

function adminPassword() {
  if (existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);
  let password = process.env.E2E_TEST_ADMIN_PASSWORD;
  if (!password) {
    password = strongPassword();
    setEnvValue('E2E_TEST_ADMIN_PASSWORD', password);
    log('New test admin password saved in playwrite/.env (E2E_TEST_ADMIN_PASSWORD)');
  }
  return password;
}

function startBackend(password) {
  const env = {
    ...process.env,
    ...parseEnvFile(path.join(BACKEND, '.env.example')),
    ...secrets(),
    NODE_ENV: 'development',
    IGNORE_ENV_FILE: 'true',
    PORT: String(TEST_ENV.apiPort),
    MONGODB_URI: TEST_ENV.mongoUri,
    CORS_ORIGIN: WEB_URL,
    EMAIL_VERIFICATION_URL: `${WEB_URL}/verify-email`,
    PASSWORD_RESET_URL: `${WEB_URL}/reset-password`,
    INVITE_ACCEPT_URL: `${WEB_URL}/accept-invite`,
    FILES_PUBLIC_BASE_URL: `${WEB_URL}/api/v1/files/public`,
    MAIL_TRANSPORT: 'outbox',
    MAIL_OUTBOX_DIR: OUTBOX,
    STORAGE_LOCAL_DIR: UPLOADS,
    // Many tests from one machine: the general per-IP limit would get in the way.
    // (Sign-in limits are built into the app and stay as they are.)
    THROTTLE_LIMIT: '5000',
    BOOTSTRAP_ADMIN_ENABLED: 'true',
    BOOTSTRAP_ADMIN_EMAIL: TEST_ENV.adminEmail,
    BOOTSTRAP_ADMIN_PASSWORD: password,
    BOOTSTRAP_ADMIN_FIRST_NAME: 'Playwright',
    BOOTSTRAP_ADMIN_LAST_NAME: 'Admin',
    BOOTSTRAP_ADMIN_MUST_CHANGE_PASSWORD: 'false',
    VIRUS_SCAN_ENABLED: 'false',
    LOG_FILE_ENABLED: 'false',
    METRICS_TOKEN: '',
    SWAGGER_ENABLED: 'true',
  };
  for (const key of ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD']) delete env[key];
  mkdirSync(LOGS, { recursive: true });
  const out = createWriteStream(path.join(LOGS, 'backend.log'), { flags: 'w' });
  const child = spawn(process.execPath, ['--enable-source-maps', path.join(BACKEND_DIST, 'main.js')], { cwd: BACKEND, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  child.stdout.pipe(out);
  child.stderr.pipe(out);
  child.on('exit', (code) => {
    if (!stopping) {
      console.error(`[test-env] The backend stopped (exit ${code}). Last lines of .test-env/logs/backend.log:`);
      try {
        console.error(readFileSync(path.join(LOGS, 'backend.log'), 'utf8').trim().split('\n').slice(-20).join('\n'));
      } catch {
        /* ignore */
      }
      shutdown(1);
    }
  });
  return child;
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

/** Serves the built frontend; /api goes to the test backend (same origin, like Vite's proxy). */
function startWeb() {
  const server = http.createServer((req, res) => {
    if (req.url.startsWith('/api/')) {
      const upstream = http.request(
        { host: 'localhost', port: TEST_ENV.apiPort, method: req.method, path: req.url, headers: { ...req.headers, host: `localhost:${TEST_ENV.apiPort}` } },
        (up) => {
          res.writeHead(up.statusCode ?? 502, up.headers);
          up.pipe(res);
        },
      );
      upstream.on('error', () => {
        if (!res.headersSent) res.writeHead(502, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ message: 'Test backend is not answering' }));
      });
      req.pipe(upstream);
      return;
    }
    const urlPath = decodeURIComponent(new URL(req.url, WEB_URL).pathname);
    let file = path.resolve(WEB, `.${urlPath}`);
    if (!file.startsWith(WEB) || !existsSync(file) || statSync(file).isDirectory()) file = path.join(WEB, 'index.html');
    const hashed = /[.-][A-Za-z0-9_-]{8,}\.(js|css|woff2?|png|svg|webp)$/.test(file);
    res.writeHead(200, {
      'content-type': TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
      'cache-control': hashed ? 'public, max-age=31536000, immutable' : 'no-cache',
    });
    createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(TEST_ENV.webPort, () => resolve(server)));
}

async function checkSignIn(password) {
  const res = await fetch(`${WEB_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: TEST_ENV.adminEmail, password }),
  });
  if (res.ok) return log(`Test admin signs in: ${TEST_ENV.adminEmail}`);
  const body = await res.text();
  log(`Warning: test admin could not sign in (HTTP ${res.status}). ${res.status === 401 ? 'The password in .env differs from the database: run with --reset.' : body.slice(0, 200)}`);
}

// ---------------------------------------------------------------------------- main

let backend = null;
let web = null;
let stopping = false;
function shutdown(code = 0) {
  stopping = true;
  web?.close();
  if (backend && backend.exitCode === null) backend.kill();
  rmSync(path.join(DIR, 'state.json'), { force: true });
  setTimeout(() => process.exit(code), 300);
}
process.on('SIGINT', () => (log('Stopping…'), shutdown(0)));
process.on('SIGTERM', () => shutdown(0));

mkdirSync(DIR, { recursive: true });
for (const [port, what] of [
  [TEST_ENV.apiPort, 'test backend'],
  [TEST_ENV.webPort, 'test frontend'],
]) {
  if (!(await portIsFree(port))) fail(`Port ${port} (${what}) is in use. Is the test environment already running?`);
}
if (args.has('--reset')) await resetData();
buildBackend();
buildFrontend();
const password = adminPassword();
backend = startBackend(password);
web = await startWeb();
await waitFor(`${API}/api/v1/health/live`, 'Test backend');
await checkSignIn(password);
writeFileSync(path.join(DIR, 'state.json'), JSON.stringify({ pid: process.pid, backendPid: backend.pid, startedAt: new Date().toISOString(), web: WEB_URL, api: API }));
log('Ready.');
log(`  App       ${WEB_URL}`);
log(`  API       ${API}/api/v1 (docs: ${API}/api/docs)`);
log(`  Database  ${TEST_ENV.mongoUri}`);
log(`  Emails    ${OUTBOX}`);
log(`  Logs      ${LOGS}`);
log('Run tests in another terminal: npm test   (Ctrl+C here stops the environment)');
