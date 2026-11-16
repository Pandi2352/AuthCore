#!/usr/bin/env node
// End-to-end test runner.
//   npm run test:e2e                 all suites
//   npm run test:e2e -- login files  only these
// Each suite starts the built app (dist/main.js) on E2E_PORT against a
// separate database and checks the HTTP API, database and emails (outbox).
// Settings come from .env.example + test overrides, never from your .env,
// so runs are the same locally and in CI and never send real email.
'use strict';
const { spawn, spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');

const BACKEND = path.resolve(__dirname, '..', '..');
const SUITES = ['flows', 'login', 'refresh', 'me', 'logout', 'sessions', 'password', 'policy', 'access', 'users', 'profile', 'files', 'notify', 'bootstrap', 'ops', 'maintenance'];
const PORT = process.env.E2E_PORT || '3999';
const MONGODB_URI = process.env.E2E_MONGODB_URI || 'mongodb://localhost:27017/authcore_e2e';

/** KEY=value lines (comments / blanks ignored). */
function parseEnvFile(file) {
  const values = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && m[2] !== '') values[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return values;
}

function portIsFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => server.close(() => resolve(true)));
    server.listen(Number(port), '0.0.0.0');
  });
}

async function resetDatabase() {
  const dbName = new URL(MONGODB_URI.replace(/^mongodb\+srv:/, 'https:').replace(/^mongodb:/, 'http:')).pathname.slice(1);
  if (!/_(e2e|test)$/.test(dbName)) {
    throw new Error(`Refusing to reset database "${dbName}": E2E_MONGODB_URI must point to a database ending in _e2e or _test`);
  }
  const mongoose = require(path.join(BACKEND, 'node_modules', 'mongoose'));
  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
  await mongoose.connection.db.dropDatabase();
  await mongoose.disconnect();
  return dbName;
}

/**
 * Runs one suite. Resolves when the suite process exits (not when its pipes
 * close: an app it started may still hold them on Windows). 15 min limit.
 */
function runSuite(suite, env) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(__dirname, 'suites', `${suite}.e2e.js`), BACKEND], {
      cwd: BACKEND,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', (d) => { output += d; });
    child.stderr.on('data', (d) => { output += d; });
    const timer = setTimeout(() => {
      output += '\nRUNNER: suite timed out after 15 minutes\n';
      child.kill();
    }, 15 * 60 * 1000);
    child.once('exit', (status) => {
      clearTimeout(timer);
      // Let buffered output arrive, then stop listening.
      setTimeout(() => {
        child.stdout.destroy();
        child.stderr.destroy();
        resolve({ status, output });
      }, 300);
    });
  });
}

/** Stops processes still listening on the test port (only our test apps: the port was free at start). */
function killPortListeners(port) {
  const pids = new Set();
  if (process.platform === 'win32') {
    const out = spawnSync('netstat', ['-ano', '-p', 'TCP'], { encoding: 'utf8' }).stdout ?? '';
    for (const line of out.split(/\r?\n/)) {
      const m = new RegExp(`:${port}\\s+\\S+\\s+LISTENING\\s+(\\d+)`).exec(line);
      if (m) pids.add(Number(m[1]));
    }
  } else {
    const out = spawnSync('lsof', ['-t', `-iTCP:${port}`, '-sTCP:LISTEN'], { encoding: 'utf8' }).stdout ?? '';
    for (const pid of out.split(/\s+/).filter(Boolean)) pids.add(Number(pid));
  }
  for (const pid of pids) {
    if (pid > 0 && pid !== process.pid) {
      try {
        process.kill(pid);
      } catch {
        // already gone
      }
    }
  }
  if (pids.size > 0) {
    spawnSync(process.execPath, ['-e', 'setTimeout(() => {}, 800)']);
  }
}

async function main() {
  const wanted = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  const unknown = wanted.filter((s) => !SUITES.includes(s));
  if (unknown.length) {
    console.error(`Unknown suite(s): ${unknown.join(', ')}. Available: ${SUITES.join(', ')}`);
    process.exit(2);
  }
  const suites = wanted.length ? wanted : SUITES;
  if (!fs.existsSync(path.join(BACKEND, 'dist', 'main.js'))) {
    console.error('dist/main.js not found: run "npm run build" first.');
    process.exit(2);
  }
  if (!(await portIsFree(PORT))) {
    console.error(`Port ${PORT} is in use. Stop that process or set E2E_PORT to a free port.`);
    process.exit(2);
  }
  const dbName = await resetDatabase();

  // Base: .env.example, so a developer's .env (real SMTP, other settings) never applies.
  const env = {
    ...process.env,
    ...parseEnvFile(path.join(BACKEND, '.env.example')),
    NODE_ENV: 'development',
    IGNORE_ENV_FILE: 'true',
    PORT,
    E2E_PORT: PORT,
    MONGODB_URI,
    E2E_MONGODB_URI: MONGODB_URI,
    CORS_ORIGIN: 'http://localhost:5173',
    JWT_ACCESS_SECRET: crypto.randomBytes(48).toString('base64'),
    VERIFICATION_TOKEN_SECRET: crypto.randomBytes(48).toString('base64'),
    MAIL_TRANSPORT: 'outbox',
    SMTP_HOST: '',
    SMTP_USER: '',
    SMTP_PASSWORD: '',
    BOOTSTRAP_ADMIN_ENABLED: 'false',
    VIRUS_SCAN_ENABLED: 'false',
    METRICS_TOKEN: '',
    LOG_FILE_ENABLED: 'false',
    SWAGGER_ENABLED: 'true',
  };
  for (const key of ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD']) delete env[key];

  console.log(`E2E: ${suites.length} suite(s), port ${PORT}, database ${dbName}\n`);
  const results = [];
  const started = Date.now();
  for (const suite of suites) {
    const t0 = Date.now();
    const run = await runSuite(suite, env);
    // A suite that crashed may leave its app running: free the port for the next one.
    killPortListeners(PORT);
    const output = run.output;
    const passed = (output.match(/^\s+PASS /gm) ?? []).length;
    const failed = (output.match(/^\s+FAIL /gm) ?? []).length;
    const ok = run.status === 0 && failed === 0;
    results.push({ suite, ok, passed, failed, seconds: Math.round((Date.now() - t0) / 1000) });
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${suite.padEnd(10)} ${String(passed).padStart(4)} passed  ${String(failed).padStart(3)} failed  ${results.at(-1).seconds}s`);
    if (!ok || process.argv.includes('--verbose')) {
      const lines = output.split(/\r?\n/).filter((l) => !/^\s+PASS /.test(l));
      console.log(lines.slice(-40).map((l) => `      ${l}`).join('\n'));
    }
  }
  const total = results.reduce((n, r) => n + r.passed, 0);
  const failedSuites = results.filter((r) => !r.ok);
  console.log(`\n${failedSuites.length === 0 ? 'ALL PASSED' : `${failedSuites.length} SUITE(S) FAILED: ${failedSuites.map((r) => r.suite).join(', ')}`} — ${total} checks, ${Math.round((Date.now() - started) / 1000)}s`);
  process.exit(failedSuites.length === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(2);
});
