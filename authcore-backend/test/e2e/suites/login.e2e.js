// End-to-end tests for POST /api/v1/auth/login.
// Run with: npm run test:e2e -- login   (see test/e2e/README.md)
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
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const PW = 'Str0ng!Passw0rd';
let ipCounter = 0;
let failures = 0;
const logs = [];

const check = (label, ok, detail = '') => {
  if (!ok) failures++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail !== '' ? `  -> ${detail}` : ''}`);
};
const nextIp = () => { ipCounter++; return `10.60.${Math.floor(ipCounter / 250)}.${ipCounter % 250}`; };

async function call(route, body, { ip = nextIp(), ua = UA } = {}) {
  const started = process.hrtime.bigint();
  const res = await fetch(BASE + route, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip, 'User-Agent': ua },
    body: JSON.stringify(body),
  });
  const ms = Number(process.hrtime.bigint() - started) / 1e6;
  return { status: res.status, headers: res.headers, body: await res.json(), ms };
}
const login = (body, opts) => call('/auth/login', body, opts);

async function startApp(env = {}) {
  const outbox = fs.mkdtempSync(path.join(os.tmpdir(), 'authcore-outbox-'));
  // Whitespace must be allowed to prove passwords are never trimmed.
  await mongoose.connection.db.collection('password_policies').deleteMany({});
  await mongoose.connection.db.collection('password_policies').insertOne({ key: 'global', policyName: 'login-test', characterLength: { minimum: 8, maximum: 64 }, complexity: { minimumDigitCount: 1, minimumSpecialCharacterCount: 1, requireUpperAndLowerCase: true, minimumUppercaseCount: 0, minimumLowercaseCount: 0 }, passwordHistory: { preventReuse: true, historyCount: 5 }, additionalRules: { blockCommonPasswords: true, blockCompromisedPasswords: false, preventPersonalInfoInPassword: true, allowWhitespace: true, maximumRepeatedCharacters: 0, minimumPasswordAgeHours: 0 }, passwordValidity: { enabled: false, validityDays: 90, notificationDaysBeforeExpiry: [14, 7, 3], gracePeriodDays: 0, forceChangeOnExpiry: true }, version: 1, createdBy: 'login-test', updatedBy: 'login-test', _id: 'login-test-policy', createdAt: new Date(), updatedAt: new Date() });
  const child = spawn(process.execPath, ['dist/main.js'], {
    cwd: backend,
    env: { ...process.env, TRUST_PROXY_HOPS: '1', LOG_FORMAT: 'json', LOG_LEVEL: 'info', MAIL_TRANSPORT: 'outbox', MAIL_OUTBOX_DIR: outbox, LOGIN_MAX_FAILED_ATTEMPTS: '5', LOGIN_MAX_FAILED_ATTEMPTS_PER_ACCOUNT: '12', LOGIN_LOCKOUT_MINUTES: '15',
      REGISTRATION_EMAIL_VERIFICATION: 'none', REGISTRATION_REQUIRE_APPROVAL: 'false', ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (d) => logs.push(String(d)));
  child.stderr.on('data', (d) => logs.push(String(d)));
  for (let i = 0; i < 80; i++) {
    try { if ((await fetch(BASE + '/health/live')).ok) return { child, outbox }; } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  child.kill();
  throw new Error('app did not start:\n' + logs.join('').slice(-3000));
}
const stopApp = async (app) => { app.child.kill(); await new Promise((r) => setTimeout(r, 600)); };
const users = () => mongoose.connection.db.collection('users');
const sessions = () => mongoose.connection.db.collection('sessions');
const register = (tag, extra = {}) => call('/auth/register', { email: `test-login-${tag}@example.com`, password: PW, firstName: 'Lena', ...extra });
const cookieOf = (res) => res.headers.get('set-cookie') ?? '';
const sha256 = (v) => crypto.createHash('sha256').update(v).digest('hex');

async function main() {
  await mongoose.connect((process.env.E2E_MONGODB_URI || 'mongodb://localhost:27017/authcore_e2e'));
  const secret = process.env.JWT_ACCESS_SECRET || fs.readFileSync(path.join(backend, '.env'), 'utf8').match(/^JWT_ACCESS_SECRET=(.+)$/m)[1].trim();

  console.log('\n1. Successful login (email)');
  let app = await startApp();
  await register('main', { username: 'test_login_main' });
  let r = await login({ email: '  TEST-LOGIN-MAIN@Example.com ', password: PW });
  const d = r.body.data ?? {};
  check('200 + message "Login successful"', r.status === 200 && r.body.message === 'Login successful', r.status);
  check('body: user, accessToken, tokenType Bearer, expiresIn 900', !!d.user && !!d.accessToken && d.tokenType === 'Bearer' && d.expiresIn === 900);
  check('no refreshToken in body (cookie delivery)', d.refreshToken === undefined);
  check('no password hash / session internals in response', !JSON.stringify(r.body).match(/passwordHash|argon2|refreshTokenHash|tokenFamilyId/));
  check('Cache-Control: no-store', r.headers.get('cache-control') === 'no-store');
  const cookie = cookieOf(r);
  check('cookie HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth', /^authcore_refresh=[A-Za-z0-9_-]{43};/.test(cookie) && /HttpOnly/.test(cookie) && /Secure/.test(cookie) && /SameSite=Strict/.test(cookie) && /Path=\/api\/v1\/auth/.test(cookie), cookie.replace(/=[A-Za-z0-9_-]{43}/, '=<token>'));
  check('no Expires without rememberMe (browser-session cookie)', !/Expires=/.test(cookie));
  const refreshToken = cookie.match(/^authcore_refresh=([^;]+)/)[1];

  console.log('\n2. Access token (JWT)');
  const [h] = d.accessToken.split('.');
  const header = JSON.parse(Buffer.from(h, 'base64url').toString());
  const claims = jwt.verify(d.accessToken, secret, { algorithms: ['HS256'], issuer: 'authcore', audience: 'authcore-api' });
  check('header alg HS256', header.alg === 'HS256');
  check('claims: sub = user id, sid, jti (uuid), typ access, iss, aud', claims.sub === d.user.id && /^[0-9a-f-]{36}$/.test(claims.sid) && /^[0-9a-f-]{36}$/.test(claims.jti) && claims.typ === 'access' && claims.iss === 'authcore' && claims.aud === 'authcore-api');
  check('exp - iat = 900 s', claims.exp - claims.iat === 900);
  check('no personal data in token', !JSON.stringify(claims).includes('@') && !('email' in claims));

  console.log('\n3. Session in MongoDB');
  const s = await sessions().findOne({ _id: claims.sid });
  check('session exists, userId matches', !!s && s.userId === d.user.id);
  check('only SHA-256 of refresh token stored', s.refreshTokenHash === sha256(refreshToken) && !JSON.stringify(s).includes(refreshToken));
  check('tokenFamilyId uuid, isPersistent false, not revoked', /^[0-9a-f-]{36}$/.test(s.tokenFamilyId) && s.isPersistent === false && s.revokedAt === null);
  check('device parsed: Chrome 131 on Windows 10 (desktop)', s.deviceName === 'Chrome 131 on Windows 10' && s.deviceType === 'desktop', s.deviceName);
  check('ip from X-Forwarded-For, lastUsedAt set', /^10\.60\./.test(s.ipAddress) && s.lastUsedAt instanceof Date);
  const days = (s.expiresAt - s.createdAt) / 86400000;
  check('expires in 7 days', Math.abs(days - 7) < 0.01, days.toFixed(3));
  const u = await users().findOne({ email: 'test-login-main@example.com' });
  check('user.lastLoginAt recorded', u.lastLoginAt instanceof Date);

  console.log('\n4. Remember me, username login, multiple devices');
  r = await login({ email: 'test-login-main@example.com', password: PW, rememberMe: true }, { ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1' });
  const exp = cookieOf(r).match(/Expires=([^;]+)/);
  check('rememberMe → persistent cookie (~30 days)', !!exp && Math.abs((new Date(exp[1]) - Date.now()) / 86400000 - 30) < 0.1, exp && exp[1]);
  const s2 = await sessions().findOne({ userId: d.user.id, isPersistent: true });
  check('second session: persistent, 30 days, iPhone device', !!s2 && Math.abs((s2.expiresAt - s2.createdAt) / 86400000 - 30) < 0.01 && /iOS/.test(s2.deviceName) && s2.deviceType === 'mobile', s2 && s2.deviceName);
  r = await login({ username: ' Test_Login_Main ', password: PW });
  check('username login → 200', r.status === 200 && r.body.data.user.id === d.user.id);
  check('3 active sessions for the user (multiple devices)', (await sessions().countDocuments({ userId: d.user.id, revokedAt: null })) === 3);

  console.log('\n5. Invalid credentials and validation');
  r = await login({ email: 'test-login-main@example.com', password: 'Wr0ng!Password' });
  const wrongBody = { ...r.body, timestamp: 0 };
  check('wrong password → 401 AUTH_INVALID_CREDENTIALS "Invalid credentials"', r.status === 401 && r.body.code === 'AUTH_INVALID_CREDENTIALS' && r.body.message === 'Invalid credentials');
  r = await login({ email: 'test-login-nobody@example.com', password: 'Wr0ng!Password' });
  check('unknown email → identical response', JSON.stringify({ ...r.body, timestamp: 0 }) === JSON.stringify(wrongBody));
  r = await login({ username: 'nobody_here', password: PW });
  check('unknown username → same 401', r.status === 401 && r.body.code === 'AUTH_INVALID_CREDENTIALS');
  const times = { known: [], unknown: [] };
  for (let i = 0; i < 4; i++) {
    times.known.push((await login({ email: 'test-login-timing@example.com', password: 'x' })).ms);
    times.unknown.push((await login({ email: `test-login-ghost${i}@example.com`, password: 'x' })).ms);
  }
  await register('timing');
  times.known = [];
  for (let i = 0; i < 4; i++) times.known.push((await login({ email: 'test-login-timing@example.com', password: `Wr0ng!${i}` })).ms);
  const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  check('timing: unknown email ≈ wrong password (dummy hash)', Math.abs(avg(times.known) - avg(times.unknown)) < 25, `wrong pw ${avg(times.known).toFixed(0)} ms vs unknown ${avg(times.unknown).toFixed(0)} ms`);
  r = await login({ email: 'test-login-main@example.com', username: 'test_login_main', password: PW });
  check('email + username together → 400', r.status === 400 && r.body.errors[0].message.includes('not both'));
  r = await login({ password: PW });
  check('no identifier → 400 "email or username is required"', r.status === 400 && r.body.errors.some((e) => e.message === 'email or username is required'));
  r = await login({ email: 'test-login-main@example.com', password: '' });
  check('empty password → 400', r.status === 400 && r.body.errors.some((e) => e.field === 'password'));
  r = await login({ email: 'not-an-email', password: PW });
  check('invalid email format → 400', r.status === 400 && r.body.errors.some((e) => e.field === 'email'));
  r = await login({ email: 'test-login-main@example.com', password: PW, role: 'ADMIN' });
  check('unexpected property → 400', r.status === 400 && r.body.errors.some((e) => e.field === 'role'));
  await register('spaces', { password: '  Sp@ce5Pass  ' });
  r = await login({ email: 'test-login-spaces@example.com', password: '  Sp@ce5Pass  ' });
  const trimmed = await login({ email: 'test-login-spaces@example.com', password: 'Sp@ce5Pass' });
  check('password used exactly as typed (never trimmed)', r.status === 200 && trimmed.status === 401);

  console.log('\n6. Brute-force protection');
  const ATTACKER = '10.70.0.1';
  await register('lock');
  const codes = [];
  for (let i = 0; i < 5; i++) codes.push((await login({ email: 'test-login-lock@example.com', password: `Wr0ng!${i}` }, { ip: ATTACKER })).status);
  r = await login({ email: 'test-login-lock@example.com', password: PW }, { ip: ATTACKER });
  check('5 failures from one IP → that IP locked: even the correct password gets 429', codes.join(',') === '401,401,401,401,401' && r.status === 429 && r.body.code === 'AUTH_TOO_MANY_FAILED_ATTEMPTS', `${codes.join(',')} then ${r.status}`);
  const retry = Number(r.headers.get('retry-after'));
  check('Retry-After ≈ 15 minutes', retry > 880 && retry <= 900, retry);
  r = await login({ email: 'test-login-lock@example.com', password: PW }, { ip: '10.70.0.2' });
  check("…the real user on another IP still signs in (an attacker can't lock them out)", r.status === 200, r.status);
  r = await login({ username: 'test_login_lock_x', password: PW });
  const GHOST = '10.70.0.3';
  for (let i = 0; i < 5; i++) await login({ email: 'test-login-ghostlock@example.com', password: `Wr0ng!${i}` }, { ip: GHOST });
  r = await login({ email: 'test-login-ghostlock@example.com', password: PW }, { ip: GHOST });
  check('unknown email locks the same way (no enumeration)', r.status === 429 && r.body.code === 'AUTH_TOO_MANY_FAILED_ATTEMPTS');
  const RIP = '10.70.0.4';
  await register('reset', { username: 'test_login_reset' });
  for (let i = 0; i < 3; i++) await login({ email: 'test-login-reset@example.com', password: `Wr0ng!${i}` }, { ip: RIP });
  await login({ email: 'test-login-reset@example.com', password: PW }, { ip: RIP });
  const after = [];
  for (let i = 0; i < 4; i++) after.push((await login({ username: 'test_login_reset', password: `Wr0ng!${i}` }, { ip: RIP })).status);
  check('success resets the IP counter; email + username share it', after.join(',') === '401,401,401,401', after.join(','));
  r = await login({ username: 'test_login_reset', password: 'Wr0ng!x' }, { ip: RIP });
  check('…5th failure via username → next attempt locked', (await login({ email: 'test-login-reset@example.com', password: PW }, { ip: RIP })).status === 429);
  await register('spread');
  const spread = [];
  for (let i = 0; i < 12; i++) spread.push((await login({ email: 'test-login-spread@example.com', password: `Wr0ng!${i}` }, { ip: `10.71.0.${i + 1}` })).status);
  r = await login({ email: 'test-login-spread@example.com', password: PW }, { ip: '10.71.1.1' });
  check('12 failures spread over 12 IPs → whole account locked (LOGIN_MAX_FAILED_ATTEMPTS_PER_ACCOUNT)', spread.every((c) => c === 401) && r.status === 429, `${spread.join(',')} then ${r.status}`);
  const ipCodes = [];
  for (let i = 0; i < 11; i++) ipCodes.push((await login({ email: `test-login-ip${i}@example.com`, password: 'x' }, { ip: '10.99.99.99' })).status);
  check('per-IP limit: 11th request from one IP → 429', ipCodes[10] === 429 && ipCodes.slice(0, 10).every((c) => c === 401), ipCodes.join(','));
  const attempt = await mongoose.connection.db.collection('login_attempts').findOne({ key: /^identifier:[0-9a-f]{64}$/ });
  const ipAttempt = await mongoose.connection.db.collection('login_attempts').findOne({ key: /^identifier:[0-9a-f]{64}\|ip:/ });
  check('unknown identifiers and IPs stored hashed (no email / IP in DB)', !!attempt && attempt.expiresAt instanceof Date && !!ipAttempt && /^identifier:[0-9a-f]{64}\|ip:[0-9a-f]{32}$/.test(ipAttempt.key) && !ipAttempt.key.includes('10.70'));

  console.log('\n7. Account status checks');
  const statusCase = async (tag, set, expectedStatus, expectedCode) => {
    await register(tag);
    await users().updateOne({ email: `test-login-${tag}@example.com` }, { $set: set });
    const ok = await login({ email: `test-login-${tag}@example.com`, password: PW });
    const bad = await login({ email: `test-login-${tag}@example.com`, password: 'Wr0ng!Pass1' });
    check(`${tag}: correct pw → ${expectedStatus} ${expectedCode ?? ''}; wrong pw → 401 (no status leak)`, ok.status === expectedStatus && (expectedCode === undefined || ok.body.code === expectedCode) && bad.status === 401, `${ok.status} ${ok.body.code} / ${bad.status}`);
  };
  await statusCase('pendver', { status: 'PENDING_VERIFICATION' }, 403, 'AUTH_EMAIL_NOT_VERIFIED');
  await statusCase('pendapp', { status: 'PENDING_APPROVAL' }, 403, 'AUTH_ACCOUNT_PENDING_APPROVAL');
  await statusCase('suspended', { status: 'SUSPENDED' }, 403, 'AUTH_ACCOUNT_SUSPENDED');
  await statusCase('inactive', { status: 'INACTIVE' }, 403, 'AUTH_ACCOUNT_INACTIVE');
  await statusCase('banned', { status: 'BANNED' }, 403, 'AUTH_ACCOUNT_DISABLED');
  await statusCase('rejected', { status: 'REJECTED' }, 403, 'AUTH_ACCOUNT_DISABLED');
  await statusCase('deleted', { deletedAt: new Date() }, 401, 'AUTH_INVALID_CREDENTIALS');
  await statusCase('badhash', { passwordHash: 'not-a-valid-hash' }, 401, 'AUTH_INVALID_CREDENTIALS');
  await stopApp(app);

  console.log('\n8. ACTIVE but unverified, when email verification is on');
  app = await startApp({ REGISTRATION_EMAIL_VERIFICATION: 'otp' });
  r = await login({ email: 'test-login-main@example.com', password: PW });
  check('ACTIVE + unverified → 403 AUTH_EMAIL_NOT_VERIFIED', r.status === 403 && r.body.code === 'AUTH_EMAIL_NOT_VERIFIED');
  await call('/auth/verify-email/resend', { email: 'test-login-main@example.com' });
  const files = fs.readdirSync(app.outbox).filter((f) => f.includes('verification-code'));
  const code = files.length ? (fs.readFileSync(path.join(app.outbox, files[0]), 'utf8').match(/Subject: (\d{6}) is your/) || [])[1] : null;
  r = await call('/auth/verify-email/otp', { email: 'test-login-main@example.com', code });
  check('resend + verify works for ACTIVE unverified → LOGIN', r.status === 200 && r.body.data.nextStep === 'LOGIN', `${r.status} ${r.body.code ?? ''}`);
  check('status stays ACTIVE, now verified', (await users().findOne({ email: 'test-login-main@example.com' })).status === 'ACTIVE');
  r = await login({ email: 'test-login-main@example.com', password: PW });
  check('login now → 200', r.status === 200);
  await stopApp(app);

  console.log('\n9. Configuration variants');
  app = await startApp({ LOGIN_IDENTIFIERS: 'email', REFRESH_TOKEN_DELIVERY: 'body', MAX_SESSIONS_PER_USER: '2', ARGON2_TIME_COST: '3' });
  r = await login({ username: 'test_login_main', password: PW });
  check('LOGIN_IDENTIFIERS=email → username login 400 "not enabled"', r.status === 400 && r.body.errors[0].message === 'sign-in with username is not enabled');
  const before = (await users().findOne({ email: 'test-login-main@example.com' }, { projection: { passwordHash: 1 } })).passwordHash;
  r = await login({ email: 'test-login-main@example.com', password: PW });
  check('REFRESH_TOKEN_DELIVERY=body → refreshToken + expiry in body, no cookie', typeof r.body.data.refreshToken === 'string' && !!r.body.data.refreshTokenExpiresAt && cookieOf(r) === '');
  const afterHash = (await users().findOne({ email: 'test-login-main@example.com' }, { projection: { passwordHash: 1 } })).passwordHash;
  check('stronger Argon2 setting → hash upgraded on login (t=2 → t=3)', before.includes(',t=2,') && afterHash.includes(',t=3,'));
  r = await login({ email: 'test-login-main@example.com', password: PW });
  check('login still works with upgraded hash', r.status === 200);
  const active = await sessions().countDocuments({ userId: d.user.id, revokedAt: null });
  const limited = await sessions().countDocuments({ userId: d.user.id, revokedReason: 'session_limit' });
  check('MAX_SESSIONS_PER_USER=2 → only 2 active, oldest revoked (session_limit)', active === 2 && limited >= 3, `active ${active}, revoked ${limited}`);
  await stopApp(app);

  console.log('\n10. Access token verification (AccessTokenService)');
  process.chdir(backend);
  const { NestFactory } = req('@nestjs/core');
  const { AppModule } = require(path.join(backend, 'dist/app.module.js'));
  const { AccessTokenService } = require(path.join(backend, 'dist/modules/auth/services/access-token.service.js'));
  const ctx = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const tokens = ctx.get(AccessTokenService);
  const valid = (await tokens.issue('user-1', 'session-1')).accessToken;
  const rejects = async (t) => tokens.verify(t).then(() => false, () => true);
  check('valid token verifies', (await tokens.verify(valid)).sub === 'user-1');
  const [vh, vp, vs] = valid.split('.');
  const tamperedPayload = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(vp, 'base64url')), sub: 'admin' })).toString('base64url');
  check('tampered payload rejected', await rejects(`${vh}.${tamperedPayload}.${vs}`));
  const noneToken = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${vp}.`;
  check('alg "none" rejected', await rejects(noneToken));
  check('wrong secret rejected', await rejects(jwt.sign({ sid: 's', typ: 'access' }, 'x'.repeat(40), { algorithm: 'HS256', subject: 'u', jwtid: 'j', issuer: 'authcore', audience: 'authcore-api' })));
  check('HS512 (algorithm switch) rejected', await rejects(jwt.sign({ sid: 's', typ: 'access' }, secret, { algorithm: 'HS512', subject: 'u', jwtid: 'j', issuer: 'authcore', audience: 'authcore-api' })));
  check('expired token rejected', await rejects(jwt.sign({ sid: 's', typ: 'access', exp: Math.floor(Date.now() / 1000) - 60 }, secret, { algorithm: 'HS256', subject: 'u', jwtid: 'j', issuer: 'authcore', audience: 'authcore-api' })));
  check('wrong audience rejected', await rejects(jwt.sign({ sid: 's', typ: 'access' }, secret, { algorithm: 'HS256', subject: 'u', jwtid: 'j', issuer: 'authcore', audience: 'other-api', expiresIn: 60 })));
  check('non-access token (no typ) rejected', await rejects(jwt.sign({ sid: 's' }, secret, { algorithm: 'HS256', subject: 'u', jwtid: 'j', issuer: 'authcore', audience: 'authcore-api', expiresIn: 60 })));
  await ctx.close();

  console.log('\n11. Logs');
  const all = logs.join('');
  const entries = all.split('\n').filter((l) => l.startsWith('{')).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  check('no passwords in logs', !all.includes(PW) && !all.includes('Wr0ng!') && !all.includes('Sp@ce5Pass'));
  check('no access or refresh tokens in logs', !all.includes(refreshToken) && !all.includes(d.accessToken) && !/eyJ[A-Za-z0-9_-]{10,}\.eyJ/.test(all));
  check('no emails in auth logs', !entries.filter((e) => e.context === 'AuthService').some((e) => JSON.stringify(e).includes('@example.com')));
  const msgs = new Set(entries.filter((e) => e.context === 'AuthService').map((e) => e.message));
  check('events logged: succeeded / failed / locked / refused', ['Login succeeded', 'Login failed: invalid credentials', 'Login locked after too many failed attempts', 'Login refused: locked after too many failed attempts', 'Login refused: account cannot sign in', 'Password hash upgraded'].every((m) => msgs.has(m)), [...msgs].join(' | '));
  const success = entries.find((e) => e.message === 'Login succeeded');
  check('success log has userId, sessionId, ip, requestId', !!success && success.userId && success.sessionId && success.ipAddress && success.requestId);

  // Cleanup
  const ids = (await users().find({ email: /^test-login-/ }, { projection: { _id: 1 } }).toArray()).map((x) => x._id);
  const ds = await sessions().deleteMany({ userId: { $in: ids } });
  const dv = await mongoose.connection.db.collection('email_verifications').deleteMany({ userId: { $in: ids } });
  const da = await mongoose.connection.db.collection('login_attempts').deleteMany({});
  const du = await users().deleteMany({ email: /^test-login-/ });
  console.log(`\nCleanup: ${du.deletedCount} users, ${ds.deletedCount} sessions, ${da.deletedCount} login attempts, ${dv.deletedCount} verifications`);
  await mongoose.connection.db.collection('password_policies').deleteMany({ key: 'global', policyName: 'login-test' });
  await mongoose.disconnect();
  console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch(async (e) => { console.error(e); await mongoose.disconnect().catch(() => {}); process.exitCode = 1; });
