// Shared helpers: HTML escaping, formatting, icons, API calls.

/** Escape text for HTML. Every value from a report goes through this. */
export const esc = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Tagged template: interpolations are escaped unless wrapped with raw(). */
export const raw = (html) => ({ __raw: String(html) });
export function html(strings, ...values) {
  let out = '';
  strings.forEach((s, i) => {
    out += s;
    if (i < values.length) out += toHtml(values[i]);
  });
  return raw(out);
}
function toHtml(v) {
  if (v === null || v === undefined || v === false) return '';
  if (Array.isArray(v)) return v.map(toHtml).join('');
  if (typeof v === 'object' && '__raw' in v) return v.__raw;
  return esc(v);
}
export const render = (el, content) => {
  el.innerHTML = toHtml(content);
};

// ------------------------------------------------------------------------- format
const nf = new Intl.NumberFormat();
export const num = (n) => (n === null || n === undefined ? '—' : nf.format(n));
export const pct = (n) => (n === null || n === undefined ? '—' : `${Math.round(n * 10) / 10}%`);

export function dur(ms) {
  if (ms === null || ms === undefined) return '—';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const s = ms / 1000;
  if (s < 60) return `${s < 10 ? s.toFixed(1) : Math.round(s)} s`;
  const m = Math.floor(s / 60);
  const rest = Math.round(s % 60);
  if (m < 60) return `${m}m ${rest}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

const dtf = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const tf = new Intl.DateTimeFormat(undefined, { timeStyle: 'medium' });
export const when = (iso) => (iso ? dtf.format(new Date(iso)) : '—');
export const clock = (iso) => (iso ? tf.format(new Date(iso)) : '—');
export function ago(iso) {
  if (!iso) return '—';
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? '' : 's'} ago`;
}
export function bytes(n) {
  if (!n) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / 1024 ** i).toFixed(i ? 1 : 0)} ${u[i]}`;
}
export const plural = (n, word, many = `${word}s`) => `${num(n)} ${n === 1 ? word : many}`;

// ------------------------------------------------------------------------ status
/** One meaning per state; colors only ever paired with the label and icon. */
export const STATE = {
  passed: { label: 'Passed', tone: 'success', icon: 'check', bar: 'passed' },
  failed: { label: 'Failed', tone: 'danger', icon: 'x', bar: 'failed' },
  timedOut: { label: 'Timed out', tone: 'danger', icon: 'clock', bar: 'failed' },
  interrupted: { label: 'Interrupted', tone: 'neutral', icon: 'stop', bar: 'skipped' },
  flaky: { label: 'Flaky', tone: 'warning', icon: 'alert', bar: 'flaky' },
  skipped: { label: 'Skipped', tone: 'neutral', icon: 'skip', bar: 'skipped' },
};
export const RUN_STATE = {
  passed: { label: 'Passed', tone: 'success', icon: 'check' },
  failed: { label: 'Failed', tone: 'danger', icon: 'x' },
  timedout: { label: 'Timed out', tone: 'danger', icon: 'clock' },
  interrupted: { label: 'Interrupted', tone: 'neutral', icon: 'stop' },
  running: { label: 'Running', tone: 'info', icon: 'play' },
};
/** Counts folded into the four chart groups. */
export const groups = (c) => ({
  passed: c.passed ?? 0,
  flaky: c.flaky ?? 0,
  failed: (c.failed ?? 0) + (c.timedOut ?? 0),
  skipped: (c.skipped ?? 0) + (c.interrupted ?? 0),
});

// ------------------------------------------------------------------------- icons
const P = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>',
  play: '<polygon points="6 3 20 12 6 21 6 3"/>',
  flask: '<path d="M9 3h6"/><path d="M10 3v6L4.5 19a1.5 1.5 0 0 0 1.3 2h12.4a1.5 1.5 0 0 0 1.3-2L14 9V3"/><path d="M7 15h10"/>',
  settings: '<path d="M4 21v-7"/><path d="M4 10V3"/><path d="M12 21v-9"/><path d="M12 8V3"/><path d="M20 21v-5"/><path d="M20 12V3"/><path d="M2 14h4"/><path d="M10 8h4"/><path d="M18 16h4"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  checkCircle: '<circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  xCircle: '<circle cx="12" cy="12" r="9"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>',
  alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  skip: '<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  stop: '<rect x="5" y="5" width="14" height="14" rx="2"/>',
  refresh: '<path d="M21 12a9 9 0 0 1-15.5 6.3L3 16"/><path d="M3 21v-5h5"/><path d="M3 12a9 9 0 0 1 15.5-6.3L21 8"/><path d="M21 3v5h-5"/>',
  trash: '<path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>',
  download: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  file: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.5-3.5L8 21"/>',
  video: '<rect x="2" y="6" width="14" height="12" rx="2"/><path d="m16 10 6-3v10l-6-3"/>',
  zip: '<path d="M4 7V5a2 2 0 0 1 2-2h8l6 6v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2"/><path d="M10 3v2M10 8v2M10 13v2"/><rect x="2" y="15" width="6" height="5" rx="1"/>',
  terminal: '<path d="m4 17 6-5-6-5"/><path d="M12 19h8"/>',
  branch: '<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="7" r="2"/><path d="M6 7v10"/><path d="M18 9a6 6 0 0 1-6 6H6"/>',
  chevronRight: '<path d="m9 6 6 6-6 6"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  chevronLeft: '<path d="m15 6-6 6 6 6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  external: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2"/><path d="M9 2h6"/>',
  layers: '<path d="m12 2 9 5-9 5-9-5z"/><path d="m3 12 9 5 9-5"/><path d="m3 17 9 5 9-5"/>',
  monitor: '<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
  phone: '<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  bug: '<rect x="8" y="6" width="8" height="14" rx="4"/><path d="M12 20v-9M3 13h5M16 13h5M4 7l4 2M20 7l-4 2M4 19l4-2M20 19l-4-2M9 6a3 3 0 0 1 6 0"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  tag: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  gauge: '<path d="M12 14 16 10"/><path d="M3.3 19a10 10 0 1 1 17.4 0"/>',
  cpu: '<rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>',
  repeat: '<path d="m17 2 4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="m7 22-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>',
  hash: '<path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18"/>',
  network: '<rect x="9" y="2" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="16" y="16" width="6" height="6" rx="1"/><path d="M5 16v-3h14v3M12 8v5"/>',
  message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  sparkles: '<path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
  code: '<path d="m16 18 6-6-6-6"/><path d="m8 6-6 6 6 6"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>',
  shield: '<path d="M12 3 4 6v6c0 5 3.4 8.3 8 9 4.6-.7 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
  access: '<circle cx="12" cy="4.5" r="1.8"/><path d="M5 8.5c2.3.7 4.6 1 7 1s4.7-.3 7-1"/><path d="M12 9.5v4.5l-3 7M12 14l3 7"/>',
  compare: '<rect x="3" y="4" width="7" height="16" rx="1"/><rect x="14" y="4" width="7" height="16" rx="1"/><path d="M10 12h4"/>',
  server: '<rect x="3" y="4" width="18" height="7" rx="1.5"/><rect x="3" y="13" width="18" height="7" rx="1.5"/><path d="M7 7.5h.01M7 16.5h.01"/>',
  eraser: '<path d="m7 21-4-4 10-10 8 8-6 6z"/><path d="M7 21h14M9 11l6 6"/>',
  keyboard: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
  bellOff: '<path d="M8.7 3A6 6 0 0 1 18 8c0 3.3.8 5.5 1.6 7M17 17H3s3-2 3-9c0-.6.1-1.1.2-1.6"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/><path d="m2 2 20 20"/>',
  note: '<path d="M15 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9z"/><path d="M15 3v6h6"/><path d="M7 13h10M7 17h6"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  bookmark: '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
  power: '<path d="M12 2v10"/><path d="M18.4 6.6a9 9 0 1 1-12.8 0"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21.2l8.8-8.8a5.5 5.5 0 0 0 0-7.8z"/>',
  pause: '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  printer: '<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
};
export const icon = (name, extra = '') =>
  raw(`<svg class="i ${extra}" viewBox="0 0 24 24" aria-hidden="true">${P[name] ?? P.file}</svg>`);

// --------------------------------------------------------------------------- api
async function request(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: { 'x-dashboard': '1', ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data;
}
export const api = {
  runs: () => request('GET', '/api/runs'),
  run: (id) => request('GET', `/api/runs/${encodeURIComponent(id)}`),
  deleteRun: (id) => request('DELETE', `/api/runs/${encodeURIComponent(id)}`),
  clearRuns: () => request('DELETE', '/api/runs'),
  history: () => request('GET', '/api/history'),
  catalog: (refresh) => request('GET', `/api/catalog${refresh ? '?refresh=1' : ''}`),
  environment: () => request('GET', '/api/environment'),
  liveState: () => request('GET', '/api/live/state'),
  start: (options) => request('POST', '/api/run', options),
  stop: () => request('POST', '/api/stop'),
  groups: (id) => request('GET', `/api/runs/${encodeURIComponent(id)}/groups`),
  envStatus: () => request('GET', '/api/testenv/status'),
  envStart: (options) => request('POST', '/api/testenv/start', options),
  envStop: () => request('POST', '/api/testenv/stop'),
  envLogs: (offset) => request('GET', `/api/testenv/logs${offset === undefined ? '' : `?offset=${offset}`}`),
  envLogWindow: (from, to) => request('GET', `/api/testenv/logs?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
  leftovers: () => request('GET', '/api/testenv/leftovers'),
  cleanup: (kinds) => request('POST', '/api/testenv/cleanup', { kinds }),
  mail: () => request('GET', '/api/mail'),
  mailOne: (file) => request('GET', `/api/mail/${encodeURIComponent(file)}`),
  clearMail: () => request('DELETE', '/api/mail'),
  coverage: (run) => request('GET', `/api/coverage${run ? `?run=${encodeURIComponent(run)}` : ''}`),
  quality: () => request('GET', '/api/quality'),
  health: () => request('GET', '/api/health'),
  search: (q, state) => request('GET', `/api/search?q=${encodeURIComponent(q)}&state=${encodeURIComponent(state ?? 'all')}`),
  visual: (run) => request('GET', `/api/visual${run ? `?run=${encodeURIComponent(run)}` : ''}`),
  approve: (runId, keys) => request('POST', '/api/visual/approve', { runId, keys }),
  removeBaseline: (key) => request('POST', '/api/visual/remove', { key }),
  notes: () => request('GET', '/api/notes'),
  saveNote: (key, note, muted) => request('PUT', '/api/notes', { key, note, muted }),
  presets: () => request('GET', '/api/presets'),
  savePreset: (name, options) => request('POST', '/api/presets', { name, options }),
  deletePreset: (id) => request('DELETE', `/api/presets/${encodeURIComponent(id)}`),
  schedules: () => request('GET', '/api/schedules'),
  saveSchedule: (s) => request('POST', '/api/schedules', s),
  deleteSchedule: (id) => request('DELETE', `/api/schedules/${encodeURIComponent(id)}`),
  settings: () => request('GET', '/api/settings'),
  saveSettings: (s) => request('PUT', '/api/settings', s),
  openTrace: (id, file) => request('POST', `/api/runs/${encodeURIComponent(id)}/trace/${encodeURIComponent(file)}`),
  fileUrl: (id, file) => `/api/runs/${encodeURIComponent(id)}/files/${encodeURIComponent(file)}`,
  text: async (url) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Could not load (${res.status})`);
    return res.text();
  },
};

/** Small in-memory cache for run files (they never change once written). */
const runCache = new Map();
export async function getRun(id) {
  if (!runCache.has(id)) runCache.set(id, api.run(id).catch((e) => (runCache.delete(id), Promise.reject(e))));
  return runCache.get(id);
}
export const forgetRun = (id) => (id ? runCache.delete(id) : runCache.clear());

export const testKey = (t) => `${t.project}|${t.file}|${t.fullTitle}`;

export function download(filename, text, type = 'text/plain') {
  const blob = new Blob([text], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export const csvCell = (v) => {
  const s = String(v ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Notes and mutes per test key, fetched once per page view. */
let notesMemo = null;
export const getNotes = (fresh = false) => {
  if (fresh || !notesMemo) notesMemo = api.notes().catch(() => ({}));
  return notesMemo;
};

/** Same grouping as the server: ids, numbers and generated names don't split a group. */
export function errorSignature(message) {
  const first = String(message ?? '')
    .split('\n')
    .map((l) => l.trim())
    .find(Boolean);
  if (!first) return '';
  return first
    .replace(/\b[0-9a-f]{24}\b/gi, '<id>')
    .replace(/\b[0-9a-f]{8}-[0-9a-f-]{27}\b/gi, '<id>')
    .replace(/PW[- ][\w-]+/g, 'PW-…')
    .replace(/\d+(\.\d+)?/g, 'N')
    .replace(/\s+/g, ' ')
    .slice(0, 240);
}

export const regexEscape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Per-viewer conveniences (like the theme). Pages work without them. */
export const pref = {
  get: (k, fallback = null) => {
    try {
      const v = localStorage.getItem(`pw-dashboard-${k}`);
      return v === null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  },
  set: (k, v) => {
    try {
      localStorage.setItem(`pw-dashboard-${k}`, JSON.stringify(v));
    } catch {
      /* private mode */
    }
  },
};

/** Options of a run that re-runs exactly these tests (by file and line). */
export const exactTests = (tests) => ({
  projects: [...new Set(tests.map((t) => t.project))],
  tests: tests.map((t) => ({ file: t.file, line: t.line })),
});

export function debounce(fn, ms = 200) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}
