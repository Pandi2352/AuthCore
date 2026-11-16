// E2E: self-revoke logging, data export, metrics, JWT key rotation, localized emails.
// Run with: npm run test:e2e -- ops   (see test/e2e/README.md)
// Usage: node ops-test.js <backendDir>
const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const backend = process.argv[2] || path.resolve(__dirname, '..', '..', '..');
const mongoose = require(path.join(backend, 'node_modules', 'mongoose'));
const BASE = `http://localhost:${process.env.E2E_PORT || 3000}/api/v1`;
const PW = 'Str0ng!Passw0rd';
const SECRET_A = 'rotation-secret-A-' + crypto.randomBytes(24).toString('hex');
const SECRET_B = 'rotation-secret-B-' + crypto.randomBytes(24).toString('hex');
const METRICS_TOKEN = 'metrics-' + crypto.randomBytes(16).toString('hex');
const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const FIREFOX = 'Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0';
let failures = 0;
let ipN = 1;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (label, ok, detail = '') => { if (!ok) failures++; console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${!ok && detail !== '' ? `  -> ${detail}` : ''}`); };
const dump = (r) => `${r.status} ${(r.text ?? JSON.stringify(r.body)).slice(0, 300)}`;
async function call(method, route, { body, token, ua = 'ops-test', ip, headers: extra = {} } = {}) {
  const headers = { 'X-Forwarded-For': ip ?? `10.92.${Math.floor(ipN / 250)}.${(ipN++ % 250) + 1}`, 'User-Agent': ua, ...extra };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE + route, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let parsed = null; try { parsed = JSON.parse(text); } catch {}
  return { status: res.status, body: parsed, text, headers: res.headers };
}
const email = (t) => `test-op-${t}@example.com`;

// Minimal MIME decoding for the outbox (.eml): encoded-word subject, QP / base64 parts.
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
  const parts = raw.split(/\r?\n--[^\r\n]+/);
  let body = '';
  for (const part of parts) {
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

async function main() {
  await mongoose.connect((process.env.E2E_MONGODB_URI || 'mongodb://localhost:27017/authcore_e2e'));
  const db = mongoose.connection.db;
  const col = (n) => db.collection(n);
  const ids = async () => (await col('users').find({ email: /^test-op-/ }).toArray()).map((u) => u._id);
  const cleanup = async () => {
    const u = await ids();
    for (const c of ['sessions', 'user_activities', 'known_devices', 'password_resets', 'files']) await col(c).deleteMany({ $or: [{ userId: { $in: u } }, { ownerId: { $in: u } }] });
    await col('access_mappings').deleteMany({ $or: [{ userId: { $in: u } }, { assignedBy: { $in: u } }] });
    await col('login_attempts').deleteMany({ key: { $in: u.map((i) => `user:${i}`) } });
    await col('user_invites').deleteMany({ email: /^test-op-/ });
    await col('access_control_audit_logs').deleteMany({ $or: [{ changedBy: { $in: u } }, { entityId: { $in: u } }] });
    await col('users').deleteMany({ _id: { $in: u } });
  };
  await cleanup();
  outbox = fs.mkdtempSync(path.join(os.tmpdir(), 'op-'));
  const storage = fs.mkdtempSync(path.join(os.tmpdir(), 'op-store-'));
  let logs = [];
  const start = async (extra = {}) => {
    const proc = spawn(process.execPath, ['dist/main.js'], {
      cwd: backend,
      env: { ...process.env, TRUST_PROXY_HOPS: '1', LOG_FORMAT: 'json', MAIL_TRANSPORT: 'outbox', MAIL_OUTBOX_DIR: outbox, REGISTRATION_EMAIL_VERIFICATION: 'none', REGISTRATION_REQUIRE_APPROVAL: 'false',
        VIRUS_SCAN_ENABLED: 'false', STORAGE_LOCAL_DIR: storage, JWT_ACCESS_SECRET: SECRET_A, JWT_ACCESS_PREVIOUS_SECRETS: '', METRICS_ENABLED: 'true', METRICS_TOKEN, MAIL_DEFAULT_LANGUAGE: 'hi', PASSWORD_RESET_METHOD: 'otp', ...extra },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    proc.stdout.on('data', (d) => logs.push(String(d)));
    proc.stderr.on('data', (d) => logs.push(String(d)));
    for (let i = 0; i < 80; i++) { try { if ((await fetch(BASE + '/health/live')).ok) break; } catch {} await sleep(250); }
    await sleep(600);
    return proc;
  };
  const stop = async (p) => { p.kill(); await sleep(800); };
  let child = await start();
  for (const t of ['admin', 'me', 'ta', 'hi', 'fr']) await call('POST', '/auth/register', { body: { email: email(t), password: PW, firstName: 'Opal' } });
  await col('users').updateOne({ email: email('admin') }, { $set: { role: 'ADMIN' } });
  const login = async (t, ua = CHROME) => (await call('POST', '/auth/login', { body: { email: email(t), password: PW }, ua })).body?.data?.accessToken;
  const A = await login('admin');
  let r;

  console.log('\n1. Signing out one of my devices is logged');
  const me1 = await login('me', CHROME);
  await login('me', FIREFOX);
  const sessions = (await call('GET', '/auth/sessions', { token: me1 })).body.data;
  const other = sessions.find((s) => !s.isCurrent);
  r = await call('DELETE', `/auth/sessions/${other.id}`, { token: me1 });
  check('revoke my other device', r.status === 200, dump(r));
  r = await call('GET', '/users/me/activity?event=SESSION_REVOKED', { token: me1 });
  const entry = r.body.data[0];
  check('SESSION_REVOKED recorded with the device name', r.body.meta.totalItems === 1 && entry.details.revokedSessionId === other.id && /Firefox/.test(entry.details.deviceName) && entry.details.isCurrentSession === false, dump(r));
  r = await call('GET', `/admin/activity/login-history?events=SESSION_REVOKED&search=test-op-me`, { token: A });
  check('shows in the admin login history', r.body.meta.totalItems === 1, dump(r));

  console.log('\n2. Download my data');
  await call('PATCH', '/users/me/attributes', { token: me1, body: { attributes: { nickname: 'Opie', address: { locality: 'Madurai' } } } });
  const form = new FormData(); form.append('file', new Blob([Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(200, 32)])]), 'id.pdf'); form.append('purpose', 'DOCUMENT');
  await fetch(BASE + '/files', { method: 'POST', headers: { Authorization: `Bearer ${me1}`, 'X-Forwarded-For': '10.92.200.1' }, body: form });
  const IP = '10.92.250.10';
  r = await call('POST', '/users/me/export', { token: me1, body: { currentPassword: 'Wrong!Pass000' }, ip: IP });
  check('wrong password -> 400 AUTH_INVALID_CURRENT_PASSWORD (same as other account actions)', r.status === 400 && r.body.code === 'AUTH_INVALID_CURRENT_PASSWORD', dump(r));
  r = await call('POST', '/users/me/export', { token: me1, body: {}, ip: IP });
  check('no password -> 400', r.status === 400);
  r = await call('POST', '/users/me/export', { token: me1, body: { currentPassword: PW }, ip: IP });
  const data = r.body;
  check('JSON file download (attachment, no envelope)', r.status === 200 && /^attachment; filename="authcore-data-\d{4}-\d{2}-\d{2}\.json"$/.test(r.headers.get('content-disposition')) && r.headers.get('content-type').startsWith('application/json') && data && data.success === undefined, dump(r));
  check('account, personal details, sessions, devices, files, groups, activity', data.account.email === email('me') && data.personalDetails.nickname === 'Opie' && data.personalDetails.address.locality === 'Madurai' && data.activeSessions.length === 1 && data.knownDevices.length === 2 && data.files.length === 1 && data.files[0].originalName === 'id.pdf' && Array.isArray(data.groupsAndRoles) && data.activity.some((a) => a.event === 'LOGIN') && data.exportFormatVersion === 1, JSON.stringify(Object.keys(data)));
  check('no secrets in the export', !/argon2|passwordHash|refreshToken|tokenHash|codeHash/i.test(r.text));
  r = await call('GET', '/users/me/activity?event=DATA_EXPORTED', { token: me1 });
  check('DATA_EXPORTED recorded', r.body.meta.totalItems === 1);
  await call('POST', '/users/me/export', { token: me1, body: { currentPassword: PW }, ip: IP });
  r = await call('POST', '/users/me/export', { token: me1, body: { currentPassword: PW }, ip: IP });
  check('limited (3 per hour) -> 429', r.status === 429, dump(r));

  console.log('\n3. Metrics');
  r = await call('GET', '/metrics');
  check('no token -> 401', r.status === 401, dump(r));
  check('wrong token -> 401', (await call('GET', '/metrics', { headers: { Authorization: 'Bearer nope' } })).status === 401);
  r = await call('GET', '/metrics', { headers: { Authorization: `Bearer ${METRICS_TOKEN}` } });
  const metrics = r.text;
  check('Prometheus text format', r.status === 200 && r.headers.get('content-type').startsWith('text/plain') && metrics.includes('# TYPE authcore_http_request_duration_seconds histogram'), dump(r));
  check('process metrics', /authcore_process_cpu_user_seconds_total \d/.test(metrics) && metrics.includes('authcore_nodejs_eventloop_lag'));
  check('route patterns, not real paths', metrics.includes('route="/api/v1/auth/sessions/:sessionId"') && !metrics.includes(other.id));
  check('user events counted', /authcore_user_events_total\{event="LOGIN",success="true"\} \d+/.test(metrics) && /authcore_user_events_total\{event="SESSION_REVOKED",success="true"\} 1/.test(metrics));
  check('no personal data in metrics', !metrics.includes('test-op-') && !metrics.includes('@example.com'));
  check('not in Swagger', !JSON.stringify((await (await fetch(`http://localhost:${process.env.E2E_PORT || 3000}/api/docs/openapi.json`)).json()).paths ?? {}).includes('/metrics'));

  console.log('\n4. Localized emails');
  for (const [t, lang] of [['ta', 'ta'], ['hi', 'hi-IN'], ['fr', 'fr']]) {
    const tok = await login(t);
    await call('PATCH', '/users/me/preferences', { token: tok, body: { language: lang, timezone: 'Asia/Kolkata' } });
    await call('POST', '/auth/forgot-password', { body: { email: email(t) } });
  }
  let m = (await waitMail('password-reset', email('ta')))[0];
  check('Tamil reset email (subject + body + html lang)', m && /கடவுச்சொல்/.test(m.subject) && /^\d{6} /.test(m.subject) && m.body.includes('வணக்கம் Opal') && m.body.includes('lang="ta"'), JSON.stringify(m).slice(0, 300));
  m = (await waitMail('password-reset', email('hi')))[0];
  check('Hindi ("hi-IN") reset email', m && /पासवर्ड/.test(m.subject) && m.body.includes('नमस्ते Opal'), JSON.stringify(m).slice(0, 300));
  m = (await waitMail('password-reset', email('fr')))[0];
  check('unsupported language (fr) -> English', m && /password reset code/.test(m.subject) && m.body.includes('Hi Opal'), JSON.stringify(m).slice(0, 300));
  await login('ta', FIREFOX);
  m = (await waitMail('new-device-login', email('ta')))[0];
  check('Tamil new-device alert with local date / time zone', m && m.body.includes('நேரம்:') && m.body.includes('(Asia/Kolkata)'), JSON.stringify(m).slice(0, 400));
  await call('POST', '/user-invites', { token: A, body: { email: email('invitee') } });
  m = (await waitMail('user-invite', email('invitee')))[0];
  check('invite uses MAIL_DEFAULT_LANGUAGE (hi)', m && m.body.includes('आमंत्रण') && m.body.includes('नमस्ते,'), JSON.stringify(m).slice(0, 300));

  console.log('\n5. JWT key rotation');
  const oldToken = await login('me');
  const header = JSON.parse(Buffer.from(oldToken.split('.')[0], 'base64url').toString());
  const kidA = crypto.createHash('sha256').update(SECRET_A).digest('hex').slice(0, 16);
  check('token header has kid of the signing key, HS256', header.kid === kidA && header.alg === 'HS256', JSON.stringify(header));
  await stop(child);
  child = await start({ JWT_ACCESS_SECRET: SECRET_B, JWT_ACCESS_PREVIOUS_SECRETS: SECRET_A });
  check('after rotation: old token still accepted (previous secret)', (await call('GET', '/users/me', { token: oldToken })).status === 200);
  const newToken = await login('me');
  const newKid = JSON.parse(Buffer.from(newToken.split('.')[0], 'base64url').toString()).kid;
  check('new tokens signed with the new key', newKid === crypto.createHash('sha256').update(SECRET_B).digest('hex').slice(0, 16) && (await call('GET', '/users/me', { token: newToken })).status === 200);
  const [h, p] = oldToken.split('.');
  const forgedHeader = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT', kid: 'ffffffffffffffff' })).toString('base64url');
  const forged = `${forgedHeader}.${p}.${crypto.createHmac('sha256', SECRET_B).update(`${forgedHeader}.${p}`).digest('base64url')}`;
  check('unknown kid -> 401', (await call('GET', '/users/me', { token: forged })).status === 401);
  const swapped = `${h}.${p}.${crypto.createHmac('sha256', 'not-the-secret-not-the-secret-123').update(`${h}.${p}`).digest('base64url')}`;
  check('wrong signature -> 401', (await call('GET', '/users/me', { token: swapped })).status === 401);
  await stop(child);
  child = await start({ JWT_ACCESS_SECRET: SECRET_B, JWT_ACCESS_PREVIOUS_SECRETS: '' });
  check('previous secret removed: old token rejected, new one fine', (await call('GET', '/users/me', { token: oldToken })).status === 401 && (await call('GET', '/users/me', { token: newToken })).status === 200);
  await stop(child);
  child = await start({ JWT_ACCESS_SECRET: SECRET_B, JWT_ACCESS_PREVIOUS_SECRETS: 'short' });
  check('invalid previous secret (< 32 chars) -> refuses to start', !(await fetch(BASE + '/health/live').then((x) => x.ok).catch(() => false)));
  await stop(child);
  child = await start({ METRICS_ENABLED: 'false' });
  check('METRICS_ENABLED=false -> 404', (await call('GET', '/metrics', { headers: { Authorization: `Bearer ${METRICS_TOKEN}` } })).status === 404);
  await stop(child);

  await cleanup();
  fs.rmSync(storage, { recursive: true, force: true });
  await mongoose.disconnect();
  console.log(`\n${failures === 0 ? 'ALL PASSED' : `${failures} FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
