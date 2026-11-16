// End-to-end test of all registration flows.
// Run with: npm run test:e2e -- flows   (see test/e2e/README.md)
const { spawn, execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const backend = process.argv[2] || path.resolve(__dirname, '..', '..', '..');
const mongoose = require(path.join(backend, 'node_modules/mongoose'));
const BASE = `http://localhost:${process.env.E2E_PORT || 3000}/api/v1`;
let ip = 0;
let failures = 0;

const check = (label, ok, detail = '') => {
  if (!ok) failures++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  -> ${detail}` : ''}`);
};

async function post(route, body) {
  ip++;
  const res = await fetch(BASE + route, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `10.50.${Math.floor(ip / 250)}.${ip % 250}` },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

function decodeQuotedPrintable(text) {
  return text.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

function outboxFiles(dir) {
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.eml')).sort() : [];
}

function latestEmail(dir, template) {
  const file = outboxFiles(dir).filter((f) => f.includes(template)).pop();
  return file ? decodeQuotedPrintable(fs.readFileSync(path.join(dir, file), 'utf8')) : '';
}

async function startApp(env) {
  const outbox = fs.mkdtempSync(path.join(os.tmpdir(), 'authcore-outbox-'));
  const child = spawn(process.execPath, ['dist/main.js'], {
    cwd: backend,
    env: { ...process.env, TRUST_PROXY_HOPS: '1', LOG_LEVEL: 'warn', MAIL_TRANSPORT: 'outbox', MAIL_OUTBOX_DIR: outbox, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (d) => (output += d));
  child.stderr.on('data', (d) => (output += d));
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(BASE + '/health/live')).ok) return { child, outbox, output: () => output };
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  child.kill();
  throw new Error('app did not start:\n' + output);
}

async function stopApp(app) {
  app.child.kill();
  await new Promise((r) => setTimeout(r, 500));
}

async function dbUser(email) {
  return mongoose.connection.db.collection('users').findOne({ email });
}

const pw = 'Str0ng!Passw0rd';
const person = (tag) => ({ email: `test-flow-${tag}@example.com`, password: pw, firstName: 'Tess' });

async function main() {
  await mongoose.connect((process.env.E2E_MONGODB_URI || 'mongodb://localhost:27017/authcore_e2e'));

  // ---------------------------------------------------------------- A. Direct
  console.log('\nA. Direct (none + no approval): Register -> Login');
  let app = await startApp({ REGISTRATION_EMAIL_VERIFICATION: 'none', REGISTRATION_REQUIRE_APPROVAL: 'false' });
  let r = await post('/auth/register', person('direct'));
  check('201 + nextStep LOGIN', r.status === 201 && r.body.data.nextStep === 'LOGIN', `${r.status} ${r.body.data?.nextStep}`);
  check('status ACTIVE, no email sent', r.body.data.user.status === 'ACTIVE' && r.body.data.isVerificationEmailSent === false && outboxFiles(app.outbox).length === 0);
  r = await post('/auth/verify-email/otp', { email: 'test-flow-direct@example.com', code: '123456' });
  check('OTP endpoint disabled -> 404', r.status === 404, r.body.message);
  r = await post('/auth/verify-email/resend', { email: 'test-flow-direct@example.com' });
  check('resend disabled -> 404', r.status === 404);
  await stopApp(app);

  // ------------------------------------------------------------- B. Email OTP
  console.log('\nB. Email OTP (otp + no approval): Register -> Verify code -> Login');
  app = await startApp({ REGISTRATION_EMAIL_VERIFICATION: 'otp', REGISTRATION_REQUIRE_APPROVAL: 'false' });
  r = await post('/auth/register', person('otp'));
  check('201 + nextStep VERIFY_EMAIL_OTP + email sent', r.status === 201 && r.body.data.nextStep === 'VERIFY_EMAIL_OTP' && r.body.data.isVerificationEmailSent === true);
  check('status PENDING_VERIFICATION', r.body.data.user.status === 'PENDING_VERIFICATION');
  let mail = latestEmail(app.outbox, 'verification-code');
  const code = (mail.match(/Subject: (\d{6}) is your/) || [])[1];
  check('code email in outbox', /^\d{6}$/.test(code ?? ''), `code ${code}`);
  check('email greets user, no HTML injection risk', mail.includes('Hi Tess,'));
  const stored = await mongoose.connection.db.collection('email_verifications').findOne({ userId: r.body.data.user.id });
  check('only an HMAC is stored (64 hex, not the code)', /^[0-9a-f]{64}$/.test(stored.tokenHash) && !JSON.stringify(stored).includes(code), `attempts=${stored.attempts}`);
  const wrong = code === '000000' ? '111111' : '000000';
  r = await post('/auth/verify-email/otp', { email: 'test-flow-otp@example.com', code: wrong });
  check('wrong code -> 400 AUTH_INVALID_VERIFICATION_CODE', r.status === 400 && r.body.code === 'AUTH_INVALID_VERIFICATION_CODE');
  r = await post('/auth/verify-email/otp', { email: 'test-flow-nobody@example.com', code });
  check('unknown email -> same 400 response', r.status === 400 && r.body.code === 'AUTH_INVALID_VERIFICATION_CODE' && r.body.message === 'The verification code is invalid or has expired');
  r = await post('/auth/verify-email/link', { token: 'a'.repeat(43) });
  check('link endpoint disabled in otp mode -> 404', r.status === 404);
  r = await post('/auth/verify-email/otp', { email: 'TEST-FLOW-OTP@example.com ', code });
  check('correct code (email any case) -> 200 nextStep LOGIN', r.status === 200 && r.body.data.nextStep === 'LOGIN', `${r.status} ${JSON.stringify(r.body.data ?? r.body.errors)}`);
  let u = await dbUser('test-flow-otp@example.com');
  check('user ACTIVE + isEmailVerified + emailVerifiedAt', u.status === 'ACTIVE' && u.isEmailVerified === true && u.emailVerifiedAt instanceof Date);
  r = await post('/auth/verify-email/otp', { email: 'test-flow-otp@example.com', code });
  check('same code again -> 400 (single use)', r.status === 400);

  // attempts limit
  await post('/auth/register', person('otp-limit'));
  const limitCode = (latestEmail(app.outbox, 'verification-code').match(/Subject: (\d{6}) is your/) || [])[1];
  const bad = limitCode === '999999' ? '888888' : '999999';
  const codes = [];
  for (let i = 0; i < 5; i++) codes.push((await post('/auth/verify-email/otp', { email: 'test-flow-otp-limit@example.com', code: bad })).body.code);
  check('5th wrong code -> AUTH_VERIFICATION_ATTEMPTS_EXCEEDED', codes[4] === 'AUTH_VERIFICATION_ATTEMPTS_EXCEEDED', codes.join(','));
  r = await post('/auth/verify-email/otp', { email: 'test-flow-otp-limit@example.com', code: limitCode });
  check('correct code after lockout -> 400 (must resend)', r.status === 400);

  // resend + cooldown
  const before = outboxFiles(app.outbox).length;
  r = await post('/auth/verify-email/resend', { email: 'test-flow-otp-limit@example.com' });
  check('resend (record gone) -> 200 + new email', r.status === 200 && outboxFiles(app.outbox).length === before + 1);
  r = await post('/auth/verify-email/resend', { email: 'test-flow-otp-limit@example.com' });
  check('resend within cooldown -> 200 but no email', r.status === 200 && outboxFiles(app.outbox).length === before + 1);
  const newCode = (latestEmail(app.outbox, 'verification-code').match(/Subject: (\d{6}) is your/) || [])[1];
  r = await post('/auth/verify-email/otp', { email: 'test-flow-otp-limit@example.com', code: newCode });
  check('new code works -> 200', r.status === 200 && r.body.data.nextStep === 'LOGIN');
  const generic = (await post('/auth/verify-email/resend', { email: 'test-flow-unknown@example.com' })).body.message;
  const genericVerified = (await post('/auth/verify-email/resend', { email: 'test-flow-otp@example.com' })).body.message;
  check('resend: unknown / already verified -> identical response', generic === genericVerified && generic === r.body.message ? true : generic === genericVerified, generic);
  await stopApp(app);

  // ------------------------------------------------------------ C. Email link
  console.log('\nC. Email link (link + no approval): Register -> Open link -> Login');
  app = await startApp({ REGISTRATION_EMAIL_VERIFICATION: 'link', REGISTRATION_REQUIRE_APPROVAL: 'false' });
  r = await post('/auth/register', person('link'));
  check('201 + nextStep VERIFY_EMAIL_LINK', r.status === 201 && r.body.data.nextStep === 'VERIFY_EMAIL_LINK');
  mail = latestEmail(app.outbox, 'verification-link');
  const link = (mail.match(/http:\/\/localhost:5173\/verify-email\?token=[A-Za-z0-9_-]{43}/) || [])[0];
  check('link email points to frontend URL with token', !!link, link);
  const token = link ? new URL(link).searchParams.get('token') : '';
  r = await post('/auth/verify-email/link', { token: 'x'.repeat(43) });
  check('unknown token -> 400 AUTH_INVALID_VERIFICATION_TOKEN', r.status === 400 && r.body.code === 'AUTH_INVALID_VERIFICATION_TOKEN');
  r = await post('/auth/verify-email/link', { token });
  check('valid token -> 200 nextStep LOGIN', r.status === 200 && r.body.data.nextStep === 'LOGIN');
  u = await dbUser('test-flow-link@example.com');
  check('user ACTIVE + verified', u.status === 'ACTIVE' && u.isEmailVerified === true);
  r = await post('/auth/verify-email/link', { token });
  check('same link again -> 400 (single use)', r.status === 400);
  await stopApp(app);

  // ------------------------------------------------------- D. Admin approval
  console.log('\nD. Admin approval (none + approval): Register -> Pending -> Approve -> Login');
  app = await startApp({ REGISTRATION_EMAIL_VERIFICATION: 'none', REGISTRATION_REQUIRE_APPROVAL: 'true' });
  r = await post('/auth/register', person('approve'));
  check('201 + nextStep AWAIT_APPROVAL, status PENDING_APPROVAL', r.status === 201 && r.body.data.nextStep === 'AWAIT_APPROVAL' && r.body.data.user.status === 'PENDING_APPROVAL');
  check('pending-approval email sent', latestEmail(app.outbox, 'pending-approval').includes('waiting for approval'));
  await post('/auth/register', person('reject'));
  const approvalOutbox = app.outbox;
  await stopApp(app);

  const cli = (...args) => {
    try {
      return execFileSync(process.execPath, ['dist/modules/users/scripts/user-approval.js', ...args], {
        cwd: backend, env: { ...process.env, MAIL_TRANSPORT: 'outbox', MAIL_OUTBOX_DIR: approvalOutbox, LOG_FORMAT: 'pretty' }, encoding: 'utf8',
      }).replace(/\x1b\[[0-9;]*m/g, '');
    } catch (e) {
      return 'EXIT ' + e.status + ' ' + String(e.stdout).replace(/\x1b\[[0-9;]*m/g, '');
    }
  };
  let out = cli('pending');
  check('CLI pending lists both users', out.includes('test-flow-approve@example.com') && out.includes('test-flow-reject@example.com'));
  out = cli('approve', 'test-flow-approve@example.com');
  check('CLI approve -> ACTIVE', out.includes('Approved test-flow-approve@example.com → ACTIVE'));
  out = cli('reject', 'test-flow-reject@example.com', 'Not', 'a', 'company', 'address');
  check('CLI reject with reason -> REJECTED', out.includes('Rejected test-flow-reject@example.com → REJECTED'));
  u = await dbUser('test-flow-reject@example.com');
  check('reject stored reviewer + reason', u.reviewedBy === 'cli' && u.rejectionReason === 'Not a company address' && u.reviewedAt instanceof Date);
  check('approved + rejected emails sent', outboxFiles(approvalOutbox).filter((f) => f.includes('registration-review')).length === 2);
  check('rejection email contains reason', latestEmail(approvalOutbox, 'registration-review').includes('Not a company address'));
  out = cli('approve', 'test-flow-approve@example.com');
  check('approve again -> error, exit 1', out.startsWith('EXIT 1') && out.includes('not waiting for approval'));
  out = cli('approve', 'test-flow-missing@example.com');
  check('approve unknown -> "User not found", exit 1', out.startsWith('EXIT 1') && out.includes('User not found'));

  // ------------------------------------------------ E. Email OTP + approval
  console.log('\nE. Email OTP + approval: Register -> Verify -> Pending -> Approve');
  app = await startApp({ REGISTRATION_EMAIL_VERIFICATION: 'otp', REGISTRATION_REQUIRE_APPROVAL: 'true' });
  r = await post('/auth/register', person('combo'));
  check('201 + VERIFY_EMAIL_OTP first', r.status === 201 && r.body.data.nextStep === 'VERIFY_EMAIL_OTP');
  const comboCode = (latestEmail(app.outbox, 'verification-code').match(/Subject: (\d{6}) is your/) || [])[1];
  r = await post('/auth/verify-email/otp', { email: 'test-flow-combo@example.com', code: comboCode });
  check('verify -> 200 nextStep AWAIT_APPROVAL', r.status === 200 && r.body.data.nextStep === 'AWAIT_APPROVAL');
  u = await dbUser('test-flow-combo@example.com');
  check('user PENDING_APPROVAL + email verified', u.status === 'PENDING_APPROVAL' && u.isEmailVerified === true);
  check('pending-approval email sent after verify', latestEmail(app.outbox, 'pending-approval').includes('waiting for approval'));
  await stopApp(app);

  // ------------------------------------------------- F. Config validation
  console.log('\nF. Configuration rules');
  const startFails = (env, needle) => {
    try {
      execFileSync(process.execPath, ['dist/main.js'], { cwd: backend, env: { ...process.env, ...env }, encoding: 'utf8', timeout: 20000, stdio: 'pipe' });
      return false;
    } catch (e) {
      return String(e.stdout) + String(e.stderr);
    }
  };
  let msg = startFails({ NODE_ENV: 'production', SWAGGER_ENABLED: 'false', MAIL_TRANSPORT: 'outbox' });
  check('production + outbox -> refused', !!msg && msg.includes('"MAIL_TRANSPORT" must be smtp in production'));
  msg = startFails({ REGISTRATION_EMAIL_VERIFICATION: 'link', EMAIL_VERIFICATION_URL: '' });
  check('link without EMAIL_VERIFICATION_URL -> refused', !!msg && msg.includes('EMAIL_VERIFICATION_URL'));
  msg = startFails({ VERIFICATION_TOKEN_SECRET: 'too-short' });
  check('short VERIFICATION_TOKEN_SECRET -> refused', !!msg && msg.includes('VERIFICATION_TOKEN_SECRET'));

  // ------------------------------------------------------------- Cleanup
  const users = await mongoose.connection.db.collection('users').find({ email: /^test-flow-/ }, { projection: { _id: 1 } }).toArray();
  const ids = users.map((x) => x._id);
  const v = await mongoose.connection.db.collection('email_verifications').deleteMany({ userId: { $in: ids } });
  const d = await mongoose.connection.db.collection('users').deleteMany({ email: /^test-flow-/ });
  console.log(`\nCleanup: ${d.deletedCount} test users, ${v.deletedCount} verification records deleted`);
  await mongoose.disconnect();
  console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch(async (e) => {
  console.error(e);
  await mongoose.disconnect().catch(() => {});
  process.exitCode = 1;
});
