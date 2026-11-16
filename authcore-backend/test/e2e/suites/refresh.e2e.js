// End-to-end tests for POST /api/v1/auth/refresh.
// Run with: npm run test:e2e -- refresh   (see test/e2e/README.md)
const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const backend = process.argv[2] || path.resolve(__dirname, '..', '..', '..');
const req = (m) => require(path.join(backend, 'node_modules', m));
const mongoose = req('mongoose');
const jwt = req('jsonwebtoken');
const BASE = `http://localhost:${process.env.E2E_PORT || 3000}/api/v1`;
const ORIGIN = 'http://localhost:5173';
const PW = 'Str0ng!Passw0rd';
let ipN = 0;
let failures = 0;
const logs = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sha256 = (v) => crypto.createHash('sha256').update(v).digest('hex');
const check = (label, ok, detail = '') => {
  if (!ok) failures++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail !== '' ? `  -> ${detail}` : ''}`);
};

async function call(route, { body, cookie, origin = ORIGIN, referer, ip } = {}) {
  ipN++;
  const headers = { 'Content-Type': 'application/json', 'X-Forwarded-For': ip ?? `10.70.${Math.floor(ipN / 250)}.${ipN % 250}`, 'User-Agent': 'refresh-test' };
  if (cookie) headers.Cookie = `authcore_refresh=${cookie}`;
  if (origin) headers.Origin = origin;
  if (referer) headers.Referer = referer;
  const res = await fetch(BASE + route, { method: 'POST', headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const setCookie = res.headers.get('set-cookie') ?? '';
  const token = (setCookie.match(/^authcore_refresh=([^;]*)/) || [])[1];
  return { status: res.status, body: await res.json(), setCookie, token };
}
const refresh = (opts) => call('/auth/refresh', opts);
const cleared = (r) => /^authcore_refresh=;/.test(r.setCookie) && /Expires=Thu, 01 Jan 1970/.test(r.setCookie);

async function startApp(env = {}) {
  const child = spawn(process.execPath, ['dist/main.js'], {
    cwd: backend,
    env: { ...process.env, TRUST_PROXY_HOPS: '1', LOG_FORMAT: 'json', LOG_LEVEL: 'debug', MAIL_TRANSPORT: 'outbox',
      MAIL_OUTBOX_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'rt-outbox-')), REGISTRATION_EMAIL_VERIFICATION: 'none',
      REGISTRATION_REQUIRE_APPROVAL: 'false', REFRESH_TOKEN_REUSE_GRACE_SECONDS: '2', ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (d) => logs.push(String(d)));
  child.stderr.on('data', (d) => logs.push(String(d)));
  for (let i = 0; i < 80; i++) {
    try { if ((await fetch(BASE + '/health/live')).ok) return child; } catch {}
    await sleep(250);
  }
  child.kill();
  throw new Error('app did not start:\n' + logs.join('').slice(-2000));
}
const stop = async (child) => { child.kill(); await sleep(600); };
const sessions = () => mongoose.connection.db.collection('sessions');
const users = () => mongoose.connection.db.collection('users');
const register = (tag) => call('/auth/register', { body: { email: `test-refresh-${tag}@example.com`, password: PW, firstName: 'Rae' } });
const login = (tag, extra = {}) => call('/auth/login', { body: { email: `test-refresh-${tag}@example.com`, password: PW, ...extra } });

async function main() {
  await mongoose.connect((process.env.E2E_MONGODB_URI || 'mongodb://localhost:27017/authcore_e2e'));
  const secret = process.env.JWT_ACCESS_SECRET || fs.readFileSync(path.join(backend, '.env'), 'utf8').match(/^JWT_ACCESS_SECRET=(.+)$/m)[1].trim();
  let app = await startApp();

  console.log('\n1. Rotation');
  await register('main');
  const l = await login('main');
  const c0 = l.token;
  const claims0 = jwt.decode(l.body.data.accessToken);
  const s0 = await sessions().findOne({ _id: claims0.sid });
  await sleep(50);
  let r = await refresh({ cookie: c0 });
  const c1 = r.token;
  check('200 "Session refreshed" with a new access token', r.status === 200 && r.body.message === 'Session refreshed' && r.body.data.accessToken !== l.body.data.accessToken);
  check('new refresh cookie (different token), same cookie flags', !!c1 && c1 !== c0 && /HttpOnly/.test(r.setCookie) && /Secure/.test(r.setCookie) && /SameSite=Strict/.test(r.setCookie) && /Path=\/api\/v1\/auth/.test(r.setCookie));
  check('no refresh token in JSON (cookie delivery)', r.body.data.refreshToken === undefined);
  const claims1 = jwt.verify(r.body.data.accessToken, secret, { algorithms: ['HS256'], issuer: 'authcore', audience: 'authcore-api' });
  check('access token: same user + session, new jti', claims1.sub === claims0.sub && claims1.sid === claims0.sid && claims1.jti !== claims0.jti);
  check('user returned, no password hash', r.body.data.user.id === claims0.sub && !JSON.stringify(r.body).includes('passwordHash'));
  let s = await sessions().findOne({ _id: claims0.sid });
  check('DB: current hash = new token, previous = old token, history has old', s.refreshTokenHash === sha256(c1) && s.previousRefreshTokenHash === sha256(c0) && s.rotatedTokenHashes.includes(sha256(c0)) && s.rotationCount === 1);
  check('session expiry NOT extended; lastUsedAt updated', s.expiresAt.getTime() === s0.expiresAt.getTime() && s.lastUsedAt > s0.lastUsedAt && s.lastIpAddress);
  check('raw tokens never stored', !JSON.stringify(s).includes(c0) && !JSON.stringify(s).includes(c1));

  console.log('\n2. CSRF origin check (cookie)');
  r = await refresh({ cookie: c1, origin: null });
  check('no Origin / Referer → 403 AUTH_INVALID_ORIGIN', r.status === 403 && r.body.code === 'AUTH_INVALID_ORIGIN');
  check('cookie kept, token not consumed', r.setCookie === '' && (await sessions().findOne({ _id: claims0.sid })).refreshTokenHash === sha256(c1));
  r = await refresh({ cookie: c1, origin: 'https://evil.example' });
  check('foreign Origin → 403 AUTH_INVALID_ORIGIN', r.status === 403 && r.body.code === 'AUTH_INVALID_ORIGIN');
  r = await refresh({ cookie: c1, origin: null, referer: `${ORIGIN}/dashboard?x=1` });
  check('no Origin but allowed Referer → 200 (rotates)', r.status === 200 && !!r.token);
  const c2 = r.token;

  console.log('\n3. Parallel refreshes (grace window)');
  const [p1, p2] = await Promise.all([refresh({ cookie: c2 }), refresh({ cookie: c2 })]);
  const rotatedOne = [p1, p2].filter((x) => x.token);
  check('both requests 200', p1.status === 200 && p2.status === 200, `${p1.status}/${p2.status}`);
  check('exactly one rotated (sets a cookie), the other kept the cookie', rotatedOne.length === 1, `${p1.setCookie ? 'cookie' : '-'} / ${p2.setCookie ? 'cookie' : '-'}`);
  const c3 = rotatedOne[0]?.token;
  check('session still active', (await sessions().findOne({ _id: claims0.sid })).revokedAt === null);

  console.log('\n4. Reuse detection');
  await sleep(2300);
  r = await refresh({ cookie: c2 });
  check('old token after grace → 401 AUTH_REFRESH_TOKEN_REUSED', r.status === 401 && r.body.code === 'AUTH_REFRESH_TOKEN_REUSED', r.body.code);
  check('cookie cleared', cleared(r), r.setCookie.slice(0, 80));
  s = await sessions().findOne({ _id: claims0.sid });
  check('whole session family revoked (token_reuse)', s.revokedAt instanceof Date && s.revokedReason === 'token_reuse');
  r = await refresh({ cookie: c3 });
  check('even the newest token no longer works → 401 AUTH_INVALID_REFRESH_TOKEN', r.status === 401 && r.body.code === 'AUTH_INVALID_REFRESH_TOKEN');
  r = await refresh({ cookie: c0 });
  check('first token (older history) → reuse response', r.status === 401 && r.body.code === 'AUTH_REFRESH_TOKEN_REUSED');

  console.log('\n5. Invalid / missing tokens');
  r = await refresh({});
  check('no cookie, no body → 401 AUTH_INVALID_REFRESH_TOKEN', r.status === 401 && r.body.code === 'AUTH_INVALID_REFRESH_TOKEN');
  r = await refresh({ cookie: 'x'.repeat(43) });
  check('unknown token → 401 + cookie cleared', r.status === 401 && cleared(r));
  r = await refresh({ body: { refreshToken: 'bad' } });
  check('malformed body token → 400', r.status === 400);
  r = await refresh({ body: { refreshToken: 'y'.repeat(43) } });
  check('body token ignored in cookie-only mode → 401', r.status === 401 && r.body.code === 'AUTH_INVALID_REFRESH_TOKEN');

  console.log('\n6. Session and account checks');
  let lx = await login('main');
  await sessions().updateOne({ _id: jwt.decode(lx.body.data.accessToken).sid }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
  r = await refresh({ cookie: lx.token });
  check('expired session → 401 AUTH_INVALID_REFRESH_TOKEN', r.status === 401 && r.body.code === 'AUTH_INVALID_REFRESH_TOKEN');
  lx = await login('main');
  const sidX = jwt.decode(lx.body.data.accessToken).sid;
  await sessions().updateOne({ _id: sidX }, { $set: { revokedAt: new Date(), revokedReason: 'logout' } });
  r = await refresh({ cookie: lx.token });
  check('revoked session → 401', r.status === 401 && r.body.code === 'AUTH_INVALID_REFRESH_TOKEN');
  await register('susp');
  const ls = await login('susp');
  await users().updateOne({ email: 'test-refresh-susp@example.com' }, { $set: { status: 'SUSPENDED' } });
  r = await refresh({ cookie: ls.token });
  const sidS = jwt.decode(ls.body.data.accessToken).sid;
  s = await sessions().findOne({ _id: sidS });
  check('user suspended meanwhile → 403 AUTH_ACCOUNT_SUSPENDED, cookie cleared', r.status === 403 && r.body.code === 'AUTH_ACCOUNT_SUSPENDED' && cleared(r));
  check('…and the session is revoked (account_status)', s.revokedReason === 'account_status');
  await register('del');
  const ld = await login('del');
  await users().updateOne({ email: 'test-refresh-del@example.com' }, { $set: { deletedAt: new Date() } });
  r = await refresh({ cookie: ld.token });
  check('user deleted meanwhile → 401, session revoked', r.status === 401 && (await sessions().findOne({ _id: jwt.decode(ld.body.data.accessToken).sid })).revokedReason === 'user_deleted');

  console.log('\n7. Remember me');
  const lr = await login('main', { rememberMe: true });
  const sr = await sessions().findOne({ _id: jwt.decode(lr.body.data.accessToken).sid });
  r = await refresh({ cookie: lr.token });
  const exp = (r.setCookie.match(/Expires=([^;]+)/) || [])[1];
  check('persistent cookie keeps the original session expiry', !!exp && Math.abs(new Date(exp).getTime() - sr.expiresAt.getTime()) < 1000, exp);
  lx = await login('main');
  r = await refresh({ cookie: lx.token });
  check('non-persistent session → browser-session cookie (no Expires)', r.status === 200 && !/Expires=/.test(r.setCookie));
  await stop(app);

  console.log('\n8. Body delivery (mobile)');
  app = await startApp({ REFRESH_TOKEN_DELIVERY: 'body' });
  const lb = await login('main');
  const b0 = lb.body.data.refreshToken;
  r = await refresh({ body: { refreshToken: b0 }, origin: null });
  const b1 = r.body.data?.refreshToken;
  const sb = await sessions().findOne({ _id: jwt.decode(lb.body.data.accessToken).sid });
  check('body token, no Origin needed → 200 with new refreshToken in JSON', r.status === 200 && typeof b1 === 'string' && b1 !== b0 && r.setCookie === '');
  check('refreshTokenExpiresAt = unchanged session expiry', new Date(r.body.data.refreshTokenExpiresAt).getTime() === sb.expiresAt.getTime());
  r = await refresh({ body: { refreshToken: b1 }, origin: null });
  const b2 = r.body.data?.refreshToken;
  check('chain continues with the newest token', r.status === 200 && !!b2);
  await sleep(2300);
  r = await refresh({ body: { refreshToken: b0 }, origin: null });
  check('old body token → 401 reuse, family revoked', r.status === 401 && r.body.code === 'AUTH_REFRESH_TOKEN_REUSED');
  r = await refresh({ cookie: b2, origin: ORIGIN });
  check('cookie ignored in body-only mode → 401', r.status === 401);
  await stop(app);

  console.log('\n9. Rate limit');
  app = await startApp();
  const codes = [];
  for (let i = 0; i < 31; i++) codes.push((await refresh({ ip: '10.88.88.88' })).status);
  check('31st refresh from one IP → 429', codes[30] === 429 && codes.slice(0, 30).every((c) => c === 401), `${codes.slice(28).join(',')}`);
  await stop(app);

  console.log('\n10. Logs');
  const all = logs.join('');
  const entries = all.split('\n').filter((x) => x.startsWith('{')).map((x) => { try { return JSON.parse(x); } catch { return null; } }).filter(Boolean);
  check('no refresh or access tokens in logs', ![c0, c1, c2, c3, b0, b1].some((t) => t && all.includes(t)) && !/eyJ[A-Za-z0-9_-]{10,}\.eyJ/.test(all));
  const reuse = entries.find((e) => e.message === 'Refresh token reuse detected: token family revoked');
  check('reuse logged as warn with userId, sessionId, family, ip', !!reuse && reuse.level === 'warn' && reuse.userId && reuse.sessionId && reuse.tokenFamilyId && reuse.ipAddress);
  check('origin refusal + account refusal logged', entries.some((e) => e.message === 'Refresh refused: untrusted or missing origin') && entries.some((e) => e.message === 'Refresh refused: account cannot sign in; session revoked'));
  check('rotation logged at debug', entries.some((e) => e.message === 'Session refreshed (token rotated)' && e.level === 'debug') && entries.some((e) => e.message === 'Session refreshed within grace period (no rotation)'));

  const ids = (await users().find({ email: /^test-refresh-/ }, { projection: { _id: 1 } }).toArray()).map((x) => x._id);
  const ds = await sessions().deleteMany({ userId: { $in: ids } });
  await mongoose.connection.db.collection('login_attempts').deleteMany({ key: { $in: ids.map((i) => `user:${i}`) } });
  const du = await users().deleteMany({ email: /^test-refresh-/ });
  console.log(`\nCleanup: ${du.deletedCount} users, ${ds.deletedCount} sessions`);
  await mongoose.disconnect();
  console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch(async (e) => { console.error(e); await mongoose.disconnect().catch(() => {}); process.exitCode = 1; });
