// E2E: project.config.json identity, orphan file cleanup, invite language, per-IP / account lockouts.
// Run with: npm run test:e2e -- maintenance   (see test/e2e/README.md)
const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const backend = process.argv[2] || path.resolve(__dirname, '..', '..', '..');
const mongoose = require(path.join(backend, 'node_modules', 'mongoose'));
const PORT = process.env.E2E_PORT || 3000;
const BASE = `http://localhost:${PORT}/api/v1`;
const PW = 'Str0ng!Passw0rd';
let failures = 0;
let ipN = 1;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (label, ok, detail = '') => { if (!ok) failures++; console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${!ok && detail !== '' ? `  -> ${detail}` : ''}`); };
const dump = (r) => `${r.status} ${(r.text ?? '').slice(0, 300)}`;
async function call(method, route, { body, token, ip, form } = {}) {
  const headers = { 'X-Forwarded-For': ip ?? `10.91.${Math.floor(ipN / 250)}.${(ipN++ % 250) + 1}`, 'User-Agent': 'maintenance-test' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE + route, { method, headers, body: form ?? (body === undefined ? undefined : JSON.stringify(body)) });
  const text = await res.text();
  let parsed = null; try { parsed = JSON.parse(text); } catch {}
  return { status: res.status, body: parsed, text, headers: res.headers };
}
const email = (t) => `test-mt-${t}@example.com`;

function decodeQP(s) {
  const bytes = []; const t = s.replace(/=\r?\n/g, '');
  for (let i = 0; i < t.length; i++) {
    if (t[i] === '=' && /^[0-9A-F]{2}$/i.test(t.slice(i + 1, i + 3))) { bytes.push(parseInt(t.slice(i + 1, i + 3), 16)); i += 2; } else bytes.push(t.charCodeAt(i));
  }
  return Buffer.from(bytes).toString('utf8');
}
function decodeMail(raw) {
  const subjectLine = (raw.match(/^Subject: (.*(?:\r?\n[ \t].*)*)/m) || [])[1] ?? '';
  const subject = subjectLine.replace(/\r?\n[ \t]/g, ' ').replace(/=\?UTF-8\?([BQ])\?([^?]*)\?=\s*/gi, (_, enc, data) =>
    enc.toUpperCase() === 'B' ? Buffer.from(data, 'base64').toString('utf8') : decodeQP(data.replace(/_/g, ' ')));
  let body = '';
  for (const part of raw.split(/\r?\n--[^\r\n]+/)) {
    const [head, ...rest] = part.split(/\r?\n\r?\n/);
    const content = rest.join('\n\n');
    if (/Content-Transfer-Encoding: base64/i.test(head)) body += Buffer.from(content.replace(/\s+/g, ''), 'base64').toString('utf8') + '\n';
    else if (/Content-Transfer-Encoding: quoted-printable/i.test(head)) body += decodeQP(content) + '\n';
    else if (/Content-Type: text\//i.test(head)) body += content + '\n';
  }
  return { subject, body };
}
let outbox;
const mails = (tpl, to) => fs.readdirSync(outbox).filter((f) => f.endsWith('.eml') && f.includes(tpl)).sort()
  .map((f) => fs.readFileSync(path.join(outbox, f), 'utf8')).filter((m) => !to || m.includes(to)).map(decodeMail);
async function waitMail(tpl, to, count = 1) { for (let i = 0; i < 40; i++) { if (mails(tpl, to).length >= count) break; await sleep(100); } return mails(tpl, to); }
const jwtPayload = (t) => JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString());

async function main() {
  await mongoose.connect(process.env.E2E_MONGODB_URI || 'mongodb://localhost:27017/authcore_e2e');
  const db = mongoose.connection.db;
  const col = (n) => db.collection(n);
  const ids = async () => (await col('users').find({ email: /^test-mt-/ }).toArray()).map((u) => u._id);
  const cleanup = async () => {
    const u = await ids();
    for (const c of ['sessions', 'user_activities', 'known_devices', 'files', 'account_codes', 'email_verifications']) await col(c).deleteMany({ $or: [{ userId: { $in: u } }, { ownerId: { $in: u } }] });
    await col('login_attempts').deleteMany({ key: { $in: u.map((i) => new RegExp(`^user:${i}`)) } });
    await col('user_invites').deleteMany({ email: /^test-mt-/ });
    await col('access_mappings').deleteMany({ userId: { $in: u } });
    await col('users').deleteMany({ _id: { $in: u } });
  };
  await cleanup();
  outbox = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-'));
  const storage = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-store-'));
  const logs = [];
  const start = async (extra = {}, removed = []) => {
    const env = { ...process.env, TRUST_PROXY_HOPS: '1', LOG_FORMAT: 'json', MAIL_TRANSPORT: 'outbox', MAIL_OUTBOX_DIR: outbox, REGISTRATION_EMAIL_VERIFICATION: 'none',
      REGISTRATION_REQUIRE_APPROVAL: 'false', STORAGE_LOCAL_DIR: storage, VIRUS_SCAN_ENABLED: 'false', SCHEDULER_ENABLED: 'false', ...extra };
    for (const key of removed) delete env[key];
    const proc = spawn(process.execPath, ['dist/main.js'], { cwd: backend, env, stdio: ['ignore', 'pipe', 'pipe'] });
    proc.stdout.on('data', (d) => logs.push(String(d)));
    proc.stderr.on('data', (d) => logs.push(String(d)));
    for (let i = 0; i < 80; i++) { try { if ((await fetch(BASE + '/health/live')).ok) break; } catch {} if (proc.exitCode !== null) break; await sleep(250); }
    await sleep(500);
    return proc;
  };
  const stop = async (p) => { p.kill(); await sleep(800); };
  const login = (t, ip, pw = PW) => call('POST', '/auth/login', { body: { email: email(t), password: pw }, ip });
  let r;

  console.log('\n1. project.config.json drives the project identity');
  const projectFile = path.join(os.tmpdir(), `mt-project-${Date.now()}.json`);
  fs.writeFileSync(projectFile, JSON.stringify({ name: 'Shop X', slug: 'shop-x', description: 'Shop X accounts', branding: { primaryColor: '#0f766e', supportEmail: 'help@shopx.example' } }));
  const identityVars = ['APP_NAME', 'JWT_ISSUER', 'JWT_AUDIENCE', 'REFRESH_COOKIE_NAME', 'MAIL_FROM', 'MAIL_DEFAULT_LANGUAGE'];
  let child = await start({ PROJECT_CONFIG_PATH: projectFile, REGISTRATION_EMAIL_VERIFICATION: 'otp', METRICS_TOKEN: '' }, identityVars);
  const spec = await (await fetch(`http://localhost:${PORT}/api/docs/openapi.json`)).json();
  check('Swagger title / description from the project', spec.info.title === 'Shop X API' && spec.info.description.startsWith('Shop X: Shop X accounts'), spec.info.title);
  await call('POST', '/auth/register', { body: { email: email('px'), password: PW, firstName: 'Pia' } });
  const otp = (await waitMail('verification-code', email('px')))[0];
  check('emails: app name, brand color, support line', otp && /Shop X verification code/.test(otp.subject) && otp.body.includes('#0f766e') && otp.body.includes('Need help? Write to help@shopx.example') && !otp.body.includes('#4f46e5'), JSON.stringify(otp).slice(0, 300));
  await col('users').updateOne({ email: email('px') }, { $set: { isEmailVerified: true, status: 'ACTIVE' } });
  const res = await fetch(BASE + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '10.91.200.1' }, body: JSON.stringify({ email: email('px'), password: PW }) });
  const loginBody = await res.json();
  const claims = jwtPayload(loginBody.data.accessToken);
  check('refresh cookie and JWT issuer / audience from the slug', (res.headers.get('set-cookie') ?? '').startsWith('shop_x_refresh=') && claims.iss === 'shop-x' && claims.aud === 'shop-x-api', `${res.headers.get('set-cookie')?.slice(0, 30)} ${claims.iss} ${claims.aud}`);
  r = await call('GET', '/users/me');
  check('WWW-Authenticate realm = slug', r.status === 401 && /realm="shop-x"/.test(r.headers.get('www-authenticate')));
  r = await call('GET', '/metrics');
  check('metrics prefix = slug', r.status === 200 && r.text.includes('shop_x_http_request_duration_seconds') && !r.text.includes('authcore_http'));
  r = await call('POST', '/users/me/export', { token: loginBody.data.accessToken, body: { currentPassword: PW } });
  check('export file name = slug', /filename="shop-x-data-\d{4}-\d{2}-\d{2}\.json"/.test(r.headers.get('content-disposition') ?? ''), r.headers.get('content-disposition'));
  r = await call('POST', '/auth/register', { body: { email: email('px2'), password: PW, firstName: 'Pia', username: 'shop-x' } });
  check('the slug is a reserved username', r.status === 400, dump(r));
  await stop(child);
  fs.writeFileSync(projectFile, JSON.stringify({ name: 'Bad', slug: 'Bad Slug!' }));
  child = await start({ PROJECT_CONFIG_PATH: projectFile });
  check('invalid project.config.json -> refuses to start with a clear message', child.exitCode !== null && logs.join('').includes('"slug" must be lowercase letters'), logs.join('').slice(-300));
  await stop(child);
  fs.rmSync(projectFile, { force: true });

  console.log('\n2. Orphan file cleanup');
  child = await start({ FILES_ORPHAN_GRACE_MINUTES: '1', LOGIN_MAX_FAILED_ATTEMPTS: '3', LOGIN_MAX_FAILED_ATTEMPTS_PER_ACCOUNT: '6', LOGIN_LOCKOUT_MINUTES: '15' });
  for (const t of ['admin', 'user']) await call('POST', '/auth/register', { body: { email: email(t), password: PW, firstName: 'Mia' } });
  await col('users').updateOne({ email: email('admin') }, { $set: { role: 'ADMIN' } });
  const A = (await login('admin')).body.data.accessToken;
  const U = (await login('user')).body.data.accessToken;
  const form = new FormData(); form.append('file', new Blob([Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(300, 32)])]), 'keep.pdf'); form.append('purpose', 'DOCUMENT');
  const kept = (await call('POST', '/files', { token: U, form })).body.data;
  const keptKey = (await col('files').findOne({ _id: kept.id })).storageKey;
  const form2 = new FormData(); form2.append('file', new Blob([Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(400, 33)])]), 'lost.pdf'); form2.append('purpose', 'DOCUMENT');
  const lost = (await call('POST', '/files', { token: U, form: form2 })).body.data;
  fs.rmSync(path.join(storage, (await col('files').findOne({ _id: lost.id })).storageKey));
  const dir = path.join(storage, 'document', '2026', '01');
  fs.mkdirSync(dir, { recursive: true });
  const old = new Date(Date.now() - 2 * 3_600_000);
  const orphan = path.join(dir, `${crypto.randomUUID()}.pdf`);
  const temp = path.join(dir, `${crypto.randomUUID()}.pdf.${crypto.randomUUID()}.tmp`);
  const fresh = path.join(dir, `${crypto.randomUUID()}.pdf`);
  const foreign = path.join(storage, 'README.txt');
  for (const f of [orphan, temp, fresh, foreign]) fs.writeFileSync(f, 'x');
  for (const f of [orphan, temp, foreign]) fs.utimesSync(f, old, old);
  check('needs FILE_DELETE -> 403', (await call('POST', '/files/maintenance/orphan-cleanup', { token: U })).status === 403);
  r = await call('POST', '/files/maintenance/orphan-cleanup', { token: A });
  const result = r.body?.data;
  check('old orphan and temp file deleted, counts reported', r.status === 200 && result.orphanCount === 1 && result.tempCount === 1 && result.missingBytesCount === 1 && result.isLocked === false, dump(r));
  check('fresh file, real file and foreign file kept', !fs.existsSync(orphan) && !fs.existsSync(temp) && fs.existsSync(fresh) && fs.existsSync(foreign) && fs.existsSync(path.join(storage, keptKey)));
  r = await call('GET', `/files/${kept.id}/content`, { token: U });
  check('kept file still downloads', r.status === 200);

  console.log('\n3. Invite language');
  r = await call('POST', '/user-invites', { token: A, body: { email: email('inv-ta'), language: 'ta' } });
  check('invite with language ta', r.status === 201 && r.body.data.language === 'ta', dump(r));
  const invMail = (await waitMail('user-invite', email('inv-ta')))[0];
  check('invitation email in Tamil', invMail && invMail.body.includes('வணக்கம்,') && /அழைத்துள்ளார்/.test(invMail.subject), JSON.stringify(invMail).slice(0, 200));
  const token = (decodeQP(fs.readFileSync(path.join(outbox, fs.readdirSync(outbox).filter((f) => f.includes('user-invite')).sort().pop()), 'utf8')).match(/accept-invite\?token=([A-Za-z0-9_-]{43})/) || [])[1];
  r = await call('POST', '/user-invites/accept', { body: { token, password: 'Ivy!Pass2026x', confirmPassword: 'Ivy!Pass2026x', firstName: 'Ivy' } });
  check("accepting saves it as the user's language", r.status === 201 && (await col('users').findOne({ email: email('inv-ta') })).preferences.language === 'ta', dump(r));
  r = await call('POST', '/user-invites', { token: A, body: { email: email('inv-bad'), language: 'tamil' } });
  check('invalid language -> 400', r.status === 400);
  r = await call('POST', '/user-invites/bulk', { token: A, body: { invites: [{ email: email('inv-hi'), language: 'hi' }, { email: email('inv-en') }] } });
  check('bulk: per-person language', r.status === 201 && r.body.data.created.find((i) => i.email === email('inv-hi')).language === 'hi' && r.body.data.created.find((i) => i.email === email('inv-en')).language === null, dump(r));

  console.log('\n4. Per-IP and account-wide lockouts');
  await call('POST', '/auth/register', { body: { email: email('victim'), password: PW, firstName: 'Vic' } });
  for (let i = 0; i < 3; i++) await login('victim', '10.91.250.1', `Wr0ng!${i}`);
  let lockMails = await waitMail('account-locked', email('victim'));
  check('IP lock email: "from IP address", own devices still work', lockMails.length === 1 && lockMails[0].body.includes('from IP address 10.91.250.1') && lockMails[0].body.includes('own devices still works'), JSON.stringify(lockMails[0] ?? {}).slice(0, 300));
  check('locked IP gets 429, another IP signs in', (await login('victim', '10.91.250.1')).status === 429 && (await login('victim', '10.91.250.9')).status === 200);
  for (let i = 0; i < 3; i++) await login('victim', '10.91.250.2', `Wr0ng!${i}`);
  for (let i = 0; i < 3; i++) await login('victim', '10.91.250.3', `Wr0ng!${i}`);
  await sleep(500);
  check('more locks within the lockout period: no extra emails', (await waitMail('account-locked', email('victim'))).length === 1);
  check('failures from many IPs -> whole account locked', (await login('victim', '10.91.250.10')).status === 429);
  const victimId = String((await col('users').findOne({ email: email('victim') }))._id);
  r = await call('GET', `/admin/users/${victimId}`, { token: A });
  check('admin sees the lock and locked IPs', r.body.data.isLocked === true && r.body.data.lockedIpCount >= 2, JSON.stringify({ l: r.body.data.isLocked, n: r.body.data.lockedIpCount }));
  r = await call('POST', `/admin/users/${victimId}/unlock`, { token: A });
  check('unlock clears account and IP locks', r.body.data.isLocked === false && r.body.data.lockedIpCount === 0 && (await login('victim', '10.91.250.1')).status === 200, dump(r));
  r = await call('GET', `/users/me/activity?event=ACCOUNT_LOCKED`, { token: (await login('victim', '10.91.250.11')).body.data.accessToken });
  check('locks recorded with their scope', r.body.data.some((a) => a.details.scope === 'ip') && r.body.data.some((a) => a.details.scope === 'account'), JSON.stringify(r.body.data.map((a) => a.details.scope)));
  await stop(child);

  await cleanup();
  fs.rmSync(storage, { recursive: true, force: true });
  await mongoose.disconnect();
  console.log(`\n${failures === 0 ? 'ALL PASSED' : `${failures} FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
