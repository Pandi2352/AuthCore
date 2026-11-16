// End-to-end tests for the password policy module.
// Run with: npm run test:e2e -- policy   (see test/e2e/README.md)
const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const backend = process.argv[2] || path.resolve(__dirname, '..', '..', '..');
const req = (m) => require(path.join(backend, 'node_modules', m));
const mongoose = req('mongoose');
const BASE = `http://localhost:${process.env.E2E_PORT || 3000}/api/v1`;
const PW = 'Str0ng!Passw0rd';
const DAY = 86_400_000;
let failures = 0;
let ipCounter = 1;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (label, ok, detail = '') => {
  if (!ok) failures++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail !== '' ? `  -> ${detail}` : ''}`);
};
const freshIp = () => `10.98.${Math.floor(ipCounter / 250)}.${(ipCounter++ % 250) + 1}`;
async function call(method, route, { body, token } = {}) {
  const headers = { 'X-Forwarded-For': freshIp(), 'User-Agent': 'policy-test' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE + route, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, body: await res.json() };
}
const emails = (dir, tpl) => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.eml') && f.includes(tpl)) : []);

const POLICY = () => ({
  policyName: 'corporate',
  characterLength: { minimum: 10, maximum: 64 },
  complexity: { minimumDigitCount: 2, minimumSpecialCharacterCount: 1, requireUpperAndLowerCase: true, minimumUppercaseCount: 0, minimumLowercaseCount: 0 },
  passwordHistory: { preventReuse: true, historyCount: 2 },
  additionalRules: { blockCommonPasswords: true, blockCompromisedPasswords: false, preventPersonalInfoInPassword: true, allowWhitespace: false, maximumRepeatedCharacters: 3, minimumPasswordAgeHours: 0 },
  passwordValidity: { enabled: false, validityDays: 90, notificationDaysBeforeExpiry: [14, 7, 3], gracePeriodDays: 0, forceChangeOnExpiry: true },
});

async function main() {
  await mongoose.connect((process.env.E2E_MONGODB_URI || 'mongodb://localhost:27017/authcore_e2e'));
  const db = mongoose.connection.db;
  const users = db.collection('users');
  const col = (n) => db.collection(n);
  const email = (tag) => `test-pp-${tag}@example.com`;
  const cleanup = async () => {
    const ids = (await users.find({ email: /^test-pp-/ }).toArray()).map((u) => u._id);
    await col('sessions').deleteMany({ userId: { $in: ids } });
    await col('login_attempts').deleteMany({ key: { $in: ids.map((id) => `user:${id}`) } });
    await col('password_expiry_notifications').deleteMany({ userId: { $in: ids } });
    await col('password_policy_audit_logs').deleteMany({ changedBy: { $in: ids } });
    await col('password_policies').deleteMany({});
    await col('password_scheduler_configs').deleteMany({});
    await users.deleteMany({ _id: { $in: ids } });
  };
  await cleanup();

  const outbox = fs.mkdtempSync(path.join(os.tmpdir(), 'pp-outbox-'));
  const env = { ...process.env, TRUST_PROXY_HOPS: '1', LOG_FORMAT: 'json', MAIL_TRANSPORT: 'outbox', MAIL_OUTBOX_DIR: outbox,
    REGISTRATION_EMAIL_VERIFICATION: 'none', REGISTRATION_REQUIRE_APPROVAL: 'false', SCHEDULER_POLL_SECONDS: '5' };
  const logs = [];
  const child = spawn(process.execPath, ['dist/main.js'], { cwd: backend, env, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', (d) => logs.push(String(d)));
  child.stderr.on('data', (d) => logs.push(String(d)));
  for (let i = 0; i < 80; i++) { try { if ((await fetch(BASE + '/health/live')).ok) break; } catch {} await sleep(250); }

  const register = (tag, password = PW, firstName = 'Samantha') => call('POST', '/auth/register', { body: { email: email(tag), password, firstName } });
  const login = async (tag, password = PW) => call('POST', '/auth/login', { body: { email: email(tag), password } });
  const token = async (tag, password = PW) => (await login(tag, password)).body.data?.accessToken;
  const uid = async (tag) => (await users.findOne({ email: email(tag) }))._id;

  console.log('\n1. Roles');
  await register('admin');
  await register('user');
  let r = await call('GET', '/password-policies');
  check('no token -> 401', r.status === 401);
  const userAt = await token('user');
  r = await call('GET', '/password-policies', { token: userAt });
  check('USER role -> 403 FORBIDDEN', r.status === 403 && r.body.code === 'FORBIDDEN');
  check('new users get role USER (shown in profile)', (await call('GET', '/auth/me', { token: userAt })).body.data.role === 'USER');
  const adminAt = await token('admin');
  const cli = spawnSync(process.execPath, ['dist/modules/users/scripts/user-role.js', email('admin'), 'ADMIN'], { cwd: backend, env: { ...env, LOG_FORMAT: 'pretty' }, encoding: 'utf8' });
  check('CLI users:role grants ADMIN', cli.status === 0 && (await users.findOne({ email: email('admin') })).role === 'ADMIN', cli.stderr.slice(-200));
  const bad = spawnSync(process.execPath, ['dist/modules/users/scripts/user-role.js', email('admin'), 'ROOT'], { cwd: backend, env: { ...env, LOG_FORMAT: 'pretty' }, encoding: 'utf8' });
  check('CLI rejects unknown role', bad.status !== 0);
  r = await call('GET', '/password-policies', { token: adminAt });
  check('ADMIN (existing token, no re-login) -> 200 built-in default', r.status === 200 && r.body.data.isDefault === true && r.body.data.version === 0 && r.body.message === 'Password policy retrieved successfully');
  const d = r.body.data;
  check('default = Test@123 format: 8–64, 1 digit, 1 special, upper+lower, history 5', d.characterLength.minimum === 8 && d.characterLength.maximum === 64 && d.complexity.minimumDigitCount === 1 && d.complexity.minimumSpecialCharacterCount === 1 && d.complexity.requireUpperAndLowerCase && d.passwordHistory.historyCount === 5 && d.passwordValidity.enabled === false);

  console.log('\n2. Public requirements + validate');
  r = await call('GET', '/password-policies/requirements');
  check('requirements public, numbers + readable rules', r.status === 200 && r.body.data.minimumLength === 8 && r.body.data.minimumUppercaseCount === 1 && r.body.data.rules.includes('8–64 characters'), JSON.stringify(r.body.data.rules));
  const validate = async (password, extra = {}) => (await call('POST', '/password-policies/validate', { body: { password, ...extra } })).body.data;
  let v = await validate('Test@123');
  check('"Test@123" is valid under the default policy', v.isValid === true && v.violations.length === 0);
  v = await validate('test@123');
  check('no uppercase -> minimumUppercaseCount', !v.isValid && v.violations.map((x) => x.rule).join() === 'minimumUppercaseCount');
  v = await validate('ab');
  check('"ab": every broken rule listed at once', ['minimumLength', 'minimumUppercaseCount', 'minimumDigitCount', 'minimumSpecialCharacterCount'].every((x) => v.violations.some((y) => y.rule === x)), v.violations.map((x) => x.rule).join());
  v = await validate('Password@123');
  check('common password -> blockCommonPasswords', v.violations.some((x) => x.rule === 'blockCommonPasswords'));
  v = await validate('Samantha@1', { firstName: 'Samantha' });
  check('contains first name -> preventPersonalInfoInPassword', v.violations.some((x) => x.rule === 'preventPersonalInfoInPassword'));
  v = await validate('Test @123');
  check('space -> allowWhitespace', v.violations.some((x) => x.rule === 'allowWhitespace'));
  r = await call('POST', '/password-policies/validate', { body: { password: 'Secret#Value9' } });
  check('response never echoes the password', !JSON.stringify(r.body).includes('Secret#Value9'));
  r = await call('POST', '/password-policies/validate', { body: { password: 'x'.repeat(129) } });
  check('over the hard cap (128) -> 400', r.status === 400);

  console.log('\n3. Enforcement with the default policy');
  r = await register('fmt', 'Test@123', 'Jane');
  check('register with "Test@123" -> 201', r.status === 201);
  r = await register('weak', 'weakpass', 'Jane');
  check('weak -> 400 VALIDATION_FAILED, one entry per broken rule (field password)', r.status === 400 && r.body.code === 'VALIDATION_FAILED' && r.body.errors.length >= 3 && r.body.errors.every((e) => e.field === 'password'), JSON.stringify(r.body.errors));

  console.log('\n4. Update policy (validation, audit)');
  let p = POLICY(); p.characterLength = { minimum: 20, maximum: 12 };
  r = await call('PUT', '/password-policies', { token: adminAt, body: p });
  check('min > max -> 400 INVALID_PASSWORD_POLICY at characterLength.minimum', r.status === 400 && r.body.code === 'INVALID_PASSWORD_POLICY' && r.body.message === 'Password policy validation failed' && r.body.errors[0].field === 'characterLength.minimum' && r.body.errors[0].message === 'Minimum length cannot exceed maximum length');
  p = POLICY(); p.passwordValidity.notificationDaysBeforeExpiry = [100];
  r = await call('PUT', '/password-policies', { token: adminAt, body: p });
  check('reminder day >= validityDays -> 400 INVALID_PASSWORD_POLICY', r.status === 400 && r.body.errors.some((e) => e.field === 'passwordValidity.notificationDaysBeforeExpiry'));
  p = POLICY(); p.characterLength.minimum = 6;
  r = await call('PUT', '/password-policies', { token: adminAt, body: p });
  check('minimum below 8 -> 400 VALIDATION_FAILED (nested field path)', r.status === 400 && r.body.code === 'VALIDATION_FAILED' && r.body.errors[0].field === 'characterLength.minimum', JSON.stringify(r.body.errors));
  p = POLICY(); p.complexity.minimumDigitCount = -1;
  r = await call('PUT', '/password-policies', { token: adminAt, body: p });
  check('negative count -> 400', r.status === 400);
  p = POLICY(); p.passwordHistory.preventReuse = 'yes';
  r = await call('PUT', '/password-policies', { token: adminAt, body: p });
  check('non-boolean -> 400', r.status === 400);
  p = POLICY(); p.isAdmin = true;
  r = await call('PUT', '/password-policies', { token: adminAt, body: p });
  check('unknown field (mass assignment) -> 400', r.status === 400);
  p = POLICY(); delete p.complexity;
  r = await call('PUT', '/password-policies', { token: adminAt, body: p });
  check('missing group -> 400', r.status === 400);
  r = await call('PUT', '/password-policies', { token: userAt, body: POLICY() });
  check('USER cannot update -> 403', r.status === 403);
  r = await call('PUT', '/password-policies', { token: adminAt, body: POLICY() });
  check('valid update -> 200, version 1, saved', r.status === 200 && r.body.data.isDefault === false && r.body.data.version === 1 && r.body.data.characterLength.minimum === 10 && r.body.message === 'Password policy updated successfully');
  p = POLICY(); p.characterLength.minimum = 12; p.passwordHistory = { preventReuse: false, historyCount: 7 };
  r = await call('PUT', '/password-policies', { token: adminAt, body: p });
  check('second update -> version 2; historyCount forced to 0 when preventReuse is off', r.body.data.version === 2 && r.body.data.passwordHistory.historyCount === 0);
  r = await call('GET', '/password-policies/history', { token: adminAt });
  const h = r.body.data;
  check('history: newest first, UPDATE then CREATE, paginated meta', r.status === 200 && h[0].action === 'UPDATE' && h[1].action === 'CREATE' && r.body.meta.totalItems === 2);
  check('history: changed fields, old/new values, who and IP', JSON.stringify(h[0].changedFields) === JSON.stringify(['characterLength.minimum', 'passwordHistory.preventReuse', 'passwordHistory.historyCount']) && h[0].oldValues.characterLength.minimum === 10 && h[0].newValues.characterLength.minimum === 12 && h[0].changedBy === String(await uid('admin')) && !!h[0].ipAddress, JSON.stringify(h[0].changedFields));
  check('history: no passwords or hashes', !/passwordHash|argon2|Str0ng/.test(JSON.stringify(h)));
  check('user cannot read history -> 403', (await call('GET', '/password-policies/history', { token: userAt })).status === 403);
  r = await call('PUT', '/password-policies', { token: adminAt, body: POLICY() });

  console.log('\n5. New policy is enforced immediately');
  r = await register('new1', 'Test@123', 'Jane');
  check('"Test@123" now rejected (minimum 10 characters)', r.status === 400 && r.body.errors.length === 1 && /at least 10 characters/.test(r.body.errors[0].message), JSON.stringify(r.body.errors));
  r = await register('new1', 'Testing@1x', 'Jane');
  check('"Testing@1x" rejected (2 digits required)', r.status === 400 && r.body.errors.some((e) => /at least 2 digits/.test(e.message)), JSON.stringify(r.body.errors));
  v = await validate('Teeeest@12345');
  check('4 identical characters in a row -> maximumRepeatedCharacters', v.violations.some((x) => x.rule === 'maximumRepeatedCharacters'));
  r = await register('new2', 'Valid#Pass12', 'Jane');
  check('compliant password -> 201', r.status === 201);
  r = await call('GET', '/password-policies/requirements');
  check('requirements follow the policy', r.body.data.minimumLength === 10 && r.body.data.minimumDigitCount === 2 && r.body.data.passwordHistoryCount === 2);
  r = await call('PATCH', '/auth/change-password', { token: userAt, body: { currentPassword: PW, newPassword: 'short1!A', confirmPassword: 'short1!A' } });
  check('change-password uses the policy too', r.status === 400 && r.body.code === 'VALIDATION_FAILED');

  console.log('\n6. History and minimum age from the policy');
  p = POLICY(); p.passwordHistory = { preventReuse: false, historyCount: 0 };
  await call('PUT', '/password-policies', { token: adminAt, body: p });
  r = await call('PATCH', '/auth/change-password', { token: userAt, body: { currentPassword: PW, newPassword: PW, confirmPassword: PW } });
  check('preventReuse off -> the current password may be set again', r.status === 200, r.body.code);
  p = POLICY(); p.passwordHistory = { preventReuse: true, historyCount: 0 };
  await call('PUT', '/password-policies', { token: adminAt, body: p });
  r = await call('PATCH', '/auth/change-password', { token: userAt, body: { currentPassword: PW, newPassword: PW, confirmPassword: PW } });
  check('preventReuse on, historyCount 0 -> current blocked', r.status === 400 && r.body.code === 'AUTH_PASSWORD_REUSED');
  p = POLICY(); p.additionalRules.minimumPasswordAgeHours = 24;
  await call('PUT', '/password-policies', { token: adminAt, body: p });
  r = await call('PATCH', '/auth/change-password', { token: userAt, body: { currentPassword: PW, newPassword: 'Another#Pass12', confirmPassword: 'Another#Pass12' } });
  check('minimum password age 24h -> 400 AUTH_PASSWORD_CHANGED_TOO_RECENTLY', r.status === 400 && r.body.code === 'AUTH_PASSWORD_CHANGED_TOO_RECENTLY');

  console.log('\n7. Password validity (expiry)');
  p = POLICY(); p.passwordValidity = { enabled: true, validityDays: 30, notificationDaysBeforeExpiry: [7, 3], gracePeriodDays: 0, forceChangeOnExpiry: true };
  p.additionalRules.minimumPasswordAgeHours = 24;
  await call('PUT', '/password-policies', { token: adminAt, body: p });
  await users.updateOne({ email: email('user') }, { $set: { passwordChangedAt: new Date(Date.now() - 31 * DAY) } });
  r = await login('user');
  check('expired: login still 200, isPasswordChangeRequired true, passwordExpiresAt in the past', r.status === 200 && r.body.data.isPasswordChangeRequired === true && new Date(r.body.data.passwordExpiresAt) < new Date());
  const expAt = r.body.data.accessToken;
  r = await call('GET', '/auth/sessions', { token: expAt });
  check('other routes -> 403 AUTH_PASSWORD_EXPIRED', r.status === 403 && r.body.code === 'AUTH_PASSWORD_EXPIRED');
  check('/auth/me still allowed', (await call('GET', '/auth/me', { token: expAt })).status === 200);
  r = await call('PATCH', '/auth/change-password', { token: expAt, body: { currentPassword: PW, newPassword: 'Renewed#Pass12', confirmPassword: 'Renewed#Pass12' } });
  check('change-password allowed (minimum age does not block an expired password)', r.status === 200, r.body.code);
  check('after the change: routes work again', (await call('GET', '/auth/sessions', { token: expAt })).status === 200);
  r = await login('user', 'Renewed#Pass12');
  check('login: not required anymore, expires in ~30 days', r.body.data.isPasswordChangeRequired === false && Math.abs(new Date(r.body.data.passwordExpiresAt) - Date.now() - 30 * DAY) < 60_000);
  p.passwordValidity.gracePeriodDays = 5;
  await call('PUT', '/password-policies', { token: adminAt, body: p });
  await users.updateOne({ email: email('user') }, { $set: { passwordChangedAt: new Date(Date.now() - 32 * DAY) } });
  r = await login('user', 'Renewed#Pass12');
  check('within grace period: expired but not yet required', r.body.data.isPasswordChangeRequired === false && new Date(r.body.data.passwordExpiresAt) < new Date());
  p.passwordValidity.gracePeriodDays = 0; p.passwordValidity.forceChangeOnExpiry = false;
  await call('PUT', '/password-policies', { token: adminAt, body: p });
  r = await login('user', 'Renewed#Pass12');
  check('forceChangeOnExpiry off: informational only', r.body.data.isPasswordChangeRequired === false && (await call('GET', '/auth/sessions', { token: r.body.data.accessToken })).status === 200);
  await users.updateOne({ email: email('user') }, { $set: { passwordChangedAt: new Date() } });

  console.log('\n8. Scheduler configuration');
  const userAt2 = await token('user', 'Renewed#Pass12');
  r = await call('GET', '/password-policies/schedulers', { token: adminAt });
  check('default: disabled, never run', r.status === 200 && r.body.data.passwordExpiryNotification.enabled === false && r.body.data.passwordExpiryNotification.lastExecutionStatus === 'NEVER');
  const sched = (s) => call('PUT', '/password-policies/schedulers', { token: adminAt, body: { passwordExpiryNotification: s } });
  r = await sched({ enabled: true, frequency: 'DAILY', executionTime: '09:00', timezone: 'Mars/Olympus' });
  check('invalid timezone -> 400', r.status === 400 && r.body.errors[0].field.includes('timezone'));
  r = await sched({ enabled: true, frequency: 'DAILY', executionTime: '25:00', timezone: 'UTC' });
  check('invalid time -> 400', r.status === 400);
  r = await sched({ enabled: true, frequency: 'YEARLY', executionTime: '09:00', timezone: 'UTC' });
  check('invalid frequency -> 400', r.status === 400);
  r = await call('PUT', '/password-policies/schedulers', { token: userAt2, body: { passwordExpiryNotification: { enabled: true, frequency: 'DAILY', executionTime: '09:00', timezone: 'UTC' } } });
  check('USER cannot configure -> 403', r.status === 403);
  r = await sched({ enabled: true, frequency: 'DAILY', executionTime: '09:00', timezone: 'Asia/Kolkata' });
  let next = new Date(r.body.data.passwordExpiryNotification.nextExecutionAt);
  check('DAILY 09:00 Asia/Kolkata -> next run at 03:30 UTC within 24h', r.status === 200 && next.getUTCHours() === 3 && next.getUTCMinutes() === 30 && next > new Date() && next - Date.now() <= DAY, next.toISOString());
  r = await sched({ enabled: true, frequency: 'HOURLY', executionTime: '00:15', timezone: 'UTC' });
  next = new Date(r.body.data.passwordExpiryNotification.nextExecutionAt);
  check('HOURLY :15 -> next run at minute 15 within 1h', next.getUTCMinutes() === 15 && next - Date.now() <= 3_600_000 && next > new Date(), next.toISOString());
  r = await sched({ enabled: true, frequency: 'WEEKLY', executionTime: '02:00', timezone: 'America/New_York', dayOfWeek: 7 });
  next = new Date(r.body.data.passwordExpiryNotification.nextExecutionAt);
  const nyParts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', hourCycle: 'h23' }).format(next);
  check('WEEKLY Sunday 02:00 New York (DST-aware)', /Sun/.test(nyParts) && /\b02\b|\b2\b/.test(nyParts) && next - Date.now() <= 7 * DAY, `${next.toISOString()} = ${nyParts}`);
  r = await sched({ enabled: true, frequency: 'MONTHLY', executionTime: '06:00', timezone: 'UTC', dayOfMonth: 1 });
  next = new Date(r.body.data.passwordExpiryNotification.nextExecutionAt);
  check('MONTHLY day 1 06:00 UTC', next.getUTCDate() === 1 && next.getUTCHours() === 6);

  console.log('\n9. Expiry reminder job');
  p = POLICY(); p.passwordValidity = { enabled: true, validityDays: 30, notificationDaysBeforeExpiry: [7, 3], gracePeriodDays: 0, forceChangeOnExpiry: true };
  await call('PUT', '/password-policies', { token: adminAt, body: p });
  for (const t of ['e5', 'e2', 'e20']) await register(t, PW, 'Remi');
  await users.updateOne({ email: email('e5') }, { $set: { passwordChangedAt: new Date(Date.now() - 25 * DAY) } });
  await users.updateOne({ email: email('e2') }, { $set: { passwordChangedAt: new Date(Date.now() - 28.5 * DAY) } });
  await users.updateOne({ email: email('e20') }, { $set: { passwordChangedAt: new Date(Date.now() - 10 * DAY) } });
  r = await call('POST', '/password-policies/schedulers/password-expiry-notification/run', { token: adminAt });
  check('run now -> 200 SUCCESS with summary', r.status === 200 && r.body.data.status === 'SUCCESS' && r.body.data.summary.sent >= 2, JSON.stringify(r.body.data));
  const recs = await col('password_expiry_notifications').find({ userId: { $in: [await uid('e5'), await uid('e2'), await uid('e20')] } }).toArray();
  const byUser = async (t) => { const id = String(await uid(t)); return recs.filter((x) => x.userId === id); };
  check('5 days left -> "7 days" reminder; 2 days left -> "3 days" reminder; 20 days -> none', (await byUser('e5'))[0]?.daysBeforeExpiry === 7 && (await byUser('e2'))[0]?.daysBeforeExpiry === 3 && (await byUser('e20')).length === 0 && recs.every((x) => x.status === 'SENT'));
  const reminderFiles = emails(outbox, 'password-expiry-reminder');
  const mails = reminderFiles.map((f) => fs.readFileSync(path.join(outbox, f), 'utf8'));
  check('reminder emails sent ("expires in 5 days" / "in 2 days")', mails.some((m) => m.includes(email('e5')) && /expires in 5 days/.test(m)) && mails.some((m) => m.includes(email('e2')) && /expires in 2 days/.test(m)));
  const before = reminderFiles.length;
  r = await call('POST', '/password-policies/schedulers/password-expiry-notification/run', { token: adminAt });
  check('second run: no duplicates (alreadyNotified)', r.body.data.summary.sent === 0 && r.body.data.summary.alreadyNotified >= 2 && emails(outbox, 'password-expiry-reminder').length === before, JSON.stringify(r.body.data.summary));
  check('run by USER -> 403', (await call('POST', '/password-policies/schedulers/password-expiry-notification/run', { token: userAt2 })).status === 403);
  await col('password_scheduler_configs').updateOne({ job: 'PASSWORD_EXPIRY_NOTIFICATION' }, { $set: { lockedUntil: new Date(Date.now() + 60_000), lockedBy: 'other-instance' } });
  r = await call('POST', '/password-policies/schedulers/password-expiry-notification/run', { token: adminAt });
  check('locked by another instance -> 409', r.status === 409);
  await col('password_scheduler_configs').updateOne({ job: 'PASSWORD_EXPIRY_NOTIFICATION' }, { $set: { lockedUntil: null, lockedBy: null } });

  console.log('\n10. Automatic run when due');
  await col('password_expiry_notifications').deleteMany({ userId: String(await uid('e5')) });
  await col('password_scheduler_configs').updateOne({ job: 'PASSWORD_EXPIRY_NOTIFICATION' }, { $set: { enabled: true, nextExecutionAt: new Date(Date.now() - 1000), lastExecutedAt: null } });
  let cfg;
  for (let i = 0; i < 30; i++) { await sleep(500); cfg = await col('password_scheduler_configs').findOne({ job: 'PASSWORD_EXPIRY_NOTIFICATION' }); if (cfg.lastExecutedAt && cfg.lockedBy === null) break; }
  check('due job ran by itself (poll), status SUCCESS, lock released', cfg.lastExecutedAt !== null && cfg.lastExecutionStatus === 'SUCCESS' && cfg.lockedBy === null);
  check('next execution moved into the future', new Date(cfg.nextExecutionAt) > new Date());
  check('the deleted reminder was sent again (retry path)', (await col('password_expiry_notifications').countDocuments({ userId: String(await uid('e5')), status: 'SENT' })) === 1);
  r = await call('GET', '/password-policies/schedulers', { token: adminAt });
  check('GET schedulers shows last / next execution and summary', !!r.body.data.passwordExpiryNotification.lastExecutedAt && !!r.body.data.passwordExpiryNotification.lastExecutionSummary);
  r = await call('GET', '/password-policies/history?limit=100', { token: adminAt });
  check('scheduler changes are audited', r.body.data.some((e) => e.target === 'scheduler:PASSWORD_EXPIRY_NOTIFICATION'));

  console.log('\n11. Logs');
  const logText = logs.join('');
  check('no passwords in logs', ![PW, 'Test@123', 'Secret#Value9', 'Renewed#Pass12', 'Valid#Pass12'].some((s) => logText.includes(s)));
  check('policy changes and job runs logged', logText.includes('Password policy updated') && logText.includes('Scheduled job finished') && logText.includes('Scheduler configuration updated'));

  child.kill();
  await sleep(600);
  await cleanup();
  await mongoose.disconnect();
  console.log(`\n${failures === 0 ? 'ALL PASSED' : `${failures} FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}
main().catch(async (e) => { console.error(e); process.exit(1); });
