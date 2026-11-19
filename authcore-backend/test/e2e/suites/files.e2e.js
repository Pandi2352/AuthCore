// E2E: common file uploads (local folder storage), avatars, permissions, purge.
// Run with: npm run test:e2e -- files   (see test/e2e/README.md)
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
const ip = () => `10.95.${Math.floor(ipN / 250)}.${(ipN++ % 250) + 1}`;
const dump = (r) => `${r.status} ${JSON.stringify(r.body).slice(0, 300)}`;
async function call(method, route, { body, token, form, raw } = {}) {
  const headers = { 'X-Forwarded-For': ip(), 'User-Agent': 'files-test' };
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  const res = await fetch(BASE + route, { method, headers, body: payload });
  if (raw) return { status: res.status, headers: res.headers, bytes: Buffer.from(await res.arrayBuffer()) };
  const text = await res.text();
  let parsed; try { parsed = JSON.parse(text); } catch { parsed = { text }; }
  return { status: res.status, body: parsed, headers: res.headers };
}
const formOf = (parts) => { const f = new FormData(); for (const [k, v, name] of parts) { if (v instanceof Buffer) f.append(k, new Blob([v]), name); else f.append(k, v); } return f; };
const upload = (token, buf, name, purpose = 'DOCUMENT') => call('POST', '/files', { token, form: formOf([['file', buf, name], ...(purpose ? [['purpose', purpose]] : [])]) });
const avatar = (route, token, buf, name = 'me.png') => call('POST', route, { token, form: formOf([['file', buf, name]]) });
const PNG = (size = 200) => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(size, 7)]);
// Real images (uploads are decoded and re-encoded now); PNG() junk is only for size checks.
const sharp = require(path.join(backend, 'node_modules', 'sharp'));
const solid = (width, height, color = '#3366cc') => sharp({ create: { width, height, channels: 3, background: color } });
let JPEG; let WEBP; let REALPNG; let GPS_PHOTO; let GIF; let BOMB;
const MARKER = 'AUTHCORE-TEST-MALWARE-MARKER';
// Fake clamd (real INSTREAM protocol): FOUND when the stream contains MARKER.
const net = require('node:net');
const clam = { mode: 'up', scans: 0, maxChunks: 0 };
const clamServer = net.createServer((socket) => {
  if (clam.mode === 'down') { socket.destroy(); return; }
  let buf = Buffer.alloc(0);
  socket.on('data', (d) => {
    buf = Buffer.concat([buf, d]);
    if (buf.subarray(0, 6).toString() === 'zPING\0') { socket.end('PONG\0'); return; }
    if (buf.subarray(0, 10).toString() !== 'zINSTREAM\0') return;
    let off = 10; const parts = []; let chunks = 0;
    while (off + 4 <= buf.length) {
      const len = buf.readUInt32BE(off);
      if (len === 0) {
        clam.scans++; clam.maxChunks = Math.max(clam.maxChunks, chunks);
        const content = Buffer.concat(parts).toString('latin1');
        socket.end(content.includes(MARKER) ? 'stream: AuthCore.Test.Marker FOUND\0' : 'stream: OK\0');
        return;
      }
      if (off + 4 + len > buf.length) return;
      parts.push(buf.subarray(off + 4, off + 4 + len)); chunks++; off += 4 + len;
    }
  });
});
const PDF = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(500, 3)]);
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
const HTML = Buffer.from('<html><script>alert(1)</script></html>');
const email = (t) => `test-fl-${t}@example.com`;

async function main() {
  await mongoose.connect((process.env.E2E_MONGODB_URI || 'mongodb://localhost:27017/authcore_e2e'));
  const db = mongoose.connection.db;
  const col = (n) => db.collection(n);
  const ids = async () => (await col('users').find({ email: /^test-fl-/ }).toArray()).map((u) => u._id);
  const cleanup = async () => {
    const u = await ids();
    for (const c of ['sessions', 'user_activities', 'files']) await col(c).deleteMany({ $or: [{ userId: { $in: u } }, { ownerId: { $in: u } }] });
    await col('access_mappings').deleteMany({ $or: [{ userId: { $in: u } }, { assignedBy: { $in: u } }] });
    await col('groups').deleteMany({ createdBy: { $in: u } });
    await col('access_control_audit_logs').deleteMany({ $or: [{ changedBy: { $in: u } }, { entityId: { $in: u } }] });
    await col('login_attempts').deleteMany({ key: { $in: u.map((i) => `user:${i}`) } });
    await col('users').deleteMany({ _id: { $in: u } });
  };
  await cleanup();
  const storageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fl-store-'));
  const outbox = fs.mkdtempSync(path.join(os.tmpdir(), 'fl-'));
  const logs = [];
  JPEG = await solid(300, 200).jpeg().toBuffer();
  WEBP = await solid(300, 300, '#cc6633').webp().toBuffer();
  REALPNG = await solid(256, 256, '#33cc66').png().toBuffer();
  GIF = await solid(64, 64).gif().toBuffer();
  BOMB = await solid(1800, 1800).png().toBuffer();
  // 2000x1000 photo, EXIF orientation 6 (rotate 90°), camera + GPS location
  GPS_PHOTO = await solid(2000, 1000, '#996633').jpeg({ quality: 60 })
    .withExif({ IFD0: { Make: 'TestCam', Model: 'X1', Copyright: 'secret' }, IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '12/1 58/1 0/1', GPSLongitudeRef: 'E', GPSLongitude: '77/1 35/1 0/1' } })
    .withMetadata({ orientation: 6 }).toBuffer();
  await new Promise((r) => clamServer.listen(3399, '127.0.0.1', r));
  const baseEnv = { ...process.env, TRUST_PROXY_HOPS: '1', LOG_FORMAT: 'json', MAIL_TRANSPORT: 'outbox', MAIL_OUTBOX_DIR: outbox, REGISTRATION_EMAIL_VERIFICATION: 'none', REGISTRATION_REQUIRE_APPROVAL: 'false',
    STORAGE_LOCAL_DIR: storageDir, UPLOAD_MAX_FILE_SIZE_MB: '1', UPLOAD_AVATAR_MAX_SIZE_MB: '0.1', UPLOAD_MAX_FILES_PER_USER: '4', FILES_PUBLIC_BASE_URL: `http://localhost:${process.env.E2E_PORT || 3000}/api/v1/files/public`,
    IMAGE_AVATAR_SIZE: '128', IMAGE_MAX_DIMENSION: '800', IMAGE_MAX_INPUT_PIXELS: '3000000',
    VIRUS_SCAN_ENABLED: 'true', CLAMAV_HOST: '127.0.0.1', CLAMAV_PORT: '3399', CLAMAV_TIMEOUT_MS: '3000', VIRUS_SCAN_FAIL_CLOSED: 'true' };
  const start = async (extra = {}) => {
    const proc = spawn(process.execPath, ['dist/main.js'], { cwd: backend, env: { ...baseEnv, ...extra }, stdio: ['ignore', 'pipe', 'pipe'] });
    proc.stdout.on('data', (d) => logs.push(String(d)));
    proc.stderr.on('data', (d) => logs.push(String(d)));
    for (let i = 0; i < 80; i++) { try { if ((await fetch(BASE + '/health/live')).ok) break; } catch {} await sleep(250); }
    await sleep(500);
    return proc;
  };
  let child = await start();
  const onDisk = (key) => fs.existsSync(path.join(storageDir, key));
  const keyOf = async (id) => (await col('files').findOne({ _id: id }))?.storageKey;

  for (const t of ['admin', 'me', 'other', 'reader']) await call('POST', '/auth/register', { body: { email: email(t), password: PW, firstName: 'Fia' } });
  await col('users').updateOne({ email: email('admin') }, { $set: { role: 'ADMIN' } });
  const tok = async (t) => (await call('POST', '/auth/login', { body: { email: email(t), password: PW } })).body.data.accessToken;
  const uid = async (t) => String((await col('users').findOne({ email: email(t) }))._id);
  const A = await tok('admin'); const me = await tok('me'); const other = await tok('other');
  const meId = await uid('me'); const otherId = await uid('other');
  // reader: FILE_READ via a user-admin role (users, user schema, files) in a group
  const userAdminRole = await (async (modules, name) => {
    // The old built-in role: a custom role holding these modules' system permissions.
    const perms = await col('permissions').find({ isSystem: true, isDeleted: false, metadata: { $elemMatch: { key: 'module', value: { $in: modules } } } }).toArray();
    const stamp = Date.now();
    const res = await call('POST', '/roles/setup', { token: A, body: { roleKey: `E2E_${name}_${stamp}`, roleName: `E2E ${name} ${stamp}`, category: 'CUSTOM', permissionIds: perms.map((p) => p._id) } });
    return { _id: res.body.data.role.id };
  })(['users', 'user-schema', 'files'], 'USER_ADMIN');
  const group = (await call('POST', '/groups', { token: A, body: { category: 'TEAM', groupName: `Files Readers ${Date.now()}` } })).body.data;
  await call('POST', '/access-mappings/group-roles', { token: A, body: { groupId: group.id, roleIds: [userAdminRole._id] } });
  await call('POST', '/access-mappings/group-users', { token: A, body: { groupId: group.id, userIds: [await uid('reader')] } });
  const reader = await tok('reader');
  let r;

  console.log('\n1. Upload a document');
  r = await upload(me, PDF, 'Passport Scan.pdf');
  const doc = r.body.data;
  check('PDF DOCUMENT -> 201, private, content-detected type', r.status === 201 && doc.visibility === 'PRIVATE' && doc.mimeType === 'application/pdf' && doc.size === PDF.length && doc.originalName === 'Passport Scan.pdf' && doc.url === `/api/v1/files/${doc.id}/content`, dump(r));
  const docKey = await keyOf(doc.id);
  check('stored in the local folder as document/yyyy/mm/<id>.pdf', /^document\/\d{4}\/\d{2}\/[0-9a-f-]+\.pdf$/.test(docKey) && onDisk(docKey) && fs.readFileSync(path.join(storageDir, docKey)).equals(PDF), docKey);
  check('sha256 recorded', doc.sha256 === require('node:crypto').createHash('sha256').update(PDF).digest('hex'));
  r = await upload(me, JPEG, 'photo.jpeg');
  const jpgId = r.body.data?.id;
  check('JPEG document', r.status === 201 && r.body.data.mimeType === 'image/jpeg');
  r = await upload(me, PDF, '../../etc/pa"ss;wd<x>.pdf');
  check('file name sanitized (no path, quotes, specials)', r.status === 201 && r.body.data.originalName === 'passwdx.pdf', r.body.data?.originalName);
  const sanitizedId = r.body.data.id;

  console.log('\n2. Upload validation');
  check('no token -> 401', (await upload(undefined, PDF, 'a.pdf')).status === 401);
  r = await call('POST', '/files', { token: me, form: formOf([['purpose', 'DOCUMENT']]) });
  check('no file -> 400 FILE_REQUIRED', r.status === 400 && r.body.code === 'FILE_REQUIRED', dump(r));
  r = await upload(me, Buffer.alloc(0), 'empty.pdf');
  check('empty file -> 400 FILE_REQUIRED', r.status === 400 && r.body.code === 'FILE_REQUIRED', dump(r));
  r = await upload(me, PDF, 'a.pdf', null);
  check('no purpose -> 400', r.status === 400 && JSON.stringify(r.body.errors).includes('purpose'), dump(r));
  r = await upload(me, PDF, 'a.pdf', 'SECRET');
  check('unknown purpose -> 400', r.status === 400);
  r = await upload(me, SVG, 'logo.png');
  check('SVG renamed .png -> 415 FILE_TYPE_NOT_ALLOWED', r.status === 415 && r.body.code === 'FILE_TYPE_NOT_ALLOWED', dump(r));
  r = await upload(me, HTML, 'page.pdf');
  check('HTML renamed .pdf -> 415', r.status === 415);
  r = await upload(me, PDF, 'doc.pdf', 'AVATAR');
  check('PDF as AVATAR -> 415 (allowed list in message)', r.status === 415 && /JPG, PNG, WEBP/.test(r.body.message), r.body.message);
  r = await upload(me, PNG(1.2 * 1024 * 1024), 'big.png');
  check('over UPLOAD_MAX_FILE_SIZE_MB -> 413 FILE_TOO_LARGE', r.status === 413 && r.body.code === 'FILE_TOO_LARGE', dump(r));
  r = await call('POST', '/files', { token: me, form: formOf([['file', PDF, 'a.pdf'], ['file', PDF, 'b.pdf'], ['purpose', 'DOCUMENT']]) });
  check('two files -> 400', r.status === 400, dump(r));
  r = await call('POST', '/files', { token: me, form: formOf([['other', PDF, 'a.pdf'], ['purpose', 'DOCUMENT']]) });
  check('wrong field name -> 400', r.status === 400);
  r = await call('PATCH', '/users/me', { token: me, form: formOf([['firstName', 'X']]) });
  check('multipart on a JSON route still 415', r.status === 415, dump(r));
  r = await call('POST', '/files', { token: me, body: { purpose: 'DOCUMENT' } });
  check('JSON to upload route -> 400 FILE_REQUIRED', r.status === 400 && r.body.code === 'FILE_REQUIRED', dump(r));
  r = await upload(me, PDF, 'four.pdf');
  r = await upload(me, PDF, 'five.pdf');
  check('UPLOAD_MAX_FILES_PER_USER reached -> 409 FILE_LIMIT_REACHED', r.status === 409 && r.body.code === 'FILE_LIMIT_REACHED', dump(r));
  check('rejected uploads leave nothing on disk', (await col('files').countDocuments({ ownerId: meId })) === 4);

  console.log('\n3. Download and access');
  r = await call('GET', `/files/${doc.id}/content`, { token: me, raw: true });
  check('owner downloads the exact bytes', r.status === 200 && r.bytes.equals(PDF) && r.headers.get('content-type') === 'application/pdf');
  check('safe headers: nosniff, CSP sandbox, attachment, private no-store, ETag', r.headers.get('x-content-type-options') === 'nosniff' && /sandbox/.test(r.headers.get('content-security-policy')) && /^attachment; filename="Passport Scan.pdf"/.test(r.headers.get('content-disposition')) && /no-store/.test(r.headers.get('cache-control')) && r.headers.get('etag') === `"${doc.sha256}"`, [...r.headers].join(' | '));
  r = await call('GET', `/files/${sanitizedId}/content`, { token: me, raw: true });
  check('Content-Disposition of the sanitized name', r.headers.get('content-disposition').startsWith('attachment; filename="passwdx.pdf"'));
  r = await call('GET', `/files/${doc.id}`, { token: me });
  check('metadata', r.status === 200 && r.body.data.id === doc.id);
  check('another user -> 404 (not 403)', (await call('GET', `/files/${doc.id}/content`, { token: other })).status === 404 && (await call('GET', `/files/${doc.id}`, { token: other })).status === 404);
  check('FILE_READ (user-admin role) can read', (await call('GET', `/files/${doc.id}/content`, { token: reader, raw: true })).status === 200);
  check('ADMIN can read', (await call('GET', `/files/${doc.id}`, { token: A })).status === 200);
  check('private file not on the public URL -> 404', (await call('GET', `/files/public/${doc.id}`, { raw: true })).status === 404);
  check('no token -> 401', (await call('GET', `/files/${doc.id}/content`, { raw: true })).status === 401);
  check('invalid id -> 400', (await call('GET', '/files/..%2F..%2Fetc/content', { token: me })).status === 400 || (await call('GET', '/files/not-an-id', { token: me })).status === 400);
  r = await call('GET', '/files?purpose=DOCUMENT&limit=2', { token: me });
  check('list mine (paginated, purpose filter)', r.status === 200 && r.body.data.length === 2 && r.body.meta.totalItems === 4, dump(r));
  check("other's list without FILE_READ -> 403", (await call('GET', `/files?ownerId=${meId}`, { token: other })).status === 403);
  r = await call('GET', `/files?ownerId=${meId}`, { token: reader });
  check("other's list with FILE_READ", r.status === 200 && r.body.meta.totalItems === 4);
  check('own list is separate', (await call('GET', '/files', { token: other })).body.meta.totalItems === 0);

  console.log('\n4. Delete');
  check('another user cannot delete -> 404', (await call('DELETE', `/files/${doc.id}`, { token: other })).status === 404);
  check('FILE_DELETE (user-admin role) can delete', (await call('DELETE', `/files/${jpgId}`, { token: reader })).status === 200 && !(await col('files').findOne({ _id: jpgId })));
  r = await call('DELETE', `/files/${sanitizedId}`, { token: me });
  const sanitizedKey = 'gone';
  check('owner deletes: record and bytes removed', r.status === 200 && !(await col('files').findOne({ _id: sanitizedId })));
  r = await call('DELETE', `/files/${doc.id}`, { token: A });
  check('ADMIN deletes', r.status === 200 && !onDisk(docKey), dump(r));
  check('deleted -> 404', (await call('GET', `/files/${doc.id}`, { token: me })).status === 404);
  void sanitizedKey;

  console.log('\n5. Profile picture');
  r = await avatar('/users/me/avatar', me, REALPNG, 'Me.PNG');
  const av1 = r.body.data;
  check('upload avatar -> 201 public URL', r.status === 201 && av1.visibility === 'PUBLIC' && av1.purpose === 'AVATAR' && av1.url === `http://localhost:${process.env.E2E_PORT || 3000}/api/v1/files/public/${av1.id}`, dump(r));
  r = await call('GET', '/users/me', { token: me });
  check('picture variable set to the URL', r.body.data.attributes.picture === av1.url);
  r = await call('GET', `/files/public/${av1.id}`, { raw: true });
  check('public URL without sign-in: inline image, cacheable, cross-origin', r.status === 200 && r.headers.get('content-type') === 'image/png' && r.headers.get('content-disposition').startsWith('inline') && /public, max-age=\d+, immutable/.test(r.headers.get('cache-control')) && r.headers.get('cross-origin-resource-policy') === 'cross-origin', [...r.headers].join(' | '));
  const av1Key = await keyOf(av1.id);
  r = await avatar('/users/me/avatar', me, WEBP, 'new.webp');
  const av2 = r.body.data;
  check('new avatar replaces the old one (record + bytes gone, old URL 404)', r.status === 201 && av2.mimeType === 'image/webp' && !onDisk(av1Key) && (await call('GET', `/files/public/${av1.id}`, { raw: true })).status === 404);
  check('avatars do not count toward the document quota', (await col('files').countDocuments({ ownerId: meId, purpose: 'AVATAR' })) === 1);
  check('GET /users/me/avatar', (await call('GET', '/users/me/avatar', { token: me })).body.data.id === av2.id);
  r = await avatar('/users/me/avatar', me, PNG(150 * 1024));
  check('avatar over UPLOAD_AVATAR_MAX_SIZE_MB -> 413', r.status === 413 && r.body.code === 'FILE_TOO_LARGE');
  r = await avatar('/users/me/avatar', me, PDF, 'x.png');
  check('avatar must be an image -> 415', r.status === 415);
  check('failed avatar uploads keep the current one', (await call('GET', '/users/me/avatar', { token: me })).body.data.id === av2.id);
  r = await call('DELETE', '/users/me/avatar', { token: me });
  check('remove avatar: picture cleared, URL 404', r.status === 200 && r.body.data.isRemoved === true && (await call('GET', '/users/me', { token: me })).body.data.attributes.picture === undefined && (await call('GET', `/files/public/${av2.id}`, { raw: true })).status === 404);
  check('no avatar -> 404', (await call('GET', '/users/me/avatar', { token: me })).status === 404);
  r = await avatar(`/admin/users/${otherId}/avatar`, A, JPEG, 'by-admin.jpg');
  check('admin uploads for a user (uploadedBy = admin)', r.status === 201 && r.body.data.ownerId === otherId && r.body.data.uploadedBy === (await uid('admin')), dump(r));
  check('admin details show picture', (await call('GET', `/admin/users/${otherId}`, { token: A })).body.data.attributes.picture === r.body.data.url);
  check('admin avatar needs USER_UPDATE -> 403', (await avatar(`/admin/users/${meId}/avatar`, other, JPEG)).status === 403);
  check('admin remove avatar', (await call('DELETE', `/admin/users/${otherId}/avatar`, { token: A })).body.data.isRemoved === true);

  console.log('\n6. Permanent deletion removes files; health');
  await avatar('/users/me/avatar', me, REALPNG);
  const myKeys = (await col('files').find({ ownerId: meId }).toArray()).map((f) => f.storageKey);
  check('user has files on disk', myKeys.length === 2 && myKeys.every(onDisk));
  await call('DELETE', `/admin/users/${meId}`, { token: A, body: { reason: 'files test' } });
  r = await call('DELETE', `/admin/users/${meId}/permanent`, { token: A, body: {} });
  check('permanent delete -> files records and bytes gone', r.status === 200 && (await col('files').countDocuments({ ownerId: meId })) === 0 && myKeys.every((k) => !onDisk(k)), dump(r));
  r = await call('GET', '/health/ready');
  check('readiness reports storage up', r.status === 200 && r.body.data.checks.storage === 'up', dump(r));
  check('no stray temp files', !fs.readdirSync(storageDir, { recursive: true }).some((f) => String(f).endsWith('.tmp')));

  console.log('\n7. Image processing (sharp)');
  const meta = (buf) => sharp(buf).metadata();
  const pre = await meta(GPS_PHOTO);
  check('test photo has EXIF, GPS and orientation 6', !!pre.exif && pre.orientation === 6 && pre.width === 2000, JSON.stringify({ o: pre.orientation, w: pre.width }));
  r = await upload(other, GPS_PHOTO, 'holiday.jpg');
  const photo = r.body.data;
  check('document photo: auto-rotated and shrunk to IMAGE_MAX_DIMENSION (400x800)', r.status === 201 && photo.width === 400 && photo.height === 800 && photo.originalSize === GPS_PHOTO.length && photo.size !== GPS_PHOTO.length, JSON.stringify({ w: photo?.width, h: photo?.height, os: photo?.originalSize, len: GPS_PHOTO.length, size: photo?.size }));
  r = await call('GET', `/files/${photo.id}/content`, { token: other, raw: true });
  const post = await meta(r.bytes);
  check('stored photo has no EXIF / GPS / orientation / XMP / IPTC', !post.exif && !post.orientation && !post.xmp && !post.iptc && post.width === 400 && post.height === 800 && post.format === 'jpeg', JSON.stringify({ exif: !!post.exif, o: post.orientation, w: post.width, h: post.height }));
  check('camera / GPS text gone from the bytes', !r.bytes.toString('latin1').includes('TestCam') && !r.bytes.toString('latin1').includes('secret'));
  check('sha256 / size describe the stored (processed) bytes', photo.sha256 === require('node:crypto').createHash('sha256').update(r.bytes).digest('hex') && photo.size === r.bytes.length);
  r = await avatar('/users/me/avatar', other, GPS_PHOTO, 'face.jpg');
  const av = r.body.data;
  const avBytes = (await call('GET', `/files/public/${av.id}`, { raw: true })).bytes;
  const avMeta = await meta(avBytes);
  check('avatar: square IMAGE_AVATAR_SIZE (128x128), metadata removed', r.status === 201 && av.width === 128 && av.height === 128 && avMeta.width === 128 && avMeta.height === 128 && !avMeta.exif, dump(r));
  r = await upload(other, GIF, 'anim.gif');
  check('GIF document kept as GIF', r.status === 201 && r.body.data.mimeType === 'image/gif' && r.body.data.width === 64, dump(r));
  r = await upload(other, PNG(5000), 'broken.png');
  check('PNG header + garbage -> 422 FILE_UNREADABLE', r.status === 422 && r.body.code === 'FILE_UNREADABLE', dump(r));
  r = await upload(other, BOMB, 'huge.png');
  check('over IMAGE_MAX_INPUT_PIXELS -> 422 "too many pixels" (small file, big image)', r.status === 422 && /too many pixels/.test(r.body.message) && BOMB.length < 50_000, dump(r));
  r = await upload(other, PDF, 'doc.pdf');
  check('PDF stored unchanged', r.status === 201 && r.body.data.sha256 === require('node:crypto').createHash('sha256').update(PDF).digest('hex') && r.body.data.width === null);
  const pdfId = r.body.data.id;

  console.log('\n8. Virus scanning (ClamAV protocol)');
  check('uploads scanned: CLEAN', photo.scanStatus === 'CLEAN' && av.scanStatus === 'CLEAN' && clam.scans >= 4, String(clam.scans));
  await call('DELETE', `/files/${pdfId}`, { token: other });
  const before = await col('files').countDocuments({ ownerId: otherId });
  const infected = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(1000, 0x20), Buffer.from(MARKER), Buffer.alloc(100, 0x20)]);
  r = await upload(other, infected, 'invoice.pdf');
  check('infected file -> 422 FILE_INFECTED, nothing stored', r.status === 422 && r.body.code === 'FILE_INFECTED' && (await col('files').countDocuments({ ownerId: otherId })) === before, dump(r));
  await sleep(200);
  check('infection logged with the signature', logs.join('').includes('Infected upload rejected') && logs.join('').includes('AuthCore.Test.Marker'));
  const bigPdf = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(300 * 1024, 0x41)]);
  r = await upload(other, bigPdf, 'big.pdf');
  check('large file streamed in 64 KB chunks (>= 5 chunks)', r.status === 201 && clam.maxChunks >= 5, String(clam.maxChunks));
  r = await call('GET', '/health/ready');
  check('readiness reports virusScanner up', r.status === 200 && r.body.data.checks.virusScanner === 'up', dump(r));
  clam.mode = 'down';
  r = await avatar('/users/me/avatar', other, REALPNG);
  check('scanner down + fail-closed -> 503 FILE_SCAN_UNAVAILABLE', r.status === 503 && r.body.code === 'FILE_SCAN_UNAVAILABLE', dump(r));
  r = await call('GET', '/health/ready');
  check('readiness 503 while scanner is down', r.status === 503 && JSON.stringify(r.body.errors).includes('virusScanner'), dump(r));
  child.kill();
  await sleep(800);
  child = await start({ VIRUS_SCAN_FAIL_CLOSED: 'false' });
  const other2 = await tok('other');
  r = await avatar('/users/me/avatar', other2, REALPNG);
  check('scanner down + fail-open -> accepted as SCAN_FAILED', r.status === 201 && r.body.data.scanStatus === 'SCAN_FAILED', dump(r));
  clam.mode = 'up';
  child.kill();
  await sleep(800);
  child = await start({ VIRUS_SCAN_ENABLED: 'false' });
  r = await avatar('/users/me/avatar', await tok('other'), REALPNG);
  check('scanning disabled -> NOT_SCANNED; readiness without virusScanner', r.status === 201 && r.body.data.scanStatus === 'NOT_SCANNED' && (await call('GET', '/health/ready')).body.data.checks.virusScanner === undefined, dump(r));
  clamServer.close();

  child.kill();
  await sleep(600);
  await cleanup();
  await mongoose.disconnect();
  fs.rmSync(storageDir, { recursive: true, force: true });
  console.log(`\n${failures === 0 ? 'ALL PASSED' : `${failures} FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
