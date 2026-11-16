// E2E: first administrator from BOOTSTRAP_ADMIN_* env.
// Run with: npm run test:e2e -- bootstrap   (see test/e2e/README.md)
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const backend = process.argv[2] || path.resolve(__dirname, '..', '..', '..');
const mongoose = require(path.join(backend, 'node_modules', 'mongoose'));
const BASE = `http://localhost:${process.env.E2E_PORT || 3000}/api/v1`;
const EMAIL = 'test-bs-admin@example.com';
let failures = 0;
let ipN = 1;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (label, ok, detail = '') => { if (!ok) failures++; console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${!ok && detail !== '' ? `  -> ${detail}` : ''}`); };
const dump = (r) => `${r.status} ${JSON.stringify(r.body).slice(0, 300)}`;
async function call(method, route, { body, token } = {}) {
  const headers = { 'X-Forwarded-For': `10.93.0.${(ipN++ % 250) + 1}`, 'User-Agent': 'bootstrap-test' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE + route, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, body: await res.json() };
}

async function main() {
  await mongoose.connect((process.env.E2E_MONGODB_URI || 'mongodb://localhost:27017/authcore_e2e'));
  const db = mongoose.connection.db;
  const users = db.collection('users');
  const cleanup = async () => {
    const u = (await users.find({ email: EMAIL }).toArray()).map((x) => x._id);
    for (const c of ['sessions', 'user_activities', 'known_devices', 'access_mappings']) await db.collection(c).deleteMany({ userId: { $in: u } });
    await db.collection('login_attempts').deleteMany({ key: { $in: u.map((i) => `user:${i}`) } });
    await users.deleteMany({ email: EMAIL });
  };
  await cleanup();
  const outbox = fs.mkdtempSync(path.join(os.tmpdir(), 'bs-'));
  let logs = [];
  const start = async (extra) => {
    logs = [];
    const proc = spawn(process.execPath, ['dist/main.js'], {
      cwd: backend,
      env: { ...process.env, TRUST_PROXY_HOPS: '1', LOG_FORMAT: 'json', MAIL_TRANSPORT: 'outbox', MAIL_OUTBOX_DIR: outbox, VIRUS_SCAN_ENABLED: 'false',
        BOOTSTRAP_ADMIN_ENABLED: 'true', BOOTSTRAP_ADMIN_EMAIL: EMAIL, BOOTSTRAP_ADMIN_PASSWORD: 'Test@123', BOOTSTRAP_ADMIN_MUST_CHANGE_PASSWORD: 'true', ...extra },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    proc.stdout.on('data', (d) => logs.push(String(d)));
    proc.stderr.on('data', (d) => logs.push(String(d)));
    for (let i = 0; i < 80; i++) { try { if ((await fetch(BASE + '/health/live')).ok) break; } catch {} await sleep(250); }
    await sleep(1500); // onApplicationBootstrap work
    return proc;
  };
  const stop = async (proc) => { proc.kill(); await sleep(800); };
  let r;

  console.log('\n1. First start creates the administrator');
  let child = await start({});
  let user = await users.findOne({ email: EMAIL });
  check('account created: ADMIN, ACTIVE, verified, source SYSTEM, by system', !!user && user.role === 'ADMIN' && user.status === 'ACTIVE' && user.isEmailVerified === true && user.source === 'SYSTEM' && user.createdBy === 'system', JSON.stringify(user && { role: user.role, status: user.status, src: user.source }));
  check('password stored hashed (Argon2), must change at first sign-in', user?.passwordHash?.startsWith('$argon2') && user.mustChangePassword === true);
  check('names from env (System Admin)', user?.firstName === 'System' && user.lastName === 'Admin');
  const logText = logs.join('');
  check('startup log mentions it, never the password or email', logText.includes('Bootstrap admin created') && !logText.includes('Test@123') && !logText.includes(EMAIL));
  r = await call('POST', '/auth/login', { body: { email: EMAIL, password: 'Test@123' } });
  check('sign in with the env credentials', r.status === 200 && r.body.data.user.role === 'ADMIN' && r.body.data.isPasswordChangeRequired === true, dump(r));
  let token = r.body.data?.accessToken;
  r = await call('GET', '/admin/users', { token });
  check('until the password is changed: 403 AUTH_PASSWORD_EXPIRED', r.status === 403 && r.body.code === 'AUTH_PASSWORD_EXPIRED', dump(r));
  r = await call('PATCH', '/auth/change-password', { token, body: { currentPassword: 'Test@123', newPassword: 'Kite!Blue2026x', confirmPassword: 'Kite!Blue2026x' } });
  check('change password', r.status === 200, dump(r));
  r = await call('GET', '/admin/users', { token });
  check('then full admin access', r.status === 200, dump(r));
  await stop(child);

  console.log('\n2. Restarts never overwrite the account');
  child = await start({ BOOTSTRAP_ADMIN_PASSWORD: 'Another!Pass2026', BOOTSTRAP_ADMIN_FIRST_NAME: 'Changed' });
  user = await users.findOne({ email: EMAIL });
  check('still one account, name unchanged', (await users.countDocuments({ email: EMAIL })) === 1 && user.firstName === 'System');
  check('own password still works; env password does not', (await call('POST', '/auth/login', { body: { email: EMAIL, password: 'Kite!Blue2026x' } })).status === 200 && (await call('POST', '/auth/login', { body: { email: EMAIL, password: 'Another!Pass2026' } })).status === 401);
  await stop(child);
  await users.updateOne({ email: EMAIL }, { $set: { role: 'USER', status: 'SUSPENDED' } });
  child = await start({});
  user = await users.findOne({ email: EMAIL });
  check('existing account in any state is left alone (role / status not reset)', user.role === 'USER' && user.status === 'SUSPENDED');
  await stop(child);
  await cleanup();

  console.log('\n3. Refused or skipped');
  child = await start({ BOOTSTRAP_ADMIN_PASSWORD: 'password1' });
  check('weak password (policy) -> not created, error logged, API up', !(await users.findOne({ email: EMAIL })) && logs.join('').includes('does not meet the password policy') && (await fetch(BASE + '/health/live')).ok);
  await stop(child);
  child = await start({ BOOTSTRAP_ADMIN_ENABLED: 'false' });
  check('BOOTSTRAP_ADMIN_ENABLED=false -> not created', !(await users.findOne({ email: EMAIL })));
  await stop(child);
  child = await start({ BOOTSTRAP_ADMIN_EMAIL: '', BOOTSTRAP_ADMIN_PASSWORD: '' });
  check('not configured -> skipped, API up', !(await users.findOne({ email: EMAIL })) && logs.join('').includes('Bootstrap admin not configured') && (await fetch(BASE + '/health/live')).ok);
  await stop(child);
  child = await start({ BOOTSTRAP_ADMIN_MUST_CHANGE_PASSWORD: 'false' });
  user = await users.findOne({ email: EMAIL });
  r = await call('POST', '/auth/login', { body: { email: EMAIL, password: 'Test@123' } });
  check('MUST_CHANGE_PASSWORD=false -> usable right away', user?.mustChangePassword === false && (await call('GET', '/admin/users', { token: r.body.data?.accessToken })).status === 200, dump(r));
  await stop(child);

  await cleanup();
  await mongoose.disconnect();
  console.log(`\n${failures === 0 ? 'ALL PASSED' : `${failures} FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
