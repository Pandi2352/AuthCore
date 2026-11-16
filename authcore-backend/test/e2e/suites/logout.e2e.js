// End-to-end tests for POST /auth/logout and /auth/logout-all.
// Run with: npm run test:e2e -- logout   (see test/e2e/README.md)
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const backend = process.argv[2] || path.resolve(__dirname, '..', '..', '..');
const req = (m) => require(path.join(backend, 'node_modules', m));
const mongoose = req('mongoose');
const jwt = req('jsonwebtoken');
const BASE = `http://localhost:${process.env.E2E_PORT || 3000}/api/v1`;
const PW = 'Str0ng!Passw0rd';
let failures = 0;
let ipN = 0;
const logs = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (label, ok, detail = '') => {
  if (!ok) failures++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail !== '' ? `  -> ${detail}` : ''}`);
};

async function call(method, route, { body, token, cookie } = {}) {
  ipN++;
  const headers = { 'X-Forwarded-For': `10.90.${Math.floor(ipN / 250)}.${ipN % 250}`, Origin: 'http://localhost:5173' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  if (cookie) headers.Cookie = `authcore_refresh=${cookie}`;
  const res = await fetch(BASE + route, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, body: await res.json(), setCookie: res.headers.get('set-cookie') ?? '' };
}
const cleared = (r) => /^authcore_refresh=;/.test(r.setCookie) && /Expires=Thu, 01 Jan 1970/.test(r.setCookie);

async function startApp(env = {}) {
  const child = spawn(process.execPath, ['dist/main.js'], {
    cwd: backend,
    env: { ...process.env, TRUST_PROXY_HOPS: '1', LOG_FORMAT: 'json', MAIL_TRANSPORT: 'outbox',
      MAIL_OUTBOX_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'lo-outbox-')), REGISTRATION_EMAIL_VERIFICATION: 'none',
      REGISTRATION_REQUIRE_APPROVAL: 'false', ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (d) => logs.push(String(d)));
  child.stderr.on('data', (d) => logs.push(String(d)));
  for (let i = 0; i < 80; i++) { try { if ((await fetch(BASE + '/health/live')).ok) return child; } catch {} await sleep(250); }
  throw new Error('app did not start');
}

async function main() {
  await mongoose.connect((process.env.E2E_MONGODB_URI || 'mongodb://localhost:27017/authcore_e2e'));
  const sessions = () => mongoose.connection.db.collection('sessions');
  const users = () => mongoose.connection.db.collection('users');
  let app = await startApp();

  const register = (tag) => call('POST', '/auth/register', { body: { email: `test-logout-${tag}@example.com`, password: PW, firstName: 'Leo' } });
  const login = async (tag) => {
    const r = await call('POST', '/auth/login', { body: { email: `test-logout-${tag}@example.com`, password: PW } });
    return { at: r.body.data.accessToken, cookie: (r.setCookie.match(/^authcore_refresh=([^;]*)/) || [])[1], sid: jwt.decode(r.body.data.accessToken).sid };
  };
  const me = (d) => call('GET', '/auth/me', { token: d.at });
  const refresh = (d) => call('POST', '/auth/refresh', { cookie: d.cookie });
  await register('a');
  await register('b');

  console.log('\n1. Logout (current device)');
  const d1 = await login('a');
  const d2 = await login('a');
  const d3 = await login('a');
  const other = await login('b');
  let r = await call('POST', '/auth/logout', { token: d1.at });
  check('200 "Signed out", data null', r.status === 200 && r.body.message === 'Signed out' && r.body.data === null);
  check('refresh cookie cleared', cleared(r), r.setCookie.slice(0, 60));
  const s1 = await sessions().findOne({ _id: d1.sid });
  check('session revoked with reason "logout"', s1.revokedAt instanceof Date && s1.revokedReason === 'logout');
  r = await me(d1);
  check('its access token rejected immediately → 401 AUTH_SESSION_REVOKED', r.status === 401 && r.body.code === 'AUTH_SESSION_REVOKED');
  r = await refresh(d1);
  check('its refresh token no longer works → 401', r.status === 401 && r.body.code === 'AUTH_INVALID_REFRESH_TOKEN');
  check('other devices of the same user still signed in', (await me(d2)).status === 200 && (await me(d3)).status === 200);
  r = await call('POST', '/auth/logout', { token: d1.at });
  check('logout again with the same token → 401 (already signed out)', r.status === 401 && r.body.code === 'AUTH_SESSION_REVOKED');
  r = await call('POST', '/auth/logout', {});
  check('logout without a token → 401 AUTH_ACCESS_TOKEN_MISSING', r.status === 401 && r.body.code === 'AUTH_ACCESS_TOKEN_MISSING');
  r = await call('POST', '/auth/logout', { cookie: d2.cookie });
  check('refresh cookie alone is not enough (no CSRF logout) → 401', r.status === 401 && (await me(d2)).status === 200);

  console.log('\n2. Logout from all OTHER devices (keepCurrentSession)');
  r = await call('POST', '/auth/logout-all', { token: d2.at, body: { keepCurrentSession: true } });
  check('200, revokedSessionCount 1 (d3), isCurrentSessionKept true', r.status === 200 && r.body.data.revokedSessionCount === 1 && r.body.data.isCurrentSessionKept === true, JSON.stringify(r.body.data));
  check('cookie NOT cleared (still signed in here)', r.setCookie === '');
  check('current device still works', (await me(d2)).status === 200);
  check('other device signed out (reason logout_others)', (await me(d3)).status === 401 && (await sessions().findOne({ _id: d3.sid })).revokedReason === 'logout_others');

  console.log('\n3. Logout from ALL devices');
  const d4 = await login('a');
  const d5 = await login('a');
  r = await call('POST', '/auth/logout-all', { token: d4.at });
  check('no body → everything incl. current: revokedSessionCount 3 (d2, d4, d5)', r.status === 200 && r.body.data.revokedSessionCount === 3 && r.body.data.isCurrentSessionKept === false, JSON.stringify(r.body.data));
  check('cookie cleared', cleared(r));
  const results = await Promise.all([me(d2), me(d4), me(d5), refresh(d4), refresh(d5)]);
  check('all access and refresh tokens of the user rejected', results.every((x) => x.status === 401), results.map((x) => x.status).join(','));
  check('no active sessions left for the user', (await sessions().countDocuments({ userId: jwt.decode(d4.at).sub, revokedAt: null })) === 0);
  check("other user's session untouched", (await me(other)).status === 200);
  r = await call('POST', '/auth/logout-all', { token: d4.at });
  check('logout-all again with a revoked session → 401', r.status === 401);

  console.log('\n4. Validation');
  const d6 = await login('a');
  r = await call('POST', '/auth/logout-all', { token: d6.at, body: { keepCurrentSession: 'yes' } });
  check('keepCurrentSession must be boolean → 400', r.status === 400 && r.body.errors[0].field === 'keepCurrentSession');
  r = await call('POST', '/auth/logout-all', { token: d6.at, body: { userId: 'someone-else' } });
  check('unexpected field (e.g. userId) → 400', r.status === 400);
  check('…and nothing was revoked', (await me(d6)).status === 200);
  r = await call('POST', '/auth/logout-all', { token: other.at, body: { keepCurrentSession: false } });
  check("a user can only sign out their own sessions (b: count 1, a's d6 untouched)", r.body.data.revokedSessionCount === 1 && (await me(d6)).status === 200);
  app.kill();
  await sleep(600);

  console.log('\n5. Body delivery (mobile): no cookie involved');
  app = await startApp({ REFRESH_TOKEN_DELIVERY: 'body' });
  const lb = await call('POST', '/auth/login', { body: { email: 'test-logout-a@example.com', password: PW } });
  r = await call('POST', '/auth/logout', { token: lb.body.data.accessToken });
  check('logout → 200, no Set-Cookie', r.status === 200 && r.setCookie === '');
  r = await call('POST', '/auth/refresh', { body: { refreshToken: lb.body.data.refreshToken } });
  check('body refresh token no longer works → 401', r.status === 401);
  app.kill();
  await sleep(600);

  console.log('\n6. Logs');
  const all = logs.join('');
  const entries = all.split('\n').filter((x) => x.startsWith('{')).map((x) => { try { return JSON.parse(x); } catch { return null; } }).filter(Boolean);
  check('Logout / all / all-other events logged with userId, sessionId, ip', ['Logout', 'Logout from all devices', 'Logout from all other devices'].every((m) => entries.some((e) => e.message === m && e.userId && e.sessionId && e.ipAddress)));
  check('no tokens in logs', !/eyJ[A-Za-z0-9_-]{10,}\.eyJ/.test(all) && ![d1, d2, d3, d4].some((d) => all.includes(d.cookie)));

  const ids = (await users().find({ email: /^test-logout-/ }, { projection: { _id: 1 } }).toArray()).map((x) => x._id);
  const ds = await sessions().deleteMany({ userId: { $in: ids } });
  await mongoose.connection.db.collection('login_attempts').deleteMany({ key: { $in: ids.map((i) => `user:${i}`) } });
  const du = await users().deleteMany({ email: /^test-logout-/ });
  console.log(`\nCleanup: ${du.deletedCount} users, ${ds.deletedCount} sessions`);
  await mongoose.disconnect();
  console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch(async (e) => { console.error(e); await mongoose.disconnect().catch(() => {}); process.exitCode = 1; });
