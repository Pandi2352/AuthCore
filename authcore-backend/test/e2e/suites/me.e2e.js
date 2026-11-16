// End-to-end tests for the auth guard and GET /api/v1/auth/me.
// Run with: npm run test:e2e -- me   (see test/e2e/README.md)
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

async function call(method, route, { body, auth, cookie, origin = 'http://localhost:5173' } = {}) {
  ipN++;
  const headers = { 'X-Forwarded-For': `10.80.${Math.floor(ipN / 250)}.${ipN % 250}` };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth !== undefined) headers.Authorization = auth;
  if (cookie) headers.Cookie = `authcore_refresh=${cookie}`;
  if (origin) headers.Origin = origin;
  const res = await fetch(BASE + route, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const setCookie = res.headers.get('set-cookie') ?? '';
  return { status: res.status, headers: res.headers, body: await res.json(), token: (setCookie.match(/^authcore_refresh=([^;]*)/) || [])[1] };
}
const me = (auth) => call('GET', '/auth/me', { auth });

async function main() {
  await mongoose.connect((process.env.E2E_MONGODB_URI || 'mongodb://localhost:27017/authcore_e2e'));
  const secret = process.env.JWT_ACCESS_SECRET || fs.readFileSync(path.join(backend, '.env'), 'utf8').match(/^JWT_ACCESS_SECRET=(.+)$/m)[1].trim();
  const child = spawn(process.execPath, ['dist/main.js'], {
    cwd: backend,
    env: { ...process.env, TRUST_PROXY_HOPS: '1', LOG_FORMAT: 'json', MAIL_TRANSPORT: 'outbox',
      MAIL_OUTBOX_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'me-outbox-')), REGISTRATION_EMAIL_VERIFICATION: 'none',
      REGISTRATION_REQUIRE_APPROVAL: 'false', REFRESH_TOKEN_REUSE_GRACE_SECONDS: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (d) => logs.push(String(d)));
  child.stderr.on('data', (d) => logs.push(String(d)));
  for (let i = 0; i < 80; i++) { try { if ((await fetch(BASE + '/health/live')).ok) break; } catch {} await sleep(250); }

  const users = () => mongoose.connection.db.collection('users');
  const sessions = () => mongoose.connection.db.collection('sessions');
  const register = (tag) => call('POST', '/auth/register', { body: { email: `test-me-${tag}@example.com`, password: PW, firstName: 'Mia', username: `test_me_${tag}` } });
  const login = (tag) => call('POST', '/auth/login', { body: { email: `test-me-${tag}@example.com`, password: PW } });

  console.log('\n1. Public routes still work without a token');
  check('GET /api/v1 → 200', (await call('GET', '')).status === 200);
  check('GET /health, /health/live, /health/ready → 200', (await Promise.all(['/health', '/health/live', '/health/ready'].map((p) => call('GET', p)))).every((r) => r.status === 200));
  const reg = await register('main');
  check('POST /auth/register → 201', reg.status === 201);
  const lg = await login('main');
  check('POST /auth/login → 200', lg.status === 200);
  check('POST /auth/verify-email/resend reachable (404: verification off)', (await call('POST', '/auth/verify-email/resend', { body: { email: 'x@example.com' } })).status === 404);
  const at = lg.body.data.accessToken;

  console.log('\n2. GET /auth/me');
  let r = await me(`Bearer ${at}`);
  check('valid token → 200 "Current user"', r.status === 200 && r.body.message === 'Current user');
  check('returns the token owner, sanitized', r.body.data.id === lg.body.data.user.id && r.body.data.email === 'test-me-main@example.com' && !JSON.stringify(r.body).includes('passwordHash'));
  check('Cache-Control: no-store', r.headers.get('cache-control') === 'no-store');
  r = await me(`bearer ${at}`);
  check('"bearer" (any case) accepted', r.status === 200);

  console.log('\n3. Missing / malformed / invalid tokens');
  r = await me(undefined);
  check('no Authorization → 401 AUTH_ACCESS_TOKEN_MISSING', r.status === 401 && r.body.code === 'AUTH_ACCESS_TOKEN_MISSING');
  check('WWW-Authenticate: Bearer error="invalid_request"', r.headers.get('www-authenticate') === 'Bearer realm="authcore", error="invalid_request"');
  r = await me('Bearer not-a-jwt');
  check('"Bearer not-a-jwt" → 401 AUTH_ACCESS_TOKEN_INVALID', r.status === 401 && r.body.code === 'AUTH_ACCESS_TOKEN_INVALID' && /invalid_token/.test(r.headers.get('www-authenticate')));
  r = await me('Basic dXNlcjpwYXNz');
  check('Basic auth → 401 AUTH_ACCESS_TOKEN_INVALID', r.status === 401 && r.body.code === 'AUTH_ACCESS_TOKEN_INVALID');
  r = await me(`Bearer ${lg.token}`);
  check('refresh token used as access token → 401 INVALID', r.status === 401 && r.body.code === 'AUTH_ACCESS_TOKEN_INVALID');
  const [h, p, sig] = at.split('.');
  const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(p, 'base64url')), sub: 'someone-else' })).toString('base64url');
  r = await me(`Bearer ${h}.${forged}.${sig}`);
  check('tampered payload → 401 INVALID', r.status === 401 && r.body.code === 'AUTH_ACCESS_TOKEN_INVALID');
  const claims = jwt.decode(at);
  const sign = (payload, opts) => jwt.sign(payload, secret, { algorithm: 'HS256', issuer: 'authcore', audience: 'authcore-api', ...opts });
  r = await me(`Bearer ${sign({ sid: claims.sid, typ: 'access', exp: Math.floor(Date.now() / 1000) - 60 }, { subject: claims.sub, jwtid: 'j1' })}`);
  check('expired token → 401 AUTH_ACCESS_TOKEN_EXPIRED', r.status === 401 && r.body.code === 'AUTH_ACCESS_TOKEN_EXPIRED');
  r = await me(`Bearer ${jwt.sign({ sid: claims.sid, typ: 'access' }, secret, { algorithm: 'HS512', subject: claims.sub, jwtid: 'j2', issuer: 'authcore', audience: 'authcore-api', expiresIn: 60 })}`);
  check('HS512 token → 401 INVALID', r.status === 401 && r.body.code === 'AUTH_ACCESS_TOKEN_INVALID');
  r = await me(`Bearer ${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${p}.`);
  check('alg "none" → 401 (rejected)', r.status === 401);
  r = await me(`Bearer ${sign({ sid: claims.sid, typ: 'access' }, { subject: claims.sub, jwtid: 'j3', expiresIn: 60, audience: 'other-api' })}`);
  check('wrong audience → 401 INVALID', r.status === 401 && r.body.code === 'AUTH_ACCESS_TOKEN_INVALID');
  r = await me(`Bearer ${sign({ sid: 'not-my-session', typ: 'access' }, { subject: claims.sub, jwtid: 'j4', expiresIn: 60 })}`);
  check('valid signature but unknown session → 401 AUTH_SESSION_REVOKED', r.status === 401 && r.body.code === 'AUTH_SESSION_REVOKED');
  await register('other');
  const other = await login('other');
  r = await me(`Bearer ${sign({ sid: jwt.decode(other.body.data.accessToken).sid, typ: 'access' }, { subject: claims.sub, jwtid: 'j5', expiresIn: 60 })}`);
  check("another user's session id → 401 (session must belong to sub)", r.status === 401 && r.body.code === 'AUTH_SESSION_REVOKED');

  console.log('\n4. Immediate revocation');
  const l2 = await login('main');
  const at2 = l2.body.data.accessToken;
  check('second session works', (await me(`Bearer ${at2}`)).status === 200);
  await sessions().updateOne({ _id: jwt.decode(at2).sid }, { $set: { revokedAt: new Date(), revokedReason: 'logout' } });
  r = await me(`Bearer ${at2}`);
  check('session revoked → its unexpired access token stops working at once (401 AUTH_SESSION_REVOKED)', r.status === 401 && r.body.code === 'AUTH_SESSION_REVOKED');
  check('other session of the same user unaffected', (await me(`Bearer ${at}`)).status === 200);
  const l3 = await login('main');
  const c0 = l3.token;
  const rr = await call('POST', '/auth/refresh', { cookie: c0 });
  await sleep(1300);
  await call('POST', '/auth/refresh', { cookie: c0 });
  r = await me(`Bearer ${rr.body.data.accessToken}`);
  check('refresh-token reuse → access token of that session rejected', r.status === 401 && r.body.code === 'AUTH_SESSION_REVOKED');
  await users().updateOne({ email: 'test-me-other@example.com' }, { $set: { status: 'SUSPENDED' } });
  r = await me(`Bearer ${other.body.data.accessToken}`);
  check('user suspended → 403 AUTH_ACCOUNT_SUSPENDED immediately', r.status === 403 && r.body.code === 'AUTH_ACCOUNT_SUSPENDED');
  await users().updateOne({ email: 'test-me-other@example.com' }, { $set: { status: 'ACTIVE', deletedAt: new Date() } });
  r = await me(`Bearer ${other.body.data.accessToken}`);
  check('user deleted → 401 AUTH_SESSION_REVOKED', r.status === 401 && r.body.code === 'AUTH_SESSION_REVOKED');

  console.log('\n5. Swagger');
  const doc = await (await fetch(`http://localhost:${process.env.E2E_PORT || 3000}/api/docs/openapi.json`)).json();
  const meOp = doc.paths['/api/v1/auth/me']?.get;
  check('/auth/me documented with bearer security', !!meOp && JSON.stringify(meOp.security) === JSON.stringify([{ 'access-token': [] }]));
  check('public routes have no security requirement', !doc.paths['/api/v1/auth/login'].post.security && !doc.paths['/api/v1/health'].get.security);

  child.kill();
  await sleep(600);
  const all = logs.join('');
  check('no access tokens in logs', !all.includes(at) && !/eyJ[A-Za-z0-9_-]{10,}\.eyJ/.test(all));

  const ids = (await users().find({ email: /^test-me-/ }, { projection: { _id: 1 } }).toArray()).map((x) => x._id);
  const ds = await sessions().deleteMany({ userId: { $in: ids } });
  await mongoose.connection.db.collection('login_attempts').deleteMany({ key: { $in: ids.map((i) => `user:${i}`) } });
  const du = await users().deleteMany({ email: /^test-me-/ });
  console.log(`\nCleanup: ${du.deletedCount} users, ${ds.deletedCount} sessions`);
  await mongoose.disconnect();
  console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch(async (e) => { console.error(e); await mongoose.disconnect().catch(() => {}); process.exitCode = 1; });
