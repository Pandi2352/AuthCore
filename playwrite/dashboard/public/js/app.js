// Shell: menu, theme, hash routes, live run updates (server-sent events).
import { html, icon, render } from './lib.js';
import { emptyState, hideTip, toast } from './ui.js';

const ROUTES = [
  { id: 'overview', path: '', label: 'Overview', icon: 'grid', load: () => import('./pages/overview.js') },
  { id: 'runs', path: 'runs', label: 'Runs', icon: 'history', load: () => import('./pages/runs.js') },
  { id: 'run', path: 'runs/:id', label: 'Run', icon: 'history', nav: 'runs', hidden: true, load: () => import('./pages/run.js') },
  { id: 'tests', path: 'tests', label: 'Tests', icon: 'flask', load: () => import('./pages/tests.js') },
  { id: 'launch', path: 'launch', label: 'Run tests', icon: 'play', load: () => import('./pages/launch.js') },
  { id: 'environment', path: 'environment', label: 'Setup', icon: 'settings', load: () => import('./pages/environment.js') },
];

// -------------------------------------------------------------- live run state
const listeners = new Set();
export const live = { state: null, log: [] };
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
    toast(data.exitCode === 0 ? 'Test run finished: all passed' : 'Test run finished with failures', data.exitCode === 0 ? 'success' : 'danger');
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
  render(
    pill,
    html`<a href="#/launch" class="live-pill" style="padding:0;background:none"><span class="pulse"></span>Running ${p ? `${p.done}/${p.total}` : '…'}</a>`,
  );
}

// ----------------------------------------------------------------------- theme
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

// ------------------------------------------------------------------------ menu
function drawNav(activeNav) {
  render(
    document.getElementById('nav'),
    ROUTES.filter((r) => !r.hidden).map(
      (r) =>
        html`<a class="nav-link" href="#/${r.path}" ${r.id === activeNav ? html`aria-current="page"` : ''}>${icon(r.icon)}${r.label}</a>`,
    ),
  );
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

// ---------------------------------------------------------------------- router
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

window.addEventListener('hashchange', route);
drawTheme();
connectLive();
route();
