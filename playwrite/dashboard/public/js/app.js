// Shell: menu, theme, hash routes, live updates (server-sent events), run-finished
// notifications and keyboard shortcuts.
import { html, icon, pref, render } from './lib.js';
import { emptyState, hideTip, openDialog, toast } from './ui.js';

const ROUTES = [
  { id: 'overview', path: '', label: 'Overview', icon: 'grid', section: 'Results', key: 'o', load: () => import('./pages/overview.js') },
  { id: 'runs', path: 'runs', label: 'Runs', icon: 'history', section: 'Results', key: 'r', load: () => import('./pages/runs.js') },
  { id: 'run', path: 'runs/:id', label: 'Run', icon: 'history', nav: 'runs', hidden: true, load: () => import('./pages/run.js') },
  { id: 'compare', path: 'compare', label: 'Compare runs', icon: 'compare', section: 'Results', key: 'c', load: () => import('./pages/compare.js') },
  { id: 'tests', path: 'tests', label: 'Tests', icon: 'flask', section: 'Results', key: 't', load: () => import('./pages/tests.js') },
  { id: 'insights', path: 'insights', label: 'Flaky & slow', icon: 'activity', section: 'Results', key: 'i', load: () => import('./pages/insights.js') },
  { id: 'search', path: 'search', label: 'Search', icon: 'search', section: 'Results', key: 'f', load: () => import('./pages/search.js') },
  { id: 'launch', path: 'launch', label: 'Run tests', icon: 'play', section: 'Run', key: 'l', load: () => import('./pages/launch.js') },
  { id: 'schedules', path: 'schedules', label: 'Schedules', icon: 'calendar', section: 'Run', key: 'h', load: () => import('./pages/schedules.js') },
  { id: 'coverage', path: 'coverage', label: 'Coverage', icon: 'target', section: 'Quality', key: 'v', load: () => import('./pages/coverage.js') },
  { id: 'screens', path: 'screens', label: 'Screens', icon: 'image', section: 'Quality', key: 'g', load: () => import('./pages/screens.js') },
  { id: 'quality', path: 'quality', label: 'Accessibility & speed', icon: 'access', section: 'Quality', key: 'a', load: () => import('./pages/quality.js') },
  { id: 'health', path: 'health', label: 'Test health', icon: 'heart', section: 'Quality', key: 'k', load: () => import('./pages/health.js') },
  { id: 'testenv', path: 'testenv', label: 'Test environment', icon: 'server', section: 'Test environment', key: 'e', load: () => import('./pages/testenv.js') },
  { id: 'mail', path: 'mail', label: 'Emails', icon: 'mail', section: 'Test environment', key: 'm', load: () => import('./pages/mail.js') },
  { id: 'environment', path: 'environment', label: 'Setup', icon: 'settings', section: 'Dashboard', key: 's', load: () => import('./pages/environment.js') },
];

// -------------------------------------------------------------- live state
const listeners = new Set();
export const live = { state: null, log: [], env: null, envLog: [] };
export const onLive = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const emit = (type, data) => listeners.forEach((fn) => fn(type, data));

function connectLive() {
  const es = new EventSource('/api/live');
  es.addEventListener('hello', (e) => {
    live.state = JSON.parse(e.data);
    drawLivePill();
    emit('state', live.state);
  });
  es.addEventListener('started', (e) => {
    live.state = JSON.parse(e.data);
    live.log = [];
    drawLivePill();
    emit('started', live.state);
  });
  es.addEventListener('progress', (e) => {
    live.state = JSON.parse(e.data);
    drawLivePill();
    emit('progress', live.state);
  });
  es.addEventListener('log', (e) => {
    const { line } = JSON.parse(e.data);
    live.log.push(line);
    if (live.log.length > 5000) live.log.shift();
    emit('log', line);
  });
  es.addEventListener('finished', (e) => {
    const data = JSON.parse(e.data);
    live.state = data.state;
    drawLivePill();
    emit('finished', data);
    const ok = data.exitCode === 0;
    toast(ok ? 'Test run finished: all passed' : 'Test run finished with failures', ok ? 'success' : 'danger');
    notify(ok ? 'Tests passed' : 'Tests failed', `${data.label || (data.trigger === 'schedule' ? 'Scheduled run' : 'Test run')} ${ok ? 'finished: all passed' : 'finished with failures or was stopped'}.`, data.runId);
  });
  es.addEventListener('env', (e) => {
    live.env = JSON.parse(e.data);
    drawEnvDot();
    emit('env', live.env);
  });
  es.addEventListener('env-line', (e) => {
    const { line } = JSON.parse(e.data);
    live.envLog.push(line);
    if (live.envLog.length > 1000) live.envLog.shift();
    emit('env-line', line);
  });
  es.onerror = () => {
    /* EventSource reconnects by itself */
  };
}

function drawLivePill() {
  const pill = document.getElementById('live-pill');
  const s = live.state;
  if (!s?.running) {
    pill.hidden = true;
    return;
  }
  const p = s.progress;
  pill.hidden = false;
  render(pill, html`<a href="#/launch" class="live-pill" style="padding:0;background:none"><span class="pulse"></span>Running ${p ? `${p.done}/${p.total}` : '…'}</a>`);
}

/** Small state dot next to "Test environment" in the menu. */
function drawEnvDot() {
  const dot = document.querySelector('[data-env-dot]');
  if (!dot) return;
  const phase = live.env?.phase ?? 'unknown';
  dot.className = `env-dot ${phase}`;
  dot.title = { ready: 'Running', starting: 'Starting', failed: 'Failed to start', stopped: 'Stopped' }[phase] ?? '';
}

// ------------------------------------------------------- run notifications
export const notifySupported = () => 'Notification' in window;
export const notifyOn = () => notifySupported() && Notification.permission === 'granted' && pref.get('notify', false);
function notify(title, body, runId) {
  if (!notifyOn()) return;
  try {
    const n = new Notification(title, { body, tag: 'pw-run', icon: document.querySelector('link[rel="icon"]')?.href });
    n.onclick = () => {
      window.focus();
      if (runId) location.hash = `#/runs/${encodeURIComponent(runId)}`;
      n.close();
    };
  } catch {
    /* blocked */
  }
}

// ----------------------------------------------------------------- theme
function drawTheme() {
  const btn = document.getElementById('theme-toggle');
  const dark =
    document.documentElement.dataset.theme === 'dark' ||
    (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
  render(btn, html`${icon(dark ? 'sun' : 'moon')}${dark ? 'Light mode' : 'Dark mode'}`);
  btn.onclick = () => {
    const next = dark ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem('pw-dashboard-theme', next);
    } catch {
      /* private mode */
    }
    drawTheme();
    window.dispatchEvent(new Event('themechange'));
  };
}

// ------------------------------------------------------------------ menu
function drawNav(activeNav) {
  const sections = [];
  for (const r of ROUTES.filter((x) => !x.hidden)) {
    let s = sections.find((x) => x.name === r.section);
    if (!s) sections.push((s = { name: r.section, items: [] }));
    s.items.push(r);
  }
  render(
    document.getElementById('nav'),
    sections.map(
      (s) => html`<div class="nav-section"><span class="nav-heading">${s.name}</span>
        ${s.items.map(
          (r) =>
            html`<a class="nav-link" href="#/${r.path}" ${r.id === activeNav ? html`aria-current="page"` : ''}>${icon(r.icon)}<span class="grow">${r.label}</span>${r.id === 'testenv' ? html`<span data-env-dot class="env-dot"></span>` : ''}</a>`,
        )}</div>`,
    ),
  );
  drawEnvDot();
}

const sidebar = document.getElementById('sidebar');
const scrim = document.getElementById('scrim');
const menuBtn = document.getElementById('menu-btn');
render(menuBtn, icon('menu'));
const setMenu = (open) => {
  sidebar.classList.toggle('open', open);
  scrim.hidden = !open;
  menuBtn.setAttribute('aria-expanded', String(open));
};
menuBtn.addEventListener('click', () => setMenu(!sidebar.classList.contains('open')));
scrim.addEventListener('click', () => setMenu(false));

// ---------------------------------------------------------------- router
function match(hash) {
  const [pathPart, query = ''] = hash.replace(/^#\/?/, '').split('?');
  const segs = pathPart.split('/').filter(Boolean);
  for (const r of ROUTES) {
    const want = r.path.split('/').filter(Boolean);
    if (want.length !== segs.length) continue;
    const params = {};
    if (want.every((w, i) => (w.startsWith(':') ? ((params[w.slice(1)] = decodeURIComponent(segs[i])), true) : w === segs[i]))) {
      return { route: r, params, query: new URLSearchParams(query) };
    }
  }
  return null;
}

let cleanup = null;
let lastPath = null;
const main = document.getElementById('main');

async function route() {
  const hash = location.hash || '#/';
  const pathOnly = hash.split('?')[0];
  const m = match(hash);
  setMenu(false);
  hideTip();
  if (!m) {
    drawNav(null);
    render(main, emptyState({ icon: 'search', title: 'Page not found', action: html`<a class="btn btn-primary" href="#/">Go to overview</a>` }));
    return;
  }
  // Same page, only the query changed (tab, open test): let the page handle it.
  if (pathOnly === lastPath && cleanup?.onQuery) {
    cleanup.onQuery(m.query);
    return;
  }
  lastPath = pathOnly;
  // A link inside a popup can lead to another page: close any popups first.
  document.getElementById('dialogs').replaceChildren();
  document.body.style.overflow = '';
  if (typeof cleanup === 'function') cleanup();
  else cleanup?.dispose?.();
  cleanup = null;
  drawNav(m.route.nav ?? m.route.id);
  document.title = `${m.route.label} · AuthCore Tests`;
  const mod = await m.route.load();
  main.scrollTop = 0;
  window.scrollTo(0, 0);
  cleanup = (await mod.page(main, m.params, m.query)) ?? null;
}

/** Change only the query part of the current route (no page reload, no new history entry). */
export function setQuery(params) {
  const [p] = (location.hash || '#/').split('?');
  const q = new URLSearchParams(params);
  for (const [k, v] of [...q]) if (v === '' || v === 'null' || v === 'undefined') q.delete(k);
  const next = `${p}${q.toString() ? `?${q}` : ''}`;
  history.replaceState(null, '', next);
}

// ------------------------------------------------------- keyboard shortcuts
const typing = (el) => el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
let pendingG = 0;

function showShortcuts() {
  if (document.querySelector('[data-shortcuts]')) return;
  openDialog({
    title: 'Keyboard shortcuts',
    width: 560,
    body: html`<div data-shortcuts class="shortcuts">
      <div><span><kbd>?</kbd></span>This list</div>
      <div><span><kbd>/</kbd></span>Search on this page</div>
      <div><span><kbd>n</kbd></span>Start a new run (Run tests)</div>
      <div><span><kbd>Esc</kbd></span>Close a popup</div>
      <h3>Go to (press <kbd>g</kbd>, then the letter)</h3>
      ${ROUTES.filter((r) => r.key).map((r) => html`<div><span><kbd>g</kbd> <kbd>${r.key}</kbd></span>${r.label}</div>`)}
    </div>`,
  });
}

document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey || typing(e.target)) return;
  if (document.getElementById('dialogs').children.length && e.key !== '?') return;
  if (Date.now() - pendingG < 1200) {
    pendingG = 0;
    const r = ROUTES.find((x) => x.key === e.key.toLowerCase());
    if (r) {
      e.preventDefault();
      location.hash = `#/${r.path}`;
    }
    return;
  }
  if (e.key === 'g') {
    pendingG = Date.now();
    return;
  }
  if (e.key === '?') {
    e.preventDefault();
    showShortcuts();
  } else if (e.key === '/') {
    const field = main.querySelector('input[type="search"], .field input');
    if (field) {
      e.preventDefault();
      field.focus();
      field.select?.();
    }
  } else if (e.key === 'n') {
    location.hash = '#/launch';
  }
});
document.getElementById('shortcuts-btn')?.addEventListener('click', showShortcuts);

window.addEventListener('hashchange', route);
drawTheme();
connectLive();
fetch('/api/testenv/status')
  .then((r) => r.json())
  .then((s) => {
    live.env = s;
    drawEnvDot();
    emit('env', s);
  })
  .catch(() => undefined);
route();
