// End-to-end tests: my account, user administration, invites.
// Run with: npm run test:e2e -- users   (see test/e2e/README.md)
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const backend = process.argv[2] || path.resolve(__dirname, '..', '..', '..');
const mongoose = require(path.join(backend, 'node_modules', 'mongoose'));
const BASE = `http://localhost:${process.env.E2E_PORT || 3000}/api/v1`;
const PW = 'Str0ng!Passw0rd';
const DAY = 86_400_000;
let failures = 0;
let ipN = 1;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (label, ok, detail = '') => { if (!ok) failures++; console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail !== '' ? `  -> ${detail}` : ''}`); };
const ip = () => `10.97.${Math.floor(ipN / 250)}.${(ipN++ % 250) + 1}`;
async function call(method, route, { body, token, from } = {}) {
  const headers = { 'X-Forwarded-For': from ?? ip(), 'User-Agent': 'users-test' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE + route, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, body: await res.json() };
}
const errs = (r) => JSON.stringify(r.body.errors ?? []);
const email = (t) => `test-ux-${t}@example.com`;
let outbox;
const mails = (tpl, to) => fs.readdirSync(outbox).filter((f) => f.endsWith('.eml') && f.includes(tpl)).sort()
  .map((f) => fs.readFileSync(path.join(outbox, f), 'utf8').replace(/=\r?\n/g, '').replace(/=3D/g, '='))
  .filter((m) => !to || m.includes(`To: ${to}`));
async function waitMail(tpl, to, count = 1) { for (let i = 0; i < 30; i++) { const m = mails(tpl, to); if (m.length >= count) return m[m.length - 1]; await sleep(100); } return ''; }
const codeOf = (m) => (m.match(/Subject: (\d{6}) /) || [])[1];

async function main() {
  await mongoose.connect((process.env.E2E_MONGODB_URI || 'mongodb://localhost:27017/authcore_e2e'));
  const db = mongoose.connection.db;
  const col = (n) => db.collection(n);
  const ids = async () => (await col('users').find({ email: /^test-ux-/ }).toArray()).map((u) => u._id);
  const cleanup = async () => {
    const u = await ids();
    for (const c of ['sessions', 'password_resets', 'account_codes', 'email_verifications']) await col(c).deleteMany({ userId: { $in: u } });
    await col('login_attempts').deleteMany({ key: { $in: u.map((i) => `user:${i}`) } });
    await col('access_mappings').deleteMany({ $or: [{ userId: { $in: u } }, { assignedBy: { $in: u } }] });
    for (const c of ['roles', 'groups']) await col(c).deleteMany({ createdBy: { $in: u } });
    await col('access_control_audit_logs').deleteMany({ $or: [{ changedBy: { $in: u } }, { entityId: { $in: u } }] });
    await col('user_invites').deleteMany({ email: /^test-ux-/ });
    await col('users').deleteMany({ _id: { $in: u } });
  };
  await cleanup();
  outbox = fs.mkdtempSync(path.join(os.tmpdir(), 'ux-'));
  const logs = [];
  const child = spawn(process.execPath, ['dist/main.js'], {
    cwd: backend,
    env: { ...process.env, TRUST_PROXY_HOPS: '1', LOG_FORMAT: 'json', MAIL_TRANSPORT: 'outbox', MAIL_OUTBOX_DIR: outbox, REGISTRATION_EMAIL_VERIFICATION: 'none', REGISTRATION_REQUIRE_APPROVAL: 'false' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (d) => logs.push(String(d)));
  child.stderr.on('data', (d) => logs.push(String(d)));
  for (let i = 0; i < 80; i++) { try { if ((await fetch(BASE + '/health/live')).ok) break; } catch {} await sleep(250); }
  await sleep(500);

  const reg = (t, extra = {}) => call('POST', '/auth/register', { body: { email: email(t), password: PW, firstName: 'Tess', ...extra } });
  const login = (e, p = PW) => call('POST', '/auth/login', { body: { email: e, password: p } });
  const tok = async (e, p = PW) => (await login(e, p)).body.data?.accessToken;
  const uid = async (t) => String((await col('users').findOne({ email: email(t) }))._id);
  for (const t of ['admin', 'me', 'other', 'mgr', 'target']) await reg(t);
  await col('users').updateOne({ email: email('admin') }, { $set: { role: 'ADMIN' } });
  const A = await tok(email('admin'));

  console.log('\n1. My profile and preferences');
  let me = await tok(email('me'));
  let r = await call('GET', '/users/me', { token: me });
  check('profile with default preferences and source', r.status === 200 && r.body.data.preferences.timezone === 'UTC' && r.body.data.preferences.notifications.loginAlerts === true && r.body.data.source === 'REGISTRATION' && r.body.data.mustChangePassword === false);
  await reg('taken', { username: 'takenname' });
  r = await call('PATCH', '/users/me', { token: me, body: { firstName: ' Theresa ', lastName: 'Lane', username: 'TessL' } });
  check('update names + username (lowercased)', r.status === 200 && r.body.data.firstName === 'Theresa' && r.body.data.lastName === 'Lane' && r.body.data.username === 'tessl');
  check('username taken -> 409', (await call('PATCH', '/users/me', { token: me, body: { username: 'takenname' } })).status === 409);
  check('reserved username -> 400', (await call('PATCH', '/users/me', { token: me, body: { username: 'admin' } })).status === 400);
  check('invalid name -> 400', (await call('PATCH', '/users/me', { token: me, body: { firstName: '<b>x</b>' } })).status === 400);
  r = await call('PATCH', '/users/me', { token: me, body: { lastName: null, username: '' } });
  check('null / "" removes lastName and username', r.body.data.lastName === null && r.body.data.username === null);
  check('unknown field -> 400', (await call('PATCH', '/users/me', { token: me, body: { role: 'ADMIN' } })).status === 400);
  r = await call('PATCH', '/users/me/preferences', { token: me, body: { timezone: 'Asia/Kolkata', notifications: { productUpdates: true } } });
  check('preferences: partial merge', r.body.data.preferences.timezone === 'Asia/Kolkata' && r.body.data.preferences.notifications.productUpdates === true && r.body.data.preferences.notifications.loginAlerts === true && r.body.data.preferences.language === 'en');
  check('invalid timezone -> 400', (await call('PATCH', '/users/me/preferences', { token: me, body: { timezone: 'Mars/Base' } })).status === 400);
  check('invalid language -> 400', (await call('PATCH', '/users/me/preferences', { token: me, body: { language: 'english' } })).status === 400);

  console.log('\n2. Change email');
  r = await call('POST', '/users/me/email/change', { token: me, body: { newEmail: email('me2'), currentPassword: 'Wrong!Pass1' } });
  check('wrong current password -> 400 AUTH_INVALID_CURRENT_PASSWORD', r.status === 400 && r.body.code === 'AUTH_INVALID_CURRENT_PASSWORD');
  check('same email -> 400', (await call('POST', '/users/me/email/change', { token: me, body: { newEmail: email('me'), currentPassword: PW } })).status === 400);
  r = await call('POST', '/users/me/email/change', { token: me, body: { newEmail: email('other'), currentPassword: PW } });
  check('email of another account -> 409 ACCOUNT_EMAIL_IN_USE', r.status === 409 && r.body.code === 'ACCOUNT_EMAIL_IN_USE');
  r = await call('POST', '/users/me/email/change', { token: me, body: { newEmail: email('me2'), currentPassword: PW } });
  check('request -> code to the NEW address', r.status === 200 && r.body.data.pendingEmail === email('me2'));
  const changeCode = codeOf(await waitMail('email-change-code', email('me2')));
  check('code email received at the new address', /^\d{6}$/.test(changeCode ?? ''));
  check('again within cooldown -> 429', (await call('POST', '/users/me/email/change', { token: me, body: { newEmail: email('me2'), currentPassword: PW } })).status === 429);
  check('wrong code -> 400 ACCOUNT_INVALID_CODE', (await call('POST', '/users/me/email/confirm', { token: me, body: { code: changeCode === '000000' ? '111111' : '000000' } })).body.code === 'ACCOUNT_INVALID_CODE');
  r = await call('POST', '/users/me/email/confirm', { token: me, body: { code: changeCode } });
  check('confirm -> email changed and verified', r.status === 200 && r.body.data.email === email('me2') && r.body.data.isEmailVerified === true);
  check('old address notified', (await waitMail('email-changed-notice', email('me'))).includes(email('me2')));
  check('sign in with the new email works, old fails', (await login(email('me2'))).status === 200 && (await login(email('me'))).status === 401);
  check('code works once', (await call('POST', '/users/me/email/confirm', { token: me, body: { code: changeCode } })).status === 400);

  console.log('\n3. Deactivate and recover');
  r = await call('POST', '/users/me/deactivate', { token: me, body: { currentPassword: PW, reason: 'Taking a break' } });
  check('deactivate -> 200, cookie cleared', r.status === 200);
  check('signed out (token -> 401)', (await call('GET', '/users/me', { token: me })).status === 401);
  r = await login(email('me2'));
  check('sign-in refused, mentions account recovery', r.status === 403 && r.body.code === 'AUTH_ACCOUNT_INACTIVE' && /account recovery/.test(r.body.message));
  check('confirmation email', (await waitMail('account-deactivated', email('me2'))) !== '');
  r = await call('POST', '/account/recovery/request', { body: { email: email('me2') } });
  const unknown = await call('POST', '/account/recovery/request', { body: { email: 'test-ux-nobody@example.com' } });
  check('recovery request: same response for unknown emails', r.status === 200 && unknown.status === 200 && r.body.message === unknown.body.message);
  const recCode = codeOf(await waitMail('account-recovery-code', email('me2')));
  r = await call('POST', '/account/recovery/confirm', { body: { email: email('me2'), code: recCode } });
  check('recovery confirm -> reactivated, can sign in', r.status === 200 && (await login(email('me2'))).status === 200);
  check('reactivation email', (await waitMail('account-recovered', email('me2'))) !== '');

  console.log('\n4. Delete my account');
  me = await tok(email('me2'));
  r = await call('DELETE', '/users/me', { token: me, body: { currentPassword: PW } });
  const scheduled = new Date(r.body.data?.deletionScheduledAt);
  check('deletion scheduled ~14 days ahead', r.status === 200 && Math.abs(scheduled - Date.now() - 14 * DAY) < 60_000);
  r = await login(email('me2'));
  check('sign-in refused: AUTH_ACCOUNT_PENDING_DELETION', r.status === 403 && r.body.code === 'AUTH_ACCOUNT_PENDING_DELETION');
  await call('POST', '/account/recovery/request', { body: { email: email('me2') } });
  const rec2 = codeOf(await waitMail('account-recovery-code', email('me2'), 2));
  await call('POST', '/account/recovery/confirm', { body: { email: email('me2'), code: rec2 } });
  r = await call('GET', '/users/me', { token: await tok(email('me2')) });
  check('recovery cancels the deletion', r.status === 200 && r.body.data.deletionScheduledAt === null);
  me = await tok(email('me2'));
  await call('DELETE', '/users/me', { token: me, body: { currentPassword: PW } });
  const meId = String((await col('users').findOne({ email: email('me2') }))._id);
  await col('users').updateOne({ _id: meId }, { $set: { deletionScheduledAt: new Date(Date.now() - 1000) } });
  r = await call('POST', '/admin/users/deletion-purge/run', { token: A });
  check('purge run: account and its data permanently deleted', r.status === 200 && r.body.data.purgedUserIds.includes(meId) && !(await col('users').findOne({ _id: meId })) && (await col('sessions').countDocuments({ userId: meId })) === 0);

  console.log('\n5. Admin: access and listing');
  const M = await tok(email('mgr'));
  check('without USER_READ -> 403', (await call('GET', '/admin/users', { token: M })).status === 403);
  const userAdminRole = await col('roles').findOne({ roleKey: 'USER_ADMIN' });
  const g = (await call('POST', '/groups', { token: A, body: { category: 'TEAM', groupName: 'UX Admins' } })).body.data;
  await call('POST', '/access-mappings/group-roles', { token: A, body: { groupId: g.id, roleIds: [userAdminRole._id] } });
  await call('POST', '/access-mappings/group-users', { token: A, body: { groupId: g.id, userIds: [await uid('mgr')] } });
  r = await call('GET', '/admin/users?search=test-ux-&sortBy=email&sortOrder=asc&limit=50', { token: M });
  check('USER_ADMIN role (via group) -> list, sorted, paginated', r.status === 200 && r.body.meta.totalItems >= 5 && r.body.data[0].email <= r.body.data[1].email);
  r = await call('GET', `/admin/users?search=test-ux-&role=ADMIN`, { token: M });
  check('filter by role', r.body.data.every((u) => u.role === 'ADMIN') && r.body.data.length >= 1);

  console.log('\n6. Admin: create user');
  r = await call('POST', '/admin/users', { token: M, body: { email: email('new1'), firstName: 'Nina', password: 'weak' } });
  check('weak password -> 400 (policy)', r.status === 400);
  check('existing email -> 409', (await call('POST', '/admin/users', { token: M, body: { email: email('other'), firstName: 'X', password: 'Init!Pass2026' } })).status === 409);
  r = await call('POST', '/admin/users', { token: M, body: { email: email('new1'), firstName: 'Nina', password: 'Init!Pass2026', groupIds: [g.id] } });
  check('created: ACTIVE, verified, source ADMIN, must change password, in group', r.status === 201 && r.body.data.status === 'ACTIVE' && r.body.data.isEmailVerified && r.body.data.source === 'ADMIN' && r.body.data.mustChangePassword && r.body.data.groups.some((x) => x.id === g.id) && r.body.data.createdBy === (await uid('mgr')));
  check('welcome email without the password', !(await waitMail('admin-created-account', email('new1'))).includes('Init!Pass2026'));
  r = await login(email('new1'), 'Init!Pass2026');
  const n1 = r.body.data.accessToken;
  check('first sign-in: isPasswordChangeRequired', r.body.data.isPasswordChangeRequired === true);
  check('until changed: /auth/me ok, other routes 403', (await call('GET', '/auth/me', { token: n1 })).status === 200 && (await call('GET', '/auth/sessions', { token: n1 })).body.code === 'AUTH_PASSWORD_EXPIRED');
  r = await call('PATCH', '/auth/change-password', { token: n1, body: { currentPassword: 'Init!Pass2026', newPassword: 'Mine!Pass2026', confirmPassword: 'Mine!Pass2026' } });
  check('after changing: flag cleared, routes work', r.status === 200 && (await call('GET', '/auth/sessions', { token: n1 })).status === 200);

  console.log('\n7. Admin: details, edit, status, passwords');
  const T = await uid('target');
  let tTok = await tok(email('target'));
  r = await call('GET', `/admin/users/${T}`, { token: M });
  check('user info: sessions, groups, permissions, lock', r.status === 200 && r.body.data.activeSessionCount >= 1 && Array.isArray(r.body.data.groups) && Array.isArray(r.body.data.permissionKeys) && r.body.data.isLocked === false);
  r = await call('PATCH', `/admin/users/${T}`, { token: M, body: { lastName: 'Target', email: email('target2') } });
  check('edit incl. email (old address notified)', r.status === 200 && r.body.data.email === email('target2') && (await waitMail('email-changed-notice', email('target'))) !== '');
  check('editing myself here -> 403', (await call('PATCH', `/admin/users/${await uid('mgr')}`, { token: M, body: { lastName: 'X' } })).status === 403);
  check('non-ADMIN managing an ADMIN -> 403', (await call('PATCH', `/admin/users/${await uid('admin')}/status`, { token: M, body: { status: 'SUSPENDED' } })).status === 403);
  r = await call('PATCH', `/admin/users/${T}/status`, { token: M, body: { status: 'SUSPENDED', reason: 'Policy violation' } });
  check('suspend: reason stored, signed out', r.status === 200 && r.body.data.status === 'SUSPENDED' && r.body.data.statusReason === 'Policy violation' && r.body.data.activeSessionCount === 0 && (await call('GET', '/auth/me', { token: tTok })).status === 401);
  check('suspended sign-in refused', (await login(email('target2'))).body.code === 'AUTH_ACCOUNT_SUSPENDED');
  check('suspension email with reason', (await waitMail('account-status-changed', email('target2'))).includes('Policy violation'));
  await call('POST', '/account/recovery/request', { body: { email: email('target2') } });
  await sleep(500);
  check('admin-suspended account cannot self-recover (no code sent)', mails('account-recovery-code', email('target2')).length === 0);
  check('invalid status value -> 400', (await call('PATCH', `/admin/users/${T}/status`, { token: M, body: { status: 'PENDING_APPROVAL' } })).status === 400);
  r = await call('PATCH', `/admin/users/${T}/status`, { token: M, body: { status: 'ACTIVE', notifyUser: false } });
  check('reactivate -> can sign in', r.body.data.status === 'ACTIVE' && (await login(email('target2'))).status === 200);
  r = await call('POST', `/admin/users/${T}/reset-password`, { token: M });
  check('reset-password -> reset email sent', r.status === 200 && r.body.data.sentTo === email('target2') && codeOf(await waitMail('password-reset-code', email('target2'))) !== undefined);
  tTok = await tok(email('target2'));
  r = await call('POST', `/admin/users/${T}/force-password-reset`, { token: M, body: {} });
  check('force reset: flag set, signed out, no email', r.body.data.mustChangePassword === true && (await call('GET', '/auth/me', { token: tTok })).status === 401 && mails('password-changed', email('target2')).length === 0);
  check('next sign-in requires a change', (await login(email('target2'))).body.data.isPasswordChangeRequired === true);
  for (let i = 0; i < 5; i++) await call('POST', '/auth/login', { body: { email: email('target2'), password: 'Wrong!Pass1' }, from: '10.97.250.250' });
  r = await call('GET', `/admin/users/${T}`, { token: M });
  check('locked after failures (one IP locked out)', r.body.data.isLocked === true && r.body.data.lockedIpCount === 1, JSON.stringify(r.body.data).slice(0, 200));
  r = await call('POST', `/admin/users/${T}/unlock`, { token: M });
  check('unlock -> can sign in again (also from that IP)', r.body.data.isLocked === false && r.body.data.lockedIpCount === 0 && (await call('POST', '/auth/login', { body: { email: email('target2'), password: PW }, from: '10.97.250.250' })).status === 200);
  r = await call('GET', `/admin/users/${T}/sessions`, { token: M });
  check('list sessions', r.status === 200 && r.body.data.length >= 1 && r.body.data[0].deviceName);
  r = await call('POST', `/admin/users/${T}/sessions/revoke`, { token: M });
  check('sign out everywhere', r.body.data.count >= 1);
  check('role change needs ADMIN (USER_ADMIN is not enough) -> 403', (await call('PATCH', `/admin/users/${T}/role`, { token: M, body: { role: 'ADMIN' } })).status === 403);
  r = await call('PATCH', `/admin/users/${T}/role`, { token: A, body: { role: 'ADMIN' } });
  check('ADMIN can promote', r.body.data.role === 'ADMIN');
  await call('PATCH', `/admin/users/${T}/role`, { token: A, body: { role: 'USER' } });

  console.log('\n8. Admin: delete, restore, permanent');
  check('permanent delete of a live user -> 409', (await call('DELETE', `/admin/users/${T}/permanent`, { token: M })).status === 409);
  r = await call('DELETE', `/admin/users/${T}`, { token: M, body: { reason: 'Left the company' } });
  check('soft delete -> hidden, cannot sign in', r.status === 200 && r.body.data.deletedAt && (await login(email('target2'))).status === 401);
  r = await call('GET', '/admin/users?search=target2&deleted=ONLY', { token: M });
  check('listed with deleted=ONLY only', r.body.data.length === 1 && (await call('GET', '/admin/users?search=target2', { token: M })).body.data.length === 0);
  r = await call('POST', `/admin/users/${T}/restore`, { token: M });
  check('restore -> can sign in', r.status === 200 && (await login(email('target2'))).status === 200);
  await call('DELETE', `/admin/users/${T}`, { token: M, body: {} });
  r = await call('DELETE', `/admin/users/${T}/permanent`, { token: M });
  check('permanent delete: account and data gone', r.status === 200 && !(await col('users').findOne({ _id: T })) && (await col('sessions').countDocuments({ userId: T })) === 0);
  r = await call('GET', `/access-control/audit-logs?entityType=USER&limit=100`, { token: A });
  check('admin actions audited (entity USER)', r.body.meta.totalItems >= 10);

  console.log('\n9. Invites');
  const I = (b, t = M) => call('POST', '/user-invites', { token: t, body: b });
  check('without USER_INVITE (plain user) -> 403', (await I({ email: email('inv1') }, await tok(email('other')))).status === 403);
  r = await I({ email: email('inv1'), firstName: 'Ivy', groupIds: [g.id], message: 'Welcome!' });
  const inv1 = r.body.data;
  check('invite sent: PENDING, expires in 7 days', r.status === 201 && inv1.status === 'PENDING' && Math.abs(new Date(inv1.expiresAt) - Date.now() - 7 * DAY) < 60_000 && inv1.invitedBy.name.startsWith('Tess'));
  const invMail = await waitMail('user-invite', email('inv1'));
  const token1 = (invMail.match(/accept-invite\?token=([A-Za-z0-9_-]{43})/) || [])[1];
  check('email with link and message', !!token1 && invMail.includes('Welcome!'));
  check('second pending invite for same email -> 409', (await I({ email: email('inv1') })).status === 409);
  check('registered email -> 409', (await I({ email: email('other') })).body.code === 'ACCOUNT_EMAIL_IN_USE');
  r = await call('POST', '/user-invites/bulk', { token: M, body: { invites: [{ email: email('inv2') }, { email: email('inv2') }, { email: email('other') }, { email: email('inv1') }, { email: email('inv3') }] } });
  check('bulk: created / skipped with reasons', r.status === 201 && r.body.data.createdCount === 2 && r.body.data.skipped.map((s) => s.reason).sort().join() === 'ALREADY_INVITED,ALREADY_REGISTERED,DUPLICATE_IN_REQUEST', JSON.stringify(r.body.data.skipped));
  r = await call('GET', '/user-invites?status=PENDING&search=test-ux-inv', { token: M });
  check('list PENDING', r.body.data.length === 3);
  r = await call('POST', '/user-invites/public/info', { body: { token: token1 } });
  check('public info (token in body)', r.status === 200 && r.body.data.email === email('inv1') && r.body.data.isAcceptable === true && r.body.data.invitedByName.startsWith('Tess'));
  check('unknown token -> 404 INVITE_INVALID', (await call('POST', '/user-invites/public/info', { body: { token: 'x'.repeat(43) } })).body.code === 'INVITE_INVALID');
  r = await call('POST', `/user-invites/${inv1.id}/resend`, { token: M });
  check('resend within cooldown -> 429', r.status === 429, JSON.stringify(r.body).slice(0, 300));
  await col('user_invites').updateOne({ _id: inv1.id }, { $set: { lastSentAt: new Date(Date.now() - 120_000) } });
  r = await call('POST', `/user-invites/${inv1.id}/resend`, { token: M });
  const token1b = ((await waitMail('user-invite', email('inv1'), 2)).match(/accept-invite\?token=([A-Za-z0-9_-]{43})/) || [])[1];
  check('resend: new link, old one stops working', r.status === 200 && r.body.data.resendCount === 1 && token1b !== token1 && (await call('POST', '/user-invites/public/info', { body: { token: token1 } })).status === 404);
  r = await call('POST', '/user-invites/accept', { body: { token: token1b, password: 'weak', confirmPassword: 'weak' } });
  check('accept with weak password -> 400', r.status === 400);
  check('confirm mismatch -> 400', (await call('POST', '/user-invites/accept', { body: { token: token1b, password: 'Ivy!Pass2026x', confirmPassword: 'Other!Pass2026' } })).status === 400);
  const [a1, a2] = await Promise.all([
    call('POST', '/user-invites/accept', { body: { token: token1b, password: 'Ivy!Pass2026x', confirmPassword: 'Ivy!Pass2026x', username: 'ivy01' } }),
    call('POST', '/user-invites/accept', { body: { token: token1b, password: 'Ivy!Pass2026x', confirmPassword: 'Ivy!Pass2026x' } }),
  ]);
  const ok = [a1, a2].filter((x) => x.status === 201);
  check('two parallel accepts: exactly one account', ok.length === 1 && (await col('users').countDocuments({ email: email('inv1') })) === 1, `${a1.status}/${a2.status}`);
  check('account: ACTIVE, verified, source INVITE, joined the group', ok[0]?.body.data.user.status === 'ACTIVE' && ok[0].body.data.user.isEmailVerified && ok[0].body.data.user.source === 'INVITE' && ok[0].body.data.groupsJoined === 1);
  check('invitee can sign in', (await login(email('inv1'), 'Ivy!Pass2026x')).status === 200);
  check('accept again -> 400 already used', /already used/.test((await call('POST', '/user-invites/accept', { body: { token: token1b, password: 'Ivy!Pass2026x', confirmPassword: 'Ivy!Pass2026x' } })).body.message));
  r = await call('GET', `/user-invites/${inv1.id}`, { token: M });
  check('invite ACCEPTED with acceptedUserId', r.body.data.status === 'ACCEPTED' && r.body.data.acceptedUserId === ok[0]?.body.data.user.id);
  check('accepted invite cannot be deleted -> 409', (await call('DELETE', `/user-invites/${inv1.id}`, { token: M })).status === 409);
  const inv2 = (await col('user_invites').findOne({ email: email('inv2') }))._id;
  const inv3 = (await col('user_invites').findOne({ email: email('inv3') }))._id;
  r = await call('POST', `/user-invites/${inv2}/revoke`, { token: M });
  check('revoke -> REVOKED; revoke again -> 409', r.body.data.status === 'REVOKED' && (await call('POST', `/user-invites/${inv2}/revoke`, { token: M })).status === 409);
  check('delete revoked invite', (await call('DELETE', `/user-invites/${inv2}`, { token: M })).status === 200);
  await col('user_invites').updateOne({ _id: inv3 }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
  const token3 = ((await waitMail('user-invite', email('inv3'))).match(/accept-invite\?token=([A-Za-z0-9_-]{43})/) || [])[1];
  r = await call('POST', '/user-invites/accept', { body: { token: token3, password: 'Ok!Pass2026xy', confirmPassword: 'Ok!Pass2026xy', firstName: 'Ola' } });
  check('expired invite -> 400 "expired"', r.status === 400 && /expired/.test(r.body.message));
  check('listed as EXPIRED', (await call('GET', '/user-invites?status=EXPIRED&search=test-ux-inv3', { token: M })).body.data.length === 1);
  check('invite actions audited (entity INVITE)', (await call('GET', '/access-control/audit-logs?entityType=INVITE', { token: A })).body.meta.totalItems >= 4);

  console.log('\n10. Logs');
  const logText = logs.join('');
  check('no passwords, codes or invite tokens in logs', ![PW, 'Init!Pass2026', 'Ivy!Pass2026x', changeCode, recCode, token1, token1b].some((s) => s && logText.includes(s)));

  child.kill();
  await sleep(600);
  await cleanup();
  await mongoose.disconnect();
  console.log(`\n${failures === 0 ? 'ALL PASSED' : `${failures} FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
