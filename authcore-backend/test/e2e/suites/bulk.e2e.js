// End-to-end tests: bulk user operations (create, update, reset password from CSV / Excel).
// Run with: npm run test:e2e -- bulk   (see test/e2e/README.md)
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const backend = process.argv[2] || path.resolve(__dirname, '..', '..', '..');
const mongoose = require(path.join(backend, 'node_modules', 'mongoose'));
const ExcelJS = require(path.join(backend, 'node_modules', 'exceljs'));
const BASE = `http://localhost:${process.env.E2E_PORT || 3000}/api/v1`;
const PW = 'Str0ng!Passw0rd';
const NEW_PW = 'Bulk!Pass2026x';
let failures = 0;
let ipN = 1;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (label, ok, detail = '') => { if (!ok) failures++; console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail !== '' ? `  -> ${detail}` : ''}`); };
const ip = () => `10.98.${Math.floor(ipN / 250)}.${(ipN++ % 250) + 1}`;
async function call(method, route, { body, token } = {}) {
  const headers = { 'X-Forwarded-For': ip(), 'User-Agent': 'bulk-test' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE + route, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, body: await res.json() };
}
/** GET a CSV (text). */
async function getText(route, token) {
  const res = await fetch(BASE + route, { headers: { Authorization: `Bearer ${token}`, 'X-Forwarded-For': ip() } });
  return { status: res.status, type: res.headers.get('content-type') ?? '', disposition: res.headers.get('content-disposition') ?? '', text: await res.text() };
}
/** multipart upload of one file. */
async function upload(type, name, content, token) {
  const form = new FormData();
  form.append('file', new Blob([content]), name);
  const res = await fetch(`${BASE}/admin/users/bulk/${type}/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'X-Forwarded-For': ip() },
    body: form,
  });
  return { status: res.status, body: await res.json() };
}
const email = (t) => `test-bk-${t}@example.com`;
let outbox;
const mails = (tpl, to) => fs.readdirSync(outbox).filter((f) => f.endsWith('.eml') && f.includes(tpl)).sort()
  .map((f) => fs.readFileSync(path.join(outbox, f), 'utf8').replace(/=\r?\n/g, '').replace(/=3D/g, '='))
  .filter((m) => !to || m.includes(`To: ${to}`));
async function waitMail(tpl, to) { for (let i = 0; i < 40; i++) { const m = mails(tpl, to); if (m.length > 0) return m[m.length - 1]; await sleep(100); } return ''; }
/** Simple CSV (our values have no commas or quotes). */
const csv = (rows) => rows.map((r) => r.join(',')).join('\n') + '\n';

async function main() {
  await mongoose.connect((process.env.E2E_MONGODB_URI || 'mongodb://localhost:27017/authcore_e2e'));
  const db = mongoose.connection.db;
  const col = (n) => db.collection(n);
  const ids = async () => (await col('users').find({ email: /^test-bk-/ }).toArray()).map((u) => u._id);
  const cleanup = async () => {
    const u = await ids();
    for (const c of ['sessions', 'password_resets', 'account_codes', 'email_verifications']) await col(c).deleteMany({ userId: { $in: u } });
    await col('access_mappings').deleteMany({ $or: [{ userId: { $in: u } }, { assignedBy: { $in: u } }] });
    await col('groups').deleteMany({ createdBy: { $in: u } });
    await col('bulk_jobs').deleteMany({ uploadedBy: { $in: u } });
    await col('access_control_audit_logs').deleteMany({ $or: [{ changedBy: { $in: u } }, { entityId: { $in: u } }] });
    await col('users').deleteMany({ _id: { $in: u } });
  };
  await cleanup();
  outbox = fs.mkdtempSync(path.join(os.tmpdir(), 'bk-'));
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

  const reg = (t) => call('POST', '/auth/register', { body: { email: email(t), password: PW, firstName: 'Bea' } });
  const login = (e, p = PW) => call('POST', '/auth/login', { body: { email: e, password: p } });
  const tok = async (e, p = PW) => (await login(e, p)).body.data?.accessToken;
  for (const t of ['admin', 'plain', 'existing']) await reg(t);
  await col('users').updateOne({ email: email('admin') }, { $set: { role: 'ADMIN' } });
  const A = await tok(email('admin'));
  const P = await tok(email('plain'));
  /** Polls a job until it stops running. */
  const finished = async (type, id) => {
    for (let i = 0; i < 100; i++) {
      const r = await call('GET', `/admin/users/bulk/${type}/jobs/${id}`, { token: A });
      if (r.body.data?.status !== 'PROCESSING') return r.body.data;
      await sleep(150);
    }
    return null;
  };
  const group = (await call('POST', '/groups', { token: A, body: { category: 'TEAM', groupName: `Bulk Team ${Date.now()}` } })).body.data;
  const groupCode = group.groupId;

  console.log('\n1. Templates and access');
  let t = await getText('/admin/users/bulk/create/template', A);
  const header = t.text.replace(/^﻿/, '').split(/\r?\n/)[0];
  check('create template: CSV download with the columns', t.status === 200 && t.type.startsWith('text/csv') && t.disposition.includes('attachment') && ['"email"', '"given_name"', '"password"', '"groups"'].every((c) => header.includes(c)), header);
  t = await getText('/admin/users/bulk/password/template', A);
  check('reset-password template has action / new_password', t.status === 200 && t.text.includes('"action"') && t.text.includes('"new_password"'));
  check('unknown operation -> 404', (await getText('/admin/users/bulk/delete/template', A)).status === 404);
  check('no permission -> 403 (template)', (await getText('/admin/users/bulk/create/template', P)).status === 403);
  check('no permission -> 403 (upload)', (await upload('create', 'x.csv', csv([['email'], ['a@b.c']]), P)).status === 403);

  console.log('\n2. Rejected files (kept as INVALID_TEMPLATE)');
  let r = await upload('create', 'wrong.csv', csv([['mail', 'name'], ['a@b.c', 'A']]), A);
  check('wrong columns -> 202 INVALID_TEMPLATE naming them', r.status === 202 && r.body.data.status === 'INVALID_TEMPLATE' && r.body.data.message.includes('email') && r.body.data.message.includes('mail'), JSON.stringify(r.body.data));
  r = await upload('create', 'empty.csv', '', A);
  check('empty file -> INVALID_TEMPLATE', r.body.data?.status === 'INVALID_TEMPLATE' && r.body.data.message.includes('empty'), JSON.stringify(r.body));
  const tooMany = [['email', 'given_name', 'password'], ...Array.from({ length: 1001 }, (_, i) => [`x${i}@example.com`, 'X', NEW_PW])];
  r = await upload('create', 'big.csv', csv(tooMany), A);
  check('over 1000 rows -> INVALID_TEMPLATE', r.body.data?.status === 'INVALID_TEMPLATE' && r.body.data.message.includes('1000'), r.body.data?.message);
  check('no file -> 400', (await call('POST', '/admin/users/bulk/create/upload', { token: A })).status === 400);

  console.log('\n3. Create from CSV');
  const createRows = [
    ['email', 'given_name', 'family_name', 'password', 'must_change_password', 'send_welcome_email', 'groups'],
    [email('new1'), 'Nila', 'Rao', NEW_PW, 'false', 'true', groupCode],
    [email('new2'), 'Om', '', NEW_PW, '', '', ''],
    [email('existing'), 'Dup', '', NEW_PW, '', '', ''],
    [email('weak'), 'Weak', '', 'weak', '', '', ''],
    [email('badgroup'), 'Grp', '', NEW_PW, '', '', 'GRP-NOPE'],
    [email('badbool'), 'Bool', '', NEW_PW, 'maybe', '', ''],
  ];
  r = await upload('create', 'new-hires.csv', csv(createRows), A);
  check('upload -> 202 PROCESSING with the row count', r.status === 202 && ['PROCESSING', 'DONE'].includes(r.body.data.status) && r.body.data.totalCount === 6, JSON.stringify(r.body.data));
  let job = await finished('create', r.body.data.id);
  check('done: 2 created, 4 failed', job?.status === 'DONE' && job.successCount === 2 && job.errorCount === 4 && job.processedCount === 6 && job.finishedAt, JSON.stringify(job));
  const n1 = await col('users').findOne({ email: email('new1') });
  check('user created with the given details', n1?.firstName === 'Nila' && n1.lastName === 'Rao' && n1.mustChangePassword === false);
  check('…and put in the group', (await col('access_mappings').countDocuments({ type: 'GROUP_USER', userId: n1?._id, groupId: group.id })) === 1);
  check('…can sign in with the file password', Boolean(await tok(email('new1'), NEW_PW)));
  check('welcome email sent when asked (without the password)', (await waitMail('admin-created-account', email('new1'))) !== '' && !mails('admin-created-account', email('new1'))[0].includes(NEW_PW));
  check('no welcome email by default', mails('admin-created-account', email('new2')).length === 0);
  t = await getText(`/admin/users/bulk/create/jobs/${job.id}/result`, A);
  const resultText = t.text;
  check('results CSV: row, columns, result and reason', t.status === 200 && resultText.includes('"result"') && resultText.includes('"reason"') && resultText.includes('"Succeeded"') && resultText.includes('"Failed"'));
  check('results CSV never contains the passwords', !resultText.includes(NEW_PW) && !resultText.includes('"password"'));
  check('reasons: duplicate email, password policy, unknown group, bad boolean', /already exists/i.test(resultText) && resultText.includes('GRP-NOPE') && resultText.includes('must_change_password: use true or false') && /password/i.test(resultText.split('\n').find((l) => l.includes(email('weak'))) ?? ''), resultText.slice(0, 600));

  console.log('\n4. Create from Excel (.xlsx)');
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('Users');
  sheet.addRow(['email', 'given_name', 'password']);
  sheet.addRow([email('xl1'), 'Xavi', NEW_PW]);
  r = await upload('create', 'users.xlsx', Buffer.from(await wb.xlsx.writeBuffer()), A);
  job = await finished('create', r.body.data.id);
  check('xlsx row created', job?.successCount === 1 && (await col('users').countDocuments({ email: email('xl1') })) === 1, JSON.stringify(job));

  console.log('\n5. Update: export, edit, upload');
  t = await getText('/admin/users/bulk/update/export?search=test-bk-new', A);
  check('export: the matching users with their groups', t.status === 200 && t.text.includes(email('new1')) && t.text.includes(email('new2')) && t.text.includes(groupCode) && !t.text.includes(email('admin')), t.text.slice(0, 300));
  const updateRows = [
    ['email', 'given_name', 'family_name', 'status', 'groups'],
    [email('new1'), '', 'Rao-Iyer', 'SUSPENDED', '-'],
    [email('new2'), 'Om', '', '', ''],
    [email('nobody'), 'X', '', '', ''],
    [email('xl1'), '', '', 'PAUSED', ''],
  ];
  r = await upload('update', 'edit.csv', csv(updateRows), A);
  job = await finished('update', r.body.data.id);
  check('done: 1 updated, 1 unchanged, 2 failed', job?.successCount === 1 && job.skippedCount === 1 && job.errorCount === 2, JSON.stringify(job));
  const n1b = await col('users').findOne({ email: email('new1') });
  check('last name and status changed, blank cells kept', n1b.lastName === 'Rao-Iyer' && n1b.status === 'SUSPENDED' && n1b.firstName === 'Nila');
  check('"-" in groups removed the user from every group', (await col('access_mappings').countDocuments({ type: 'GROUP_USER', userId: n1b._id })) === 0);
  t = await getText(`/admin/users/bulk/update/jobs/${job.id}/result`, A);
  check('reasons: unknown email, bad status, "No changes"', t.text.includes('no user with this email') && t.text.includes('status: use') && t.text.includes('No changes'));

  console.log('\n6. Reset password');
  t = await getText('/admin/users/bulk/password/export?search=test-bk-new2', A);
  check('export: one row per user, action link', t.status === 200 && t.text.includes(email('new2')) && t.text.includes('"link"'));
  const pwRows = [
    ['email', 'action', 'new_password', 'must_change_password', 'notify'],
    [email('new2'), 'link', '', '', ''],
    [email('xl1'), 'set', 'Fresh!Pass2026q', 'false', 'true'],
    [email('existing'), 'set', '', '', ''],
    [email('plain'), 'wipe', '', '', ''],
  ];
  r = await upload('password', 'reset.csv', csv(pwRows), A);
  job = await finished('password', r.body.data.id);
  check('done: 2 succeeded, 2 failed', job?.successCount === 2 && job.errorCount === 2, JSON.stringify(job));
  check('reset link emailed', (await waitMail('password-reset', email('new2'))) !== '');
  check('set password works for sign-in', Boolean(await tok(email('xl1'), 'Fresh!Pass2026q')));
  check('user told their password was set', (await waitMail('password-set-by-admin', email('xl1'))) !== '');
  t = await getText(`/admin/users/bulk/password/jobs/${job.id}/result`, A);
  check('results never contain new passwords', !t.text.includes('Fresh!Pass2026q') && !t.text.includes('"new_password"'));
  check('reasons: set without a password, unknown action', t.text.includes('new_password: required') && t.text.includes('action: use link'));

  console.log('\n7. History and counts');
  r = await call('GET', '/admin/users/bulk/create/jobs?limit=50', { token: A });
  check('history: newest first, rejected files included', r.status === 200 && r.body.data[0].fileName === 'users.xlsx' && r.body.data.some((j) => j.status === 'INVALID_TEMPLATE'), JSON.stringify(r.body.data.map((j) => j.fileName)));
  r = await call('GET', '/admin/users/bulk/create/jobs?search=new-hires', { token: A });
  check('history search by file name', r.body.data.length >= 1 && r.body.data.every((j) => j.fileName.includes('new-hires')));
  r = await call('GET', '/admin/users/bulk/create/stats', { token: A });
  check('stats add up', r.status === 200 && r.body.data.jobs >= 5 && r.body.data.succeeded >= 3 && r.body.data.invalidFiles >= 3, JSON.stringify(r.body.data));
  check('other operations keep their own history', (await call('GET', '/admin/users/bulk/password/jobs', { token: A })).body.data.every((j) => j.kind === 'USER_PASSWORD'));
  check('stored job rows hold no passwords', !(JSON.stringify(await col('bulk_jobs').find({}).toArray())).includes(NEW_PW));

  console.log('\n8. Logs');
  const logText = logs.join('');
  check('no passwords in logs', ![NEW_PW, 'Fresh!Pass2026q'].some((s) => logText.includes(s)));

  child.kill();
  await sleep(600);
  await cleanup();
  await mongoose.disconnect();
  console.log(`\n${failures === 0 ? 'ALL PASSED' : `${failures} FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
