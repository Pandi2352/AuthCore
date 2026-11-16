// End-to-end tests for forgot / verify / reset / change password.
// Run with: npm run test:e2e -- password   (see test/e2e/README.md)
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const backend = process.argv[2] || path.resolve(__dirname, '..', '..', '..');
const req = (m) => require(path.join(backend, 'node_modules', m));
const mongoose = req('mongoose');
const BASE = `http://localhost:${process.env.E2E_PORT || 3000}/api/v1`;
const PW = 'Str0ng!Passw0rd';
const NEW_PW = 'N3w!Secur3Pass';
let failures = 0;
let ipCounter = 1;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (label, ok, detail = '') => {
  if (!ok) failures++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail !== '' ? `  -> ${detail}` : ''}`);
};
const freshIp = () => `10.97.${Math.floor(ipCounter / 250)}.${(ipCounter++ % 250) + 1}`;

async function call(method, route, { body, token, ip = freshIp() } = {}) {
  const headers = { 'X-Forwarded-For': ip, 'User-Agent': 'pw-test' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const t = Date.now();
  const res = await fetch(BASE + route, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, body: await res.json(), ms: Date.now() - t };
}

const emails = (dir, tpl) => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.eml') && (!tpl || f.includes(tpl))).sort() : []);
async function waitEmail(dir, tpl, count) {
  for (let i = 0; i < 40; i++) { if (emails(dir, tpl).length >= count) break; await sleep(100); }
  const list = emails(dir, tpl);
  return list.length >= count ? fs.readFileSync(path.join(dir, list[list.length - 1]), 'utf8') : '';
}
const codeOf = (mail) => (mail.match(/Subject: (\d{6}) is your/) || [])[1];

async function start(extraEnv) {
  const outbox = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-outbox-'));
  const logs = [];
  const child = spawn(process.execPath, ['dist/main.js'], {
    cwd: backend,
    env: { ...process.env, TRUST_PROXY_HOPS: '1', LOG_FORMAT: 'json', LOG_LEVEL: 'info', MAIL_TRANSPORT: 'outbox', MAIL_OUTBOX_DIR: outbox,
      REGISTRATION_EMAIL_VERIFICATION: 'none', REGISTRATION_REQUIRE_APPROVAL: 'false', PASSWORD_RESET_RESEND_COOLDOWN_SECONDS: '30', ...extraEnv },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (d) => logs.push(String(d)));
  child.stderr.on('data', (d) => logs.push(String(d)));
  for (let i = 0; i < 80; i++) { try { if ((await fetch(BASE + '/health/live')).ok) break; } catch {} await sleep(250); }
  return { child, outbox, logs };
}
async function stop(app) { app.child.kill(); await sleep(600); }

async function main() {
  await mongoose.connect((process.env.E2E_MONGODB_URI || 'mongodb://localhost:27017/authcore_e2e'));
  const db = mongoose.connection.db;
  const users = db.collection('users');
  const resets = db.collection('password_resets');
  const sessions = db.collection('sessions');
  const attempts = db.collection('login_attempts');
  const email = (tag) => `test-pw-${tag}@example.com`;
  const cleanup = async () => {
    const ids = (await users.find({ email: /^test-pw-/ }).toArray()).map((u) => u._id);
    await sessions.deleteMany({ userId: { $in: ids } });
    await resets.deleteMany({ userId: { $in: ids } });
    await attempts.deleteMany({ key: { $in: ids.map((id) => `user:${id}`) } });
    await users.deleteMany({ _id: { $in: ids } });
  };
  await cleanup();

  let app = await start({});
  const register = (tag, firstName = 'Samantha') => call('POST', '/auth/register', { body: { email: email(tag), password: PW, firstName } });
  const login = async (tag, password = PW) => (await call('POST', '/auth/login', { body: { email: email(tag), password } }));
  const userId = async (tag) => (await users.findOne({ email: email(tag) }))._id;
  const allowResend = async (tag) => resets.updateOne({ userId: await userId(tag) }, { $set: { lastSentAt: new Date(0) } });
  for (const t of ['a', 'b', 'c', 'd', 'e']) await register(t);
  await users.updateOne({ email: email('c') }, { $set: { status: 'SUSPENDED' } });

  console.log('\n1. Forgot password: no enumeration');
  let unknown = await call('POST', '/auth/forgot-password', { body: { email: 'test-pw-nobody@example.com' } });
  let known = await call('POST', '/auth/forgot-password', { body: { email: email('a') } });
  const same = (x, y) => x.status === y.status && JSON.stringify({ ...x.body, timestamp: 0 }) === JSON.stringify({ ...y.body, timestamp: 0 });
  check('unknown and known email: identical 200 response', same(unknown, known) && known.status === 200, known.body.message);
  check('responds fast for both (email is sent in background)', unknown.ms < 300 && known.ms < 300, `${unknown.ms}ms / ${known.ms}ms`);
  let mail = await waitEmail(app.outbox, 'password-reset-code', 1);
  const codeA = codeOf(mail);
  check('reset code email arrives for the known account only', /^\d{6}$/.test(codeA ?? '') && emails(app.outbox, 'password-reset-code').length === 1);
  const recA = await resets.findOne({ userId: await userId('a') });
  check('stored: HMAC hash only, expiry ~15 min, method OTP', recA.codeHash.length === 64 && !JSON.stringify(recA).includes(codeA) && Math.abs(recA.expiresAt - Date.now() - 15 * 60_000) < 10_000 && recA.method === 'OTP');
  const suspended = await call('POST', '/auth/forgot-password', { body: { email: email('c') } });
  await sleep(500);
  check('suspended account: same 200, no email', same(suspended, known) && emails(app.outbox).length === 1);
  const again = await call('POST', '/auth/forgot-password', { body: { email: email('a') } });
  await sleep(500);
  check('again within cooldown: same 200, no new email, code unchanged', same(again, known) && emails(app.outbox).length === 1 && (await resets.findOne({ userId: await userId('a') })).codeHash === recA.codeHash);
  let r = await call('POST', '/auth/forgot-password', { body: { email: 'not-an-email' } });
  check('invalid email -> 400 VALIDATION_FAILED', r.status === 400 && r.body.code === 'VALIDATION_FAILED');
  const ip = freshIp();
  const burst = [];
  for (let i = 0; i < 4; i++) burst.push((await call('POST', '/auth/forgot-password', { body: { email: 'test-pw-nobody@example.com' }, ip })).status);
  check('IP rate limit: 4th request in a minute -> 429', burst.join(',') === '200,200,200,429', burst.join(','));
  const indexes = (await resets.indexes()).map((i) => `${Object.keys(i.key)}${i.expireAfterSeconds !== undefined ? ':ttl' : ''}${i.unique ? ':unique' : ''}`);
  check('indexes: userId unique, codeHash, authorizationHash, expiresAt TTL', ['userId:unique', 'codeHash', 'authorizationHash', 'expiresAt:ttl'].every((x) => indexes.includes(x)), indexes.join(' '));

  console.log('\n2. Verify reset code');
  r = await call('POST', '/auth/verify-reset-token', { body: { email: email('a'), code: codeA === '000000' ? '111111' : '000000' } });
  check('wrong code -> 400 AUTH_INVALID_RESET_CODE', r.status === 400 && r.body.code === 'AUTH_INVALID_RESET_CODE');
  check('attempts counted', (await resets.findOne({ userId: await userId('a') })).attempts === 1);
  r = await call('POST', '/auth/verify-reset-token', { body: { email: 'test-pw-nobody@example.com', code: codeA } });
  check('unknown email -> same 400 AUTH_INVALID_RESET_CODE', r.status === 400 && r.body.code === 'AUTH_INVALID_RESET_CODE');
  r = await call('POST', '/auth/verify-reset-token', { body: { email: email('a') } });
  check('missing code -> 400 "code is required"', r.status === 400 && JSON.stringify(r.body.errors).includes('code is required'));
  r = await call('POST', '/auth/verify-reset-token', { body: { token: 'x'.repeat(43) } });
  check('link token while OTP is enabled -> 404', r.status === 404);
  const [v1, v2] = await Promise.all([
    call('POST', '/auth/verify-reset-token', { body: { email: email('a'), code: codeA } }),
    call('POST', '/auth/verify-reset-token', { body: { email: email('a'), code: codeA } }),
  ]);
  const ok = [v1, v2].filter((x) => x.status === 200);
  check('two parallel verifies with the right code: exactly one succeeds', ok.length === 1, `${v1.status}/${v2.status}`);
  const resetTokenA = ok[0]?.body.data.resetToken;
  check('returns resetToken (43 chars) + expiresIn 600', /^[A-Za-z0-9_-]{43}$/.test(resetTokenA ?? '') && ok[0].body.data.expiresIn === 600);
  r = await call('POST', '/auth/verify-reset-token', { body: { email: email('a'), code: codeA } });
  check('code reuse after verification -> 400', r.status === 400 && r.body.code === 'AUTH_INVALID_RESET_CODE');
  const recV = await resets.findOne({ userId: await userId('a') });
  check('stored: code hash cleared, reset-token HMAC, expiry ~10 min', recV.codeHash === null && recV.authorizationHash.length === 64 && !JSON.stringify(recV).includes(resetTokenA) && Math.abs(recV.expiresAt - Date.now() - 10 * 60_000) < 10_000);

  console.log('\n3. Max wrong attempts');
  await call('POST', '/auth/forgot-password', { body: { email: email('b') } });
  const codeB = codeOf(await waitEmail(app.outbox, 'password-reset-code', 2));
  const wrong = codeB === '999999' ? '888888' : '999999';
  const codes = [];
  for (let i = 0; i < 5; i++) codes.push((await call('POST', '/auth/verify-reset-token', { body: { email: email('b'), code: wrong } })).body.code);
  check('5th wrong code -> AUTH_RESET_ATTEMPTS_EXCEEDED', codes[4] === 'AUTH_RESET_ATTEMPTS_EXCEEDED' && codes.slice(0, 4).every((c) => c === 'AUTH_INVALID_RESET_CODE'), codes.join(','));
  r = await call('POST', '/auth/verify-reset-token', { body: { email: email('b'), code: codeB } });
  check('then even the right code fails (reset deleted)', r.status === 400 && (await resets.countDocuments({ userId: await userId('b') })) === 0);
  await call('POST', '/auth/forgot-password', { body: { email: email('b') } });
  const codeB2 = codeOf(await waitEmail(app.outbox, 'password-reset-code', 3));
  check('a new request works again (no cooldown left after lockout)', /^\d{6}$/.test(codeB2 ?? '') && codeB2 !== undefined);

  console.log('\n4. Reset password');
  const s1 = (await login('a')).body.data.accessToken;
  const s2 = (await login('a')).body.data.accessToken;
  await attempts.updateOne({ key: `user:${await userId('a')}` }, { $set: { key: `user:${await userId('a')}`, failedCount: 5, lockedUntil: new Date(Date.now() + 600_000), windowStartedAt: new Date() } }, { upsert: true });
  r = await call('POST', '/auth/reset-password', { body: { resetToken: resetTokenA, newPassword: NEW_PW, confirmPassword: 'Different!123' } });
  check('confirm mismatch -> 400 "confirmPassword must match newPassword"', r.status === 400 && JSON.stringify(r.body.errors).includes('confirmPassword must match newPassword'));
  r = await call('POST', '/auth/reset-password', { body: { resetToken: resetTokenA, newPassword: 'weakpass', confirmPassword: 'weakpass' } });
  check('weak password -> 400 strength message', r.status === 400 && JSON.stringify(r.body.errors).includes('Password must contain at least 1 uppercase letter'));
  r = await call('POST', '/auth/reset-password', { body: { resetToken: resetTokenA, newPassword: 'Samantha!2024x', confirmPassword: 'Samantha!2024x' } });
  check('contains first name -> 400', r.status === 400 && JSON.stringify(r.body.errors).includes('must not contain your email, username or name'));
  r = await call('POST', '/auth/reset-password', { body: { resetToken: resetTokenA, newPassword: PW, confirmPassword: PW } });
  check('current password -> 400 AUTH_PASSWORD_REUSED', r.status === 400 && r.body.code === 'AUTH_PASSWORD_REUSED');
  r = await call('POST', '/auth/reset-password', { body: { resetToken: 'y'.repeat(43), newPassword: NEW_PW, confirmPassword: NEW_PW } });
  check('unknown resetToken -> 400 AUTH_INVALID_RESET_TOKEN', r.status === 400 && r.body.code === 'AUTH_INVALID_RESET_TOKEN');
  const [p1, p2] = await Promise.all([
    call('POST', '/auth/reset-password', { body: { resetToken: resetTokenA, newPassword: NEW_PW, confirmPassword: NEW_PW } }),
    call('POST', '/auth/reset-password', { body: { resetToken: resetTokenA, newPassword: 'An0ther!Passw0rd', confirmPassword: 'An0ther!Passw0rd' } }),
  ]);
  const winner = [p1, p2].filter((x) => x.status === 200);
  check('rejected passwords kept the token; two parallel resets: exactly one succeeds', winner.length === 1 && [p1, p2].some((x) => x.body.code === 'AUTH_INVALID_RESET_TOKEN'), `${p1.status}/${p2.status}`);
  const finalPw = winner[0] === p1 ? NEW_PW : 'An0ther!Passw0rd';
  check('message tells the user to sign in again', /Sign in with your new password/.test(winner[0]?.body.message ?? ''));
  r = await call('GET', '/auth/me', { token: s1 });
  const r2 = await call('GET', '/auth/me', { token: s2 });
  check('all sessions signed out (both access tokens -> 401 AUTH_SESSION_REVOKED)', r.status === 401 && r2.status === 401 && r.body.code === 'AUTH_SESSION_REVOKED');
  check('sessions revoked with reason password_reset', (await sessions.countDocuments({ userId: await userId('a'), revokedReason: 'password_reset' })) === 2);
  check('login lockout cleared', (await attempts.countDocuments({ key: `user:${await userId('a')}` })) === 0);
  check('old password no longer works', (await login('a')).status === 401);
  check('new password works', (await login('a', finalPw)).status === 200);
  check('reset record deleted (token single use)', (await resets.countDocuments({ userId: await userId('a') })) === 0);
  const uA = await users.findOne({ email: email('a') });
  check('previous hash saved in history, passwordChangedAt updated', uA.passwordHistory.length === 1 && uA.passwordHistory[0] !== uA.passwordHash && Date.now() - uA.passwordChangedAt < 60_000);
  mail = await waitEmail(app.outbox, 'password-changed', 1);
  check('"password was reset" email sent', /Subject: Your AuthCore password was reset/.test(mail) || /password was reset/.test(mail));
  r = await call('GET', '/auth/me', { token: s1 });
  check('history not exposed via /me', !JSON.stringify(r.body).includes('passwordHistory'));

  console.log('\n5. Expired reset token');
  await call('POST', '/auth/forgot-password', { body: { email: email('d') } });
  const codeD = codeOf(await waitEmail(app.outbox, 'password-reset-code', 4));
  const tokD = (await call('POST', '/auth/verify-reset-token', { body: { email: email('d'), code: codeD } })).body.data.resetToken;
  await resets.updateOne({ userId: await userId('d') }, { $set: { authorizationExpiresAt: new Date(Date.now() - 1000) } });
  r = await call('POST', '/auth/reset-password', { body: { resetToken: tokD, newPassword: NEW_PW, confirmPassword: NEW_PW } });
  check('expired reset token -> 400 AUTH_INVALID_RESET_TOKEN', r.status === 400 && r.body.code === 'AUTH_INVALID_RESET_TOKEN');
  await allowResend('d');
  await call('POST', '/auth/forgot-password', { body: { email: email('d') } });
  const codeD2 = codeOf(await waitEmail(app.outbox, 'password-reset-code', 5));
  const tokD2 = (await call('POST', '/auth/verify-reset-token', { body: { email: email('d'), code: codeD2 } })).body.data.resetToken;
  await users.updateOne({ email: email('d') }, { $set: { status: 'BANNED' } });
  r = await call('POST', '/auth/reset-password', { body: { resetToken: tokD2, newPassword: NEW_PW, confirmPassword: NEW_PW } });
  check('account banned after the email -> reset refused 403', r.status === 403 && r.body.code === 'AUTH_ACCOUNT_DISABLED', r.body.code);

  console.log('\n6. Change password');
  const e1 = (await login('e')).body.data.accessToken;
  const e2 = (await login('e')).body.data.accessToken;
  const e3 = (await login('e')).body.data.accessToken;
  r = await call('PATCH', '/auth/change-password', { body: { currentPassword: PW, newPassword: NEW_PW, confirmPassword: NEW_PW } });
  check('no access token -> 401', r.status === 401);
  r = await call('PATCH', '/auth/change-password', { token: e1, body: { currentPassword: 'Wrong!Passw0rd', newPassword: NEW_PW, confirmPassword: NEW_PW } });
  check('wrong current password -> 400 AUTH_INVALID_CURRENT_PASSWORD (field currentPassword)', r.status === 400 && r.body.code === 'AUTH_INVALID_CURRENT_PASSWORD' && r.body.errors[0]?.field === 'currentPassword');
  check('failure counted toward the sign-in lockout', (await attempts.findOne({ key: `user:${await userId('e')}` }))?.failedCount === 1);
  r = await call('PATCH', '/auth/change-password', { token: e1, body: { currentPassword: PW, newPassword: PW, confirmPassword: PW } });
  check('new = current -> 400 AUTH_PASSWORD_REUSED', r.status === 400 && r.body.code === 'AUTH_PASSWORD_REUSED');
  r = await call('PATCH', '/auth/change-password', { token: e1, body: { currentPassword: PW, newPassword: NEW_PW, confirmPassword: NEW_PW + 'x' } });
  check('confirm mismatch -> 400', r.status === 400 && JSON.stringify(r.body.errors).includes('confirmPassword must match'));
  r = await call('PATCH', '/auth/change-password', { token: e1, body: { currentPassword: PW, newPassword: NEW_PW, confirmPassword: NEW_PW, extra: 1 } });
  check('unknown field -> 400', r.status === 400);
  await call('POST', '/auth/forgot-password', { body: { email: email('e') } });
  await waitEmail(app.outbox, 'password-reset-code', 6);
  r = await call('PATCH', '/auth/change-password', { token: e1, body: { currentPassword: PW, newPassword: NEW_PW, confirmPassword: NEW_PW } });
  check('success -> 200 "Password changed", revokedSessionCount 2, current kept', r.status === 200 && r.body.message === 'Password changed' && r.body.data.revokedSessionCount === 2 && r.body.data.isCurrentSessionKept === true, JSON.stringify(r.body.data));
  check('this device still signed in', (await call('GET', '/auth/me', { token: e1 })).status === 200);
  check('other devices signed out', (await call('GET', '/auth/me', { token: e2 })).status === 401 && (await call('GET', '/auth/me', { token: e3 })).status === 401);
  check('pending password reset cancelled, lockout counter cleared', (await resets.countDocuments({ userId: await userId('e') })) === 0 && (await attempts.countDocuments({ key: `user:${await userId('e')}` })) === 0);
  check('"password was changed" email sent', /password was changed/.test(await waitEmail(app.outbox, 'password-changed', 2)));
  r = await call('PATCH', '/auth/change-password', { token: e1, body: { currentPassword: NEW_PW, newPassword: PW, confirmPassword: PW } });
  check('previous password (in history) -> 400 AUTH_PASSWORD_REUSED', r.status === 400 && r.body.code === 'AUTH_PASSWORD_REUSED');
  // History is capped at PASSWORD_HISTORY_SIZE (5): after 6 more changes the original is allowed again.
  let current = NEW_PW;
  for (let i = 1; i <= 6; i++) {
    const next = `Rotat3!Pass${i}x`;
    r = await call('PATCH', '/auth/change-password', { token: e1, body: { currentPassword: current, newPassword: next, confirmPassword: next } });
    if (r.status !== 200) { check(`rotation ${i}`, false, r.body.code); break; }
    current = next;
  }
  const uE = await users.findOne({ email: email('e') });
  check('history capped at 5 entries', uE.passwordHistory.length === 5, uE.passwordHistory.length);
  r = await call('PATCH', '/auth/change-password', { token: e1, body: { currentPassword: current, newPassword: PW, confirmPassword: PW } });
  check('password older than the last 5 may be used again', r.status === 200, r.body.code);
  const statuses = [];
  for (let i = 0; i < 5; i++) statuses.push((await call('PATCH', '/auth/change-password', { token: e1, body: { currentPassword: 'Wrong!Passw0rd', newPassword: NEW_PW, confirmPassword: NEW_PW } })).body.code);
  check('5 wrong current passwords -> locked (429)', statuses[4] === 'AUTH_TOO_MANY_FAILED_ATTEMPTS', statuses.join(','));
  r = await call('PATCH', '/auth/change-password', { token: e1, body: { currentPassword: PW, newPassword: NEW_PW, confirmPassword: NEW_PW } });
  check('while locked even the right password -> 429 with Retry-After', r.status === 429);
  check('sign-in is locked too (shared lockout)', (await login('e')).status === 429);

  console.log('\n7. Logs');
  const logText = app.logs.join('');
  const secrets = [codeA, codeB, codeB2, resetTokenA, tokD, PW, NEW_PW].filter(Boolean);
  check('no codes, reset tokens or passwords in logs', !secrets.some((s) => logText.includes(s)));
  check('audit logs: requested / verified / reset / changed with userId', ['Password reset requested', 'Password reset verified', '"Password reset"', 'Password changed', 'wrong current password'].every((m) => logText.includes(m)) && logText.split('\n').filter((l) => l.startsWith('{')).map((l) => JSON.parse(l)).filter((e) => /^Password (reset|changed)$/.test(e.message)).every((e) => /^[0-9a-f-]{36}$/.test(e.userId)));
  check('unknown-email requests logged without the email', logText.includes('unknown or ineligible') && !logText.includes('test-pw-nobody'));
  await stop(app);

  console.log('\n8. Link method');
  app = await start({ PASSWORD_RESET_METHOD: 'link', PASSWORD_RESET_URL: 'http://localhost:5173/reset-password' });
  await users.updateOne({ email: email('b') }, { $set: {} });
  await allowResend('b');
  await call('POST', '/auth/forgot-password', { body: { email: email('b') } });
  mail = await waitEmail(app.outbox, 'password-reset-link', 1);
  const link = (mail.replace(/=\r?\n/g, '').replace(/=3D/g, '=').match(/http:\/\/localhost:5173\/reset-password\?token=([A-Za-z0-9_-]{43})/) || [])[1];
  check('reset link email with ?token=', !!link);
  r = await call('POST', '/auth/verify-reset-token', { body: { email: email('b'), code: '123456' } });
  check('code while link is enabled -> 404', r.status === 404);
  r = await call('POST', '/auth/verify-reset-token', { body: { token: link } });
  check('link token -> 200 resetToken', r.status === 200 && /^[A-Za-z0-9_-]{43}$/.test(r.body.data.resetToken));
  const tokB = r.body.data.resetToken;
  r = await call('POST', '/auth/verify-reset-token', { body: { token: link } });
  check('link works once', r.status === 400 && r.body.code === 'AUTH_INVALID_RESET_CODE');
  r = await call('POST', '/auth/reset-password', { body: { resetToken: tokB, newPassword: NEW_PW, confirmPassword: NEW_PW } });
  check('reset with link-issued token -> 200', r.status === 200);
  check('new password works', (await login('b', NEW_PW)).status === 200);
  check('link token not in logs', !app.logs.join('').includes(link) && !app.logs.join('').includes(tokB));
  await stop(app);

  await cleanup();
  await mongoose.disconnect();
  console.log(`\n${failures === 0 ? 'ALL PASSED' : `${failures} FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}
main().catch(async (e) => { console.error(e); process.exit(1); });
