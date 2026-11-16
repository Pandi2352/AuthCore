// End-to-end tests for /auth/sessions (list / get / revoke).
// Run with: npm run test:e2e -- sessions   (see test/e2e/README.md)
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
const UA = {
  chrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
  firefox: 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0',
};
let failures = 0;
const logs = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (label, ok, detail = '') => {
  if (!ok) failures++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail !== '' ? `  -> ${detail}` : ''}`);
};

async function call(method, route, { body, token, cookie, ua = UA.chrome, ip = '10.95.0.1' } = {}) {
  const headers = { 'X-Forwarded-For': ip, Origin: 'http://localhost:5173', 'User-Agent': ua };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  if (cookie) headers.Cookie = `authcore_refresh=${cookie}`;
  const res = await fetch(BASE + route, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, headers: res.headers, body: await res.json(), setCookie: res.headers.get('set-cookie') ?? '' };
}
const cleared = (r) => /^authcore_refresh=;/.test(r.setCookie) && /Expires=Thu, 01 Jan 1970/.test(r.setCookie);

async function main() {
  await mongoose.connect((process.env.E2E_MONGODB_URI || 'mongodb://localhost:27017/authcore_e2e'));
  const sessions = () => mongoose.connection.db.collection('sessions');
  const users = () => mongoose.connection.db.collection('users');
  const child = spawn(process.execPath, ['dist/main.js'], {
    cwd: backend,
    env: { ...process.env, TRUST_PROXY_HOPS: '1', LOG_FORMAT: 'json', MAIL_TRANSPORT: 'outbox',
      MAIL_OUTBOX_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'ss-outbox-')), REGISTRATION_EMAIL_VERIFICATION: 'none',
      REGISTRATION_REQUIRE_APPROVAL: 'false' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (d) => logs.push(String(d)));
  child.stderr.on('data', (d) => logs.push(String(d)));
  for (let i = 0; i < 80; i++) { try { if ((await fetch(BASE + '/health/live')).ok) break; } catch {} await sleep(250); }

  const register = (tag) => call('POST', '/auth/register', { body: { email: `test-sess-${tag}@example.com`, password: PW, firstName: 'Sam' } });
  const login = async (tag, ua, ip, rememberMe = false) => {
    const r = await call('POST', '/auth/login', { body: { email: `test-sess-${tag}@example.com`, password: PW, rememberMe }, ua, ip });
    return { at: r.body.data.accessToken, cookie: (r.setCookie.match(/^authcore_refresh=([^;]*)/) || [])[1], sid: jwt.decode(r.body.data.accessToken).sid };
  };
  await register('a');
  await register('b');
  const laptop = await login('a', UA.chrome, '203.0.113.10');
  await sleep(30);
  const phone = await login('a', UA.iphone, '198.51.100.7', true);
  await sleep(30);
  const linux = await login('a', UA.firefox, '192.0.2.44');
  const other = await login('b', UA.chrome, '203.0.113.99');
  await sleep(30);
  await call('POST', '/auth/refresh', { cookie: laptop.cookie, ip: '203.0.113.11' }); // laptop most recently used

  console.log('\n1. List my sessions');
  let r = await call('GET', '/auth/sessions', { token: phone.at });
  const list = r.body.data;
  check('200 "Active sessions", 3 sessions', r.status === 200 && r.body.message === 'Active sessions' && list.length === 3, list?.length);
  check('only my sessions (not user b)', !list.some((s) => s.id === other.sid));
  check('sorted by lastUsedAt desc (refreshed laptop first)', list[0].id === laptop.sid && new Date(list[0].lastUsedAt) >= new Date(list[1].lastUsedAt) && new Date(list[1].lastUsedAt) >= new Date(list[2].lastUsedAt));
  const cur = list.filter((s) => s.isCurrent);
  check('exactly one isCurrent = the calling device (phone)', cur.length === 1 && cur[0].id === phone.sid);
  const p = list.find((s) => s.id === phone.sid);
  const l = list.find((s) => s.id === laptop.sid);
  check('device details parsed (iPhone Safari, mobile, persistent)', p.deviceName === 'Safari 18 on iOS 18.1' && p.deviceType === 'mobile' && p.isPersistent === true, p.deviceName);
  check('sign-in IP and last refresh IP', l.ipAddress === '203.0.113.10' && l.lastIpAddress === '203.0.113.11' && p.lastIpAddress === null);
  check('signedInAt, lastUsedAt, expiresAt present', !!l.signedInAt && !!l.lastUsedAt && !!l.expiresAt);
  check('no internal fields (hashes, family id, userId, raw user agent)', !JSON.stringify(list).match(/refreshTokenHash|rotatedTokenHashes|tokenFamilyId|userId|previousRefreshTokenHash|Mozilla/));
  check('Cache-Control: no-store', r.headers.get('cache-control') === 'no-store');
  check('without token → 401', (await call('GET', '/auth/sessions')).status === 401);

  console.log('\n2. Get one session');
  r = await call('GET', `/auth/sessions/${linux.sid}`, { token: phone.at });
  check('my other session → 200 with details, isCurrent false', r.status === 200 && r.body.data.id === linux.sid && r.body.data.isCurrent === false && r.body.data.browser === 'Firefox 132');
  r = await call('GET', `/auth/sessions/${other.sid}`, { token: phone.at });
  check("another user's session → 404 (not 403)", r.status === 404 && r.body.message === 'Session not found');
  r = await call('GET', '/auth/sessions/not-a-uuid', { token: phone.at });
  check('invalid id → 400 INVALID_ID', r.status === 400 && r.body.code === 'INVALID_ID');
  r = await call('GET', `/auth/sessions/${laptop.sid.toUpperCase()}`, { token: phone.at });
  check('uppercase UUID accepted (normalized)', r.status === 200);

  console.log('\n3. Revoke another device');
  r = await call('DELETE', `/auth/sessions/${linux.sid}`, { token: phone.at });
  check('200 "Session signed out", isCurrentSession false', r.status === 200 && r.body.message === 'Session signed out' && r.body.data.revokedSessionId === linux.sid && r.body.data.isCurrentSession === false);
  check('cookie of the caller NOT cleared', r.setCookie === '');
  check('revoked device: access token rejected immediately', (await call('GET', '/auth/me', { token: linux.at })).status === 401);
  check('revoked device: refresh token rejected', (await call('POST', '/auth/refresh', { cookie: linux.cookie })).status === 401);
  check('DB reason "revoked_by_user"', (await sessions().findOne({ _id: linux.sid })).revokedReason === 'revoked_by_user');
  check('caller still signed in; list now has 2', (await call('GET', '/auth/sessions', { token: phone.at })).body.data.length === 2);
  r = await call('DELETE', `/auth/sessions/${linux.sid}`, { token: phone.at });
  check('revoke the same session again → 404', r.status === 404);
  r = await call('GET', `/auth/sessions/${linux.sid}`, { token: phone.at });
  check('revoked session no longer returned by GET → 404', r.status === 404);
  r = await call('DELETE', `/auth/sessions/${other.sid}`, { token: phone.at });
  check("revoke another user's session → 404, and it stays active", r.status === 404 && (await call('GET', '/auth/me', { token: other.at })).status === 200);
  r = await call('DELETE', '/auth/sessions/xyz', { token: phone.at });
  check('invalid id → 400', r.status === 400);

  console.log('\n4. Revoke my current session (= logout)');
  r = await call('DELETE', `/auth/sessions/${phone.sid}`, { token: phone.at });
  check('200, isCurrentSession true', r.status === 200 && r.body.data.isCurrentSession === true);
  check('refresh cookie cleared', cleared(r));
  check('own access token now rejected', (await call('GET', '/auth/sessions', { token: phone.at })).status === 401);
  check('DB reason "logout"', (await sessions().findOne({ _id: phone.sid })).revokedReason === 'logout');
  check('laptop still active', (await call('GET', '/auth/me', { token: laptop.at })).status === 200);

  console.log('\n5. Swagger');
  const doc = await (await fetch(`http://localhost:${process.env.E2E_PORT || 3000}/api/docs/openapi.json`)).json();
  const ops = ['/api/v1/auth/sessions', '/api/v1/auth/sessions/{sessionId}'];
  check('3 operations documented with bearer security under tag Sessions', !!doc.paths[ops[0]]?.get && !!doc.paths[ops[1]]?.get && !!doc.paths[ops[1]]?.delete && [doc.paths[ops[0]].get, doc.paths[ops[1]].get, doc.paths[ops[1]].delete].every((o) => o.tags[0] === 'Sessions' && JSON.stringify(o.security) === '[{"access-token":[]}]'));

  child.kill();
  await sleep(600);
  const entries = logs.join('').split('\n').filter((x) => x.startsWith('{')).map((x) => { try { return JSON.parse(x); } catch { return null; } }).filter(Boolean);
  const ev = entries.filter((e) => e.message === 'Session revoked by user');
  check('revocations logged (userId, sessionId, revokedSessionId, isCurrentSession, ip)', ev.length === 2 && ev.every((e) => e.userId && e.sessionId && e.revokedSessionId && typeof e.isCurrentSession === 'boolean' && e.ipAddress));
  check('no tokens in logs', !/eyJ[A-Za-z0-9_-]{10,}\.eyJ/.test(logs.join('')));

  const ids = (await users().find({ email: /^test-sess-/ }, { projection: { _id: 1 } }).toArray()).map((x) => x._id);
  const ds = await sessions().deleteMany({ userId: { $in: ids } });
  await mongoose.connection.db.collection('login_attempts').deleteMany({ key: { $in: ids.map((i) => `user:${i}`) } });
  const du = await users().deleteMany({ email: /^test-sess-/ });
  console.log(`\nCleanup: ${du.deletedCount} users, ${ds.deletedCount} sessions`);
  await mongoose.disconnect();
  console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch(async (e) => { console.error(e); await mongoose.disconnect().catch(() => {}); process.exitCode = 1; });
