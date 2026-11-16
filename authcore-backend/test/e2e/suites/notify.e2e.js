// E2E: new-device sign-in alerts, account-locked email, default groups, admin activity search.
// Run with: npm run test:e2e -- notify   (see test/e2e/README.md)
// Usage: node notify-test.js <backendDir>
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const backend = process.argv[2] || path.resolve(__dirname, '..', '..', '..');
const mongoose = require(path.join(backend, 'node_modules', 'mongoose'));
const BASE = `http://localhost:${process.env.E2E_PORT || 3000}/api/v1`;
const PW = 'Str0ng!Passw0rd';
let failures = 0;
let ipN = 1;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (label, ok, detail = '') => { if (!ok) failures++; console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${!ok && detail !== '' ? `  -> ${detail}` : ''}`); };
const dump = (r) => `${r.status} ${JSON.stringify(r.body).slice(0, 350)}`;
const UA = {
  chromeWin: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  chromeWinNew: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  firefoxLinux: 'Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0',
  safariMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
};
async function call(method, route, { body, token, ua = 'notify-test', ip } = {}) {
  const headers = { 'X-Forwarded-For': ip ?? `10.94.${Math.floor(ipN / 250)}.${(ipN++ % 250) + 1}`, 'User-Agent': ua };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE + route, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, body: await res.json() };
}
const email = (t) => `test-nt-${t}@example.com`;
let outbox;
const mails = (tpl, to) => fs.readdirSync(outbox).filter((f) => f.endsWith('.eml') && f.includes(tpl)).sort()
  .map((f) => fs.readFileSync(path.join(outbox, f), 'utf8').replace(/=\r?\n/g, '').replace(/=3D/g, '='))
  .filter((m) => !to || m.includes(`To: ${to}`));
async function waitMail(tpl, to, count = 1) { for (let i = 0; i < 30; i++) { if (mails(tpl, to).length >= count) break; await sleep(100); } return mails(tpl, to); }

async function main() {
  await mongoose.connect((process.env.E2E_MONGODB_URI || 'mongodb://localhost:27017/authcore_e2e'));
  const db = mongoose.connection.db;
  const col = (n) => db.collection(n);
  const ids = async () => (await col('users').find({ email: /^test-nt-/ }).toArray()).map((u) => u._id);
  const cleanup = async () => {
    const u = await ids();
    for (const c of ['sessions', 'user_activities', 'known_devices', 'account_codes']) await col(c).deleteMany({ userId: { $in: u } });
    await col('access_mappings').deleteMany({ $or: [{ userId: { $in: u } }, { assignedBy: { $in: u } }] });
    const groups = (await col('groups').find({ createdBy: { $in: u } }).toArray()).map((g) => g._id);
    await col('access_mappings').deleteMany({ groupId: { $in: groups } });
    for (const c of ['roles', 'groups']) await col(c).deleteMany({ createdBy: { $in: u } });
    await col('access_control_audit_logs').deleteMany({ $or: [{ changedBy: { $in: u } }, { entityId: { $in: u } }] });
    await col('login_attempts').deleteMany({ $or: [{ key: { $in: u.map((i) => `user:${i}`) } }, { key: /test-nt-/ }] });
    await col('user_invites').deleteMany({ email: /^test-nt-/ });
    await col('users').deleteMany({ _id: { $in: u } });
  };
  await cleanup();
  outbox = fs.mkdtempSync(path.join(os.tmpdir(), 'nt-'));
  const logs = [];
  const child = spawn(process.execPath, ['dist/main.js'], {
    cwd: backend,
    env: { ...process.env, TRUST_PROXY_HOPS: '1', LOG_FORMAT: 'json', MAIL_TRANSPORT: 'outbox', MAIL_OUTBOX_DIR: outbox, REGISTRATION_EMAIL_VERIFICATION: 'none', REGISTRATION_REQUIRE_APPROVAL: 'false',
      NEW_DEVICE_ALERTS_ENABLED: 'true', ACCOUNT_LOCKED_EMAIL_ENABLED: 'true', LOGIN_MAX_FAILED_ATTEMPTS: '3', LOGIN_LOCKOUT_MINUTES: '15', VIRUS_SCAN_ENABLED: 'false' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (d) => logs.push(String(d)));
  child.stderr.on('data', (d) => logs.push(String(d)));
  for (let i = 0; i < 80; i++) { try { if ((await fetch(BASE + '/health/live')).ok) break; } catch {} await sleep(250); }
  await sleep(500);

  const reg = (t) => call('POST', '/auth/register', { body: { email: email(t), password: PW, firstName: 'Nia' } });
  const login = (t, ua, ip, pw = PW) => call('POST', '/auth/login', { body: { email: email(t), password: pw }, ua, ip });
  const uid = async (t) => String((await col('users').findOne({ email: email(t) }))._id);
  for (const t of ['admin', 'u1', 'u2', 'acadmin']) await reg(t);
  await col('users').updateOne({ email: email('admin') }, { $set: { role: 'ADMIN' } });
  const A = (await login('admin')).body.data.accessToken;
  const u1 = await uid('u1');
  let r;

  console.log('\n1. New-device sign-in alerts');
  r = await login('u1', UA.chromeWin, '203.0.113.10');
  check('first ever sign-in: not a "new device", no email', r.status === 200 && r.body.data.isNewDevice === false && mails('new-device-login', email('u1')).length === 0, dump(r));
  const T1 = r.body.data.accessToken;
  r = await login('u1', UA.chromeWinNew, '203.0.113.11');
  check('same browser + OS, newer version: known', r.body.data.isNewDevice === false);
  r = await login('u1', UA.firefoxLinux, '198.51.100.7');
  check('Firefox on Linux: isNewDevice true', r.status === 200 && r.body.data.isNewDevice === true, dump(r));
  let m = await waitMail('new-device-login', email('u1'));
  check('"New sign-in" email with device and IP', m.length === 1 && /Firefox 128 on Linux/.test(m[0]) && m[0].includes('198.51.100.7') && /Subject: New sign-in to your/.test(m[0]), m[0]?.slice(0, 300));
  r = await login('u1', UA.firefoxLinux, '198.51.100.8');
  await sleep(300);
  check('same device again: no second email', r.body.data.isNewDevice === false && mails('new-device-login', email('u1')).length === 1);
  r = await call('GET', '/users/me/devices', { token: T1 });
  const devices = r.body.data;
  const chrome = devices?.find((d) => /Chrome/.test(d.deviceName));
  const firefox = devices?.find((d) => /Firefox/.test(d.deviceName));
  check('known devices list (most recent first, counts, IPs)', r.status === 200 && devices.length === 2 && devices[0].id === firefox.id && chrome.signInCount === 2 && firefox.signInCount === 2 && firefox.firstIpAddress === '198.51.100.7' && firefox.lastIpAddress === '198.51.100.8', dump(r));
  r = await call('DELETE', `/users/me/devices/${firefox.id}`, { token: T1 });
  check('forget a device', r.status === 200);
  r = await login('u1', UA.firefoxLinux, '198.51.100.9');
  check('forgotten device counts as new again (2nd email)', r.body.data.isNewDevice === true && (await waitMail('new-device-login', email('u1'), 2)).length === 2);
  const T2 = (await login('u2')).body.data.accessToken;
  check("another user's device -> 404", (await call('DELETE', `/users/me/devices/${chrome.id}`, { token: T2 })).status === 404);
  await call('PATCH', '/users/me/preferences', { token: T1, body: { notifications: { loginAlerts: false } } });
  r = await login('u1', UA.safariMac, '192.0.2.44');
  await sleep(400);
  check('loginAlerts off: still detected + recorded, no email', r.body.data.isNewDevice === true && mails('new-device-login', email('u1')).length === 2);
  r = await call('GET', '/users/me/activity?event=NEW_DEVICE_LOGIN', { token: T1 });
  check('NEW_DEVICE_LOGIN in my activity (3)', r.body.meta.totalItems === 3 && r.body.data[0].browser?.startsWith('Safari'), dump(r));

  console.log('\n2. Account locked email');
  for (let i = 0; i < 2; i++) await login('u2', UA.chromeWin, '203.0.113.99', 'Wrong!Pass000');
  check('no email before the limit', mails('account-locked', email('u2')).length === 0);
  r = await login('u2', UA.chromeWin, '203.0.113.99', 'Wrong!Pass000');
  m = await waitMail('account-locked', email('u2'));
  check('3rd failure locks: "temporarily locked" email (attempts, IP, unlock time)', m.length === 1 && /3 failed attempts/.test(m[0]) && m[0].includes('203.0.113.99') && /try again after/.test(m[0]), m[0]?.slice(0, 300));
  r = await login('u2', UA.chromeWin, '203.0.113.99');
  await sleep(300);
  check('while locked (even right password): 429, no second email', r.status === 429 && mails('account-locked', email('u2')).length === 1, dump(r));
  check('email never contains a password', !m[0].includes('Wrong!Pass000') && !m[0].includes(PW));
  for (let i = 0; i < 3; i++) await call('POST', '/auth/login', { body: { email: email('nobody'), password: 'Wrong!Pass000' } });
  await sleep(300);
  check('unknown email locked: nobody to email', mails('account-locked', email('nobody')).length === 0);

  console.log('\n3. Default groups');
  const role = (await call('POST', '/roles', { token: A, body: { roleKey: 'nt_reader', roleName: 'NT Reader', category: 'CUSTOM' } })).body.data;
  const userRead = (await col('permissions').findOne({ permissionKey: 'USER_READ' }))._id;
  await call('POST', '/access-mappings/role-permissions', { token: A, body: { roleId: role.id, permissionIds: [userRead] } });
  r = await call('POST', '/groups', { token: A, body: { category: 'TEAM', groupName: `NT Everyone ${Date.now()}`, isDefault: true } });
  const gDefault = r.body.data;
  check('create a default group', r.status === 201 && gDefault.isDefault === true, dump(r));
  await call('POST', '/access-mappings/group-roles', { token: A, body: { groupId: gDefault.id, roleIds: [role.id] } });
  const gInactive = (await call('POST', '/groups', { token: A, body: { category: 'TEAM', groupName: `NT Inactive ${Date.now()}`, isDefault: true, status: 'INACTIVE' } })).body.data;
  const gNormal = (await call('POST', '/groups', { token: A, body: { category: 'TEAM', groupName: `NT Normal ${Date.now()}` } })).body.data;
  r = await call('GET', '/groups?isDefault=true&search=NT&limit=50', { token: A });
  check('list ?isDefault=true', r.status === 200 && r.body.data.some((g) => g.id === gDefault.id) && !r.body.data.some((g) => g.id === gNormal.id) && r.body.data.every((g) => g.isDefault === true), dump(r));
  const memberOf = async (userId) => (await col('access_mappings').find({ type: 'GROUP_USER', userId }).toArray()).map((x) => x.groupId);
  await reg('new1');
  const new1 = await uid('new1');
  let groupsOf = await memberOf(new1);
  check('registered user joined the active default group only', groupsOf.includes(gDefault.id) && !groupsOf.includes(gInactive.id) && !groupsOf.includes(gNormal.id), JSON.stringify(groupsOf));
  const mapping = await col('access_mappings').findOne({ type: 'GROUP_USER', userId: new1, groupId: gDefault.id });
  check('assignment recorded as "system" (audited)', mapping.assignedBy === 'system' && !!(await col('access_control_audit_logs').findOne({ entityId: mapping._id, changedBy: 'system' })));
  const N1 = (await login('new1')).body.data.accessToken;
  r = await call('GET', '/access-control/me', { token: N1 });
  check('new user has the default role permission (USER_READ)', r.body.data.permissionKeys.includes('USER_READ'), dump(r));
  r = await call('POST', '/admin/users', { token: A, body: { email: email('created'), firstName: 'Cid', password: 'Init!Pass2026', sendWelcomeEmail: false, groupIds: [gNormal.id] } });
  groupsOf = await memberOf(r.body.data?.id);
  check('admin-created user: default group + chosen group', r.status === 201 && groupsOf.includes(gDefault.id) && groupsOf.includes(gNormal.id), JSON.stringify(groupsOf));
  await call('POST', '/user-invites', { token: A, body: { email: email('invited') } });
  const token = ((await waitMail('user-invite', email('invited')))[0]?.match(/accept-invite\?token=([A-Za-z0-9_-]{43})/) || [])[1];
  r = await call('POST', '/user-invites/accept', { body: { token, password: 'Ivy!Pass2026x', confirmPassword: 'Ivy!Pass2026x', firstName: 'Ivy' } });
  check('invited user joined the default group', r.status === 201 && (await memberOf(await uid('invited'))).includes(gDefault.id), dump(r));
  // Escalation: ACCESS_CONTROL_ADMIN (can edit groups, lacks USER_READ) can't make a USER_READ group default
  const acRole = await col('roles').findOne({ roleKey: 'ACCESS_CONTROL_ADMIN' });
  const gAc = (await call('POST', '/groups', { token: A, body: { category: 'TEAM', groupName: `NT AC ${Date.now()}` } })).body.data;
  await call('POST', '/access-mappings/group-roles', { token: A, body: { groupId: gAc.id, roleIds: [acRole._id] } });
  await call('POST', '/access-mappings/group-users', { token: A, body: { groupId: gAc.id, userIds: [await uid('acadmin')] } });
  const AC = (await login('acadmin')).body.data.accessToken;
  await call('PATCH', `/groups/${gDefault.id}`, { token: A, body: { isDefault: false } });
  r = await call('PATCH', `/groups/${gDefault.id}`, { token: AC, body: { isDefault: true } });
  check('making a group default needs the right to grant its permissions -> 403', r.status === 403, dump(r));
  await reg('new2');
  check('default switched off: next user not added', !(await memberOf(await uid('new2'))).includes(gDefault.id));
  r = await call('PATCH', `/groups/${gDefault.id}`, { token: A, body: { isDefault: true } });
  check('admin can switch it on again', r.status === 200 && r.body.data.isDefault === true);
  check('isDefault change audited', !!(await col('access_control_audit_logs').findOne({ entityId: gDefault.id, 'after.isDefault': true, action: 'UPDATE' })));

  console.log('\n4. Admin activity search and login history');
  r = await call('GET', `/admin/activity?userId=${u1}&limit=100`, { token: A });
  check('by user, with user details', r.status === 200 && r.body.data.length >= 8 && r.body.data.every((a) => a.userId === u1 && a.user?.email === email('u1')), dump(r));
  r = await call('GET', '/admin/activity?search=test-nt-u2&limit=100', { token: A });
  check('search by email', r.body.data.length >= 4 && r.body.data.every((a) => a.user.email === email('u2')));
  r = await call('GET', '/admin/activity?events=login_failed,ACCOUNT_LOCKED&isSuccess=false&search=test-nt-u2', { token: A });
  check('events + isSuccess filters', r.body.data.length === 4 && r.body.data.some((a) => a.event === 'ACCOUNT_LOCKED') && r.body.data.every((a) => a.isSuccess === false), dump(r));
  r = await call('GET', '/admin/activity?ipAddress=198.51.100.7', { token: A });
  check('by IP', r.body.data.length >= 2 && r.body.data.every((a) => a.ipAddress === '198.51.100.7'));
  r = await call('GET', `/admin/activity?browser=firefox&userId=${u1}`, { token: A });
  check('browser contains', r.body.data.length >= 3 && r.body.data.every((a) => /Firefox/.test(a.browser)));
  r = await call('GET', `/admin/activity?userId=${u1}&to=2020-01-01T00:00:00Z`, { token: A });
  check('date range', r.status === 200 && r.body.meta.totalItems === 0);
  check('from after to -> 400', (await call('GET', '/admin/activity?from=2026-12-01T00:00:00Z&to=2026-01-01T00:00:00Z', { token: A })).status === 400);
  r = await call('GET', `/admin/activity?userId=${u1}&sortOrder=asc&limit=1`, { token: A });
  check('oldest first: the first sign-in', r.body.data[0].event === 'LOGIN' && /Chrome 124/.test(r.body.data[0].browser), dump(r));
  r = await call('GET', `/admin/activity/login-history?userId=${u1}&limit=100`, { token: A });
  const loginEvents = ['LOGIN', 'LOGIN_FAILED', 'NEW_DEVICE_LOGIN', 'ACCOUNT_LOCKED', 'LOGOUT', 'LOGOUT_ALL'];
  check('login history: sign-in events only (no PROFILE / preferences)', r.status === 200 && r.body.data.length >= 8 && r.body.data.every((a) => loginEvents.includes(a.event)), dump(r));
  r = await call('GET', '/admin/activity/login-history?events=PASSWORD_CHANGED', { token: A });
  check('login history ignores non-login event filters', r.body.meta.totalItems === 0);
  r = await call('GET', '/admin/activity/event-types', { token: A });
  check('event types with labels', r.body.data.some((e) => e.value === 'NEW_DEVICE_LOGIN' && e.isLoginEvent) && r.body.data.some((e) => e.value === 'PASSWORD_CHANGED' && !e.isLoginEvent));
  check('invalid event -> 400', (await call('GET', '/admin/activity?events=HACKED', { token: A })).status === 400);
  check('invalid IP -> 400', (await call('GET', '/admin/activity?ipAddress=999.1.1.1', { token: A })).status === 400);
  check('normal user -> 403', (await call('GET', '/admin/activity', { token: T2 })).status === 403);
  check('USER_READ via default group can search', (await call('GET', '/admin/activity/login-history', { token: N1 })).status === 200);

  console.log('\n5. Permanent deletion removes known devices');
  await call('DELETE', `/admin/users/${u1}`, { token: A, body: { reason: 'notify test' } });
  r = await call('DELETE', `/admin/users/${u1}/permanent`, { token: A, body: {} });
  check('known devices gone', r.status === 200 && (await col('known_devices').countDocuments({ userId: u1 })) === 0, dump(r));

  child.kill();
  await sleep(600);
  await cleanup();
  await col('access_mappings').deleteMany({ assignedBy: 'system', userId: { $in: await ids() } });
  await mongoose.disconnect();
  console.log(`\n${failures === 0 ? 'ALL PASSED' : `${failures} FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
