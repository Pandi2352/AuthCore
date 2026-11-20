// Hand-built components (same look as AuthCore): stat card, section card, badges, status
// bar, dropdown, table, popup, confirm, toast, tooltip, tabs.
import { esc, groups, html, icon, num, raw, render, RUN_STATE, STATE } from './lib.js';

let uid = 0;
const nextId = (p) => `${p}-${++uid}`;

// ------------------------------------------------------------------- patterns
const PATTERNS = {
  rings: (id) =>
    `<svg class="pattern" aria-hidden="true" viewBox="0 0 200 100" preserveAspectRatio="xMaxYMid slice"><g fill="none" stroke="currentColor" stroke-width="2">${[20, 38, 56, 74, 92]
      .map((r) => `<circle cx="190" cy="10" r="${r}"/>`)
      .join('')}</g></svg>`,
  waves: () =>
    `<svg class="pattern" aria-hidden="true" viewBox="0 0 200 100" preserveAspectRatio="none"><g fill="none" stroke="currentColor" stroke-width="3"><path d="M0 70 Q25 50 50 70 T100 70 T150 70 T200 70"/><path d="M0 88 Q25 68 50 88 T100 88 T150 88 T200 88"/></g></svg>`,
  dots: (id) =>
    `<svg class="pattern" aria-hidden="true"><defs><pattern id="${id}" width="14" height="14" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="2" fill="currentColor"/></pattern></defs><rect width="100%" height="100%" fill="url(#${id})"/></svg>`,
  grid: (id) =>
    `<svg class="pattern" aria-hidden="true"><defs><pattern id="${id}" width="18" height="18" patternUnits="userSpaceOnUse"><path d="M18 0H0V18" fill="none" stroke="currentColor" stroke-width="1"/></pattern></defs><rect width="100%" height="100%" fill="url(#${id})"/></svg>`,
  stripes: (id) =>
    `<svg class="pattern" aria-hidden="true"><defs><pattern id="${id}" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="12" fill="currentColor"/></pattern></defs><rect width="100%" height="100%" fill="url(#${id})"/></svg>`,
  bars: () =>
    `<svg class="pattern" aria-hidden="true" viewBox="0 0 200 100" preserveAspectRatio="xMaxYMax slice"><g fill="currentColor">${[30, 55, 40, 70, 50, 85, 65]
      .map((h, i) => `<rect x="${100 + i * 14}" y="${100 - h}" width="9" height="${h}" rx="2"/>`)
      .join('')}</g></svg>`,
  sparkles: () =>
    `<svg class="pattern" aria-hidden="true" viewBox="0 0 200 100" preserveAspectRatio="xMaxYMid slice"><g fill="currentColor">${[
      [170, 25, 10],
      [130, 70, 7],
      [185, 75, 5],
      [110, 30, 4],
    ]
      .map(([x, y, s]) => `<path d="M${x} ${y - s * 2}L${x + s * 0.5} ${y - s * 0.5}L${x + s * 2} ${y}L${x + s * 0.5} ${y + s * 0.5}L${x} ${y + s * 2}L${x - s * 0.5} ${y + s * 0.5}L${x - s * 2} ${y}L${x - s * 0.5} ${y - s * 0.5}Z"/>`)
      .join('')}</g></svg>`,
  bubbles: () =>
    `<svg class="pattern" aria-hidden="true" viewBox="0 0 200 100" preserveAspectRatio="xMaxYMid slice"><g fill="currentColor">${[
      [175, 20, 16],
      [140, 70, 11],
      [190, 80, 8],
      [118, 30, 6],
    ]
      .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`)
      .join('')}</g></svg>`,
};

/** Light colorful count card. `action` makes it a button (data-action). */
export function statCard({ tone = 'primary', pattern = 'rings', icon: ic = 'grid', label, value, hint, action, tip }) {
  const inner = html`<span>${raw(PATTERNS[pattern]?.(nextId('pat')) ?? '')}</span>
    <span class="tile">${icon(ic)}</span>
    <span class="body">
      <span class="label">${label}</span>
      <span class="value" style="display:block">${value}</span>
      ${hint !== undefined ? html`<span class="hint" style="display:block">${hint}</span>` : ''}
    </span>`;
  return action
    ? html`<button type="button" class="stat t-${tone}" data-action="${action}" ${tip ? raw(`data-tip="${esc(tip)}"`) : ''}>${inner}</button>`
    : html`<div class="stat t-${tone}" ${tip ? raw(`data-tip="${esc(tip)}"`) : ''}>${inner}</div>`;
}

export function sectionCard({ tone = 'primary', icon: ic = 'grid', title, description, aside, body, flush = false, id }) {
  return html`<section class="section t-${tone}" ${id ? raw(`id="${esc(id)}"`) : ''}>
    <header>
      <span class="tile">${icon(ic)}</span>
      <div style="min-width:0">
        <h2>${title}</h2>
        ${description ? html`<p>${description}</p>` : ''}
      </div>
      ${aside ? html`<div class="aside">${aside}</div>` : ''}
    </header>
    <div class="body ${flush ? 'flush' : ''}">${body}</div>
  </section>`;
}

// ---------------------------------------------------------------------- badges
export const badge = (text, tone = 'neutral', ic, small = false) =>
  html`<span class="badge tone-${tone} ${small ? 'badge-sm' : ''}">${ic ? icon(ic) : ''}${text}</span>`;

export function stateBadge(state, attempts = 1, small = false) {
  const s = STATE[state] ?? STATE.skipped;
  const extra = attempts > 1 ? ` · ${attempts} tries` : '';
  return badge(`${s.label}${extra}`, s.tone, s.icon, small);
}
export function runBadge(status, small = false) {
  const s = RUN_STATE[status] ?? RUN_STATE.interrupted;
  return badge(s.label, s.tone, s.icon, small);
}
export const tagBadge = (tag) => html`<span class="badge badge-sm tone-violet tag">${tag}</span>`;

/** Stacked status bar with a 2px gap between parts; hover names each part. */
export function statusBar(counts, size = '') {
  const g = groups(counts);
  const total = g.passed + g.flaky + g.failed + g.skipped;
  if (!total) return html`<div class="statusbar ${size}" aria-label="No tests"></div>`;
  const label = `${num(g.passed)} passed, ${num(g.flaky)} flaky, ${num(g.failed)} failed, ${num(g.skipped)} skipped`;
  return html`<div class="statusbar ${size}" role="img" aria-label="${label}">
    ${['passed', 'flaky', 'failed', 'skipped']
      .filter((k) => g[k] > 0)
      .map(
        (k) =>
          html`<span class="c-${k}" style="flex:${g[k]}" data-tip="${`${STATE[k].label}: ${num(g[k])} of ${num(total)} (${Math.round((g[k] / total) * 100)}%)`}"></span>`,
      )}
  </div>`;
}

export function statusLegend(counts) {
  const g = groups(counts);
  return html`<div class="legend">
    ${['passed', 'flaky', 'failed', 'skipped'].map(
      (k) => html`<span><i class="c-${k}"></i>${STATE[k].label} <b>${num(g[k])}</b></span>`,
    )}
  </div>`;
}

export const emptyState = ({ icon: ic = 'flask', title, text, action }) =>
  html`<div class="empty"><span class="tile">${icon(ic)}</span><strong>${title}</strong>${text ? html`<p>${text}</p>` : ''}${action ?? ''}</div>`;

export const loading = (text = 'Loading…') => html`<div class="loading"><span class="spinner"></span>${text}</div>`;

export const refreshButton = (action = 'refresh') =>
  html`<button type="button" class="icon-btn refresh-btn" data-action="${action}" data-tip="Refresh" aria-label="Refresh">${icon('refresh')}</button>`;

export const iconAction = (action, ic, tip, tone = 'primary', attrs = '') =>
  html`<button type="button" class="icon-btn tone-${tone}" data-action="${action}" data-tip="${tip}" aria-label="${tip}" ${raw(attrs)}>${icon(ic)}</button>`;

/** Spin a refresh button while `work` runs. */
export async function spinWhile(button, work) {
  button?.classList.add('spin');
  try {
    return await work();
  } finally {
    button?.classList.remove('spin');
  }
}

// --------------------------------------------------------------------- tooltip
const tip = document.getElementById('tip');
export function showTip(content, x, y) {
  render(tip, content);
  tip.hidden = false;
  const r = tip.getBoundingClientRect();
  const left = Math.min(window.innerWidth - r.width - 8, Math.max(8, x - r.width / 2));
  const top = y - r.height - 12 < 8 ? y + 18 : y - r.height - 12;
  tip.style.left = `${left}px`;
  tip.style.top = `${top}px`;
}
export const hideTip = () => {
  tip.hidden = true;
};
document.addEventListener('mouseover', (e) => {
  const el = e.target.closest?.('[data-tip]');
  if (!el) return;
  const r = el.getBoundingClientRect();
  showTip(el.dataset.tip, r.left + r.width / 2, r.top);
  el.addEventListener('mouseleave', hideTip, { once: true });
});
document.addEventListener('focusin', (e) => {
  const el = e.target.closest?.('[data-tip]');
  if (!el || !el.matches(':focus-visible')) return;
  const r = el.getBoundingClientRect();
  showTip(el.dataset.tip, r.left + r.width / 2, r.top);
  el.addEventListener('blur', hideTip, { once: true });
});
document.addEventListener('click', hideTip, true);
document.addEventListener('scroll', hideTip, true);

// ----------------------------------------------------------------------- toast
export function toast(message, tone = 'success') {
  const box = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = `toast t-${tone}`;
  render(el, html`${icon(tone === 'success' ? 'checkCircle' : tone === 'danger' ? 'xCircle' : 'alert')}<span>${message}</span>`);
  box.append(el);
  setTimeout(() => el.remove(), 4000);
}

export async function copyText(text, what = 'Copied') {
  try {
    await navigator.clipboard.writeText(text);
    toast(what);
  } catch {
    toast('Could not copy', 'danger');
  }
}

// ---------------------------------------------------------------------- dialog
/**
 * Centered popup. Returns { el, close }. Esc / backdrop / close button close it; focus is
 * kept inside and returned to the opener.
 */
export function openDialog({ title, description, width = 560, body, footer, onClose }) {
  const host = document.getElementById('dialogs');
  const opener = document.activeElement;
  const titleId = nextId('dlg');
  const backdrop = document.createElement('div');
  backdrop.className = 'dialog-backdrop';
  render(
    backdrop,
    html`<div class="dialog" role="dialog" aria-modal="true" aria-labelledby="${titleId}" style="--w:${width}px;${width >= 900 ? 'height:min(92vh, 860px)' : ''}">
      <header>
        <div class="titles"><h2 id="${titleId}">${title}</h2>${description ? html`<p>${description}</p>` : ''}</div>
        <button type="button" class="icon-btn" data-close aria-label="Close" data-tip="Close">${icon('x')}</button>
      </header>
      <div class="dbody">${body ?? ''}</div>
      ${footer ? html`<footer>${footer}</footer>` : ''}
    </div>`,
  );
  host.append(backdrop);
  document.body.style.overflow = 'hidden';
  const dialog = backdrop.firstElementChild;
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    hideTip();
    backdrop.remove();
    document.removeEventListener('keydown', onKey, true);
    if (!host.children.length) document.body.style.overflow = '';
    onClose?.();
    // Don't re-show the opener's tooltip when focus returns.
    if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
    hideTip();
  };
  const focusables = () =>
    [...dialog.querySelectorAll('button, [href], input, textarea, [tabindex]:not([tabindex="-1"]), video')].filter(
      (el) => !el.disabled && el.offsetParent !== null,
    );
  const onKey = (e) => {
    if (host.lastElementChild !== backdrop) return;
    if (e.key === 'Escape') {
      if (dialog.querySelector('.dd-list')) return;
      e.preventDefault();
      close();
    }
    if (e.key === 'Tab') {
      const f = focusables();
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) {
        e.preventDefault();
        f.at(-1).focus();
      } else if (!e.shiftKey && document.activeElement === f.at(-1)) {
        e.preventDefault();
        f[0].focus();
      }
    }
  };
  document.addEventListener('keydown', onKey, true);
  backdrop.addEventListener('mousedown', (e) => {
    if (e.target === backdrop) close();
  });
  dialog.querySelector('[data-close]').addEventListener('click', close);
  requestAnimationFrame(() => (dialog.querySelector('[data-autofocus]') ?? dialog.querySelector('.dbody'))?.focus?.());
  dialog.querySelector('.dbody').tabIndex = -1;
  return { el: dialog, close };
}

export function confirmDialog({ title, text, confirmLabel = 'Confirm', tone = 'danger' }) {
  return new Promise((resolve) => {
    let answer = false;
    const { el, close } = openDialog({
      title,
      width: 440,
      body: html`<p>${text}</p>`,
      footer: html`<button type="button" class="btn btn-outline" data-cancel>Cancel</button>
        <button type="button" class="btn btn-${tone === 'danger' ? 'danger' : 'primary'}" data-ok data-autofocus>${confirmLabel}</button>`,
      onClose: () => resolve(answer),
    });
    el.querySelector('[data-cancel]').addEventListener('click', close);
    el.querySelector('[data-ok]').addEventListener('click', () => {
      answer = true;
      close();
    });
  });
}

// -------------------------------------------------------------------- dropdown
/**
 * Custom dropdown (no <select>). options: [{ value, label, hint? }].
 * multiple: value is an array. Keyboard: arrows, Enter/Space, Esc, Home/End, type-ahead.
 */
export function dropdown(mount, { options, value, placeholder = 'Choose', multiple = false, label, onChange, width }) {
  let current = multiple ? [...(value ?? [])] : value;
  let open = false;
  let active = 0;
  const listId = nextId('dd');
  mount.classList.add('dd');
  if (width) mount.style.minWidth = width;

  const shown = () => {
    if (multiple) {
      if (!current.length) return html`<span class="ph">${placeholder}</span>`;
      const names = options.filter((o) => current.includes(o.value)).map((o) => o.label);
      return names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2}` : names.join(', ');
    }
    const o = options.find((x) => x.value === current);
    return o ? o.label : html`<span class="ph">${placeholder}</span>`;
  };
  const selected = (v) => (multiple ? current.includes(v) : v === current);

  const draw = () => {
    render(
      mount,
      html`<button type="button" class="dd-btn" aria-haspopup="listbox" aria-expanded="${open}" aria-controls="${listId}" ${label ? raw(`aria-label="${esc(label)}"`) : ''}>
        <span class="val">${shown()}</span>${icon('chevronDown')}
      </button>
      ${open
        ? html`<div class="dd-list" id="${listId}" role="listbox" ${multiple ? raw('aria-multiselectable="true"') : ''} tabindex="-1">
            ${options.map(
              (o, i) => html`<div class="dd-opt ${i === active ? 'active' : ''}" role="option" id="${listId}-${i}" data-i="${i}" aria-selected="${selected(o.value)}">
                <span class="check">${selected(o.value) ? icon('check') : ''}</span><span>${o.label}</span>${o.hint ? html`<span class="muted small" style="margin-left:auto">${o.hint}</span>` : ''}
              </div>`,
            )}
          </div>`
        : ''}`,
    );
    const btn = mount.querySelector('.dd-btn');
    btn.addEventListener('click', () => toggle(!open));
    btn.addEventListener('keydown', onKey);
    if (open) {
      btn.setAttribute('aria-activedescendant', `${listId}-${active}`);
      mount.querySelector('.dd-list').addEventListener('mousedown', (e) => e.preventDefault());
      mount.querySelectorAll('.dd-opt').forEach((el) =>
        el.addEventListener('click', () => choose(Number(el.dataset.i))),
      );
      mount.querySelector('.dd-opt.active')?.scrollIntoView({ block: 'nearest' });
    }
  };
  const toggle = (next) => {
    open = next;
    if (open) {
      const i = options.findIndex((o) => selected(o.value));
      active = Math.max(0, i);
    }
    draw();
    mount.querySelector('.dd-btn').focus();
  };
  const choose = (i) => {
    const v = options[i].value;
    if (multiple) {
      current = current.includes(v) ? current.filter((x) => x !== v) : [...current, v];
      active = i;
      draw();
      mount.querySelector('.dd-btn').focus();
    } else {
      current = v;
      open = false;
      draw();
      mount.querySelector('.dd-btn').focus();
    }
    onChange?.(multiple ? [...current] : current);
  };
  let typed = '';
  let typedAt = 0;
  const onKey = (e) => {
    if (!open && ['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
      e.preventDefault();
      return toggle(true);
    }
    if (!open) return;
    if (e.key === 'Escape' || e.key === 'Tab') {
      if (e.key === 'Escape') e.preventDefault();
      open = false;
      return draw();
    }
    if (e.key === 'ArrowDown') active = Math.min(options.length - 1, active + 1);
    else if (e.key === 'ArrowUp') active = Math.max(0, active - 1);
    else if (e.key === 'Home') active = 0;
    else if (e.key === 'End') active = options.length - 1;
    else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      return choose(active);
    } else if (e.key.length === 1) {
      typed = Date.now() - typedAt > 700 ? e.key : typed + e.key;
      typedAt = Date.now();
      const i = options.findIndex((o) => String(o.label).toLowerCase().startsWith(typed.toLowerCase()));
      if (i >= 0) active = i;
    } else return;
    e.preventDefault();
    draw();
    mount.querySelector('.dd-btn').focus();
  };
  const outside = (e) => {
    if (open && !mount.contains(e.target)) {
      open = false;
      draw();
    }
  };
  document.addEventListener('mousedown', outside);
  draw();
  return {
    get value() {
      return multiple ? [...current] : current;
    },
    set(v) {
      current = multiple ? [...(v ?? [])] : v;
      draw();
    },
    setOptions(next) {
      options = next;
      draw();
    },
  };
}

// ----------------------------------------------------------------------- table
/**
 * Client-side table: S.No, sortable columns, grey stripes, paging (no URL change).
 * columns: [{ key, label, className, render(row, index) → html, sort?(row) → value }]
 */
export function dataTable(mount, { columns, rows = [], pageSize = 20, onRow, empty, sort, rowTitle }) {
  let data = rows;
  let page = 1;
  let sortKey = sort?.key ?? null;
  let sortDir = sort?.dir ?? 'asc';

  const sorted = () => {
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sort) return data;
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...data].sort((a, b) => {
      const x = col.sort(a);
      const y = col.sort(b);
      if (x === y) return 0;
      if (x === null || x === undefined) return 1;
      if (y === null || y === undefined) return -1;
      return (x > y ? 1 : -1) * dir;
    });
  };

  const draw = () => {
    const all = sorted();
    const pages = Math.max(1, Math.ceil(all.length / pageSize));
    page = Math.min(page, pages);
    const start = (page - 1) * pageSize;
    const slice = all.slice(start, start + pageSize);
    const pageButtons = [];
    for (let p = 1; p <= pages; p++) {
      if (p === 1 || p === pages || Math.abs(p - page) <= 1) pageButtons.push(p);
      else if (pageButtons.at(-1) !== '…') pageButtons.push('…');
    }
    render(
      mount,
      html`<div class="table-wrap"><table class="data">
        <thead><tr>
          <th class="sno">S.No</th>
          ${columns.map(
            (c) => html`<th class="${c.className ?? ''} ${c.sort ? 'sortable' : ''}" ${c.sort ? raw(`data-sort="${esc(c.key)}" tabindex="0" aria-sort="${sortKey === c.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}"`) : ''}>
              ${c.label}${sortKey === c.key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
            </th>`,
          )}
        </tr></thead>
        <tbody>
          ${slice.length
            ? slice.map(
                (row, i) => html`<tr class="${onRow ? 'clickable' : ''}" data-row="${start + i}" ${rowTitle ? raw(`title="${esc(rowTitle(row))}"`) : ''}>
                  <td class="sno">${start + i + 1}</td>
                  ${columns.map((c) => html`<td class="${c.className ?? ''}">${c.render(row, start + i)}</td>`)}
                </tr>`,
              )
            : html`<tr><td colspan="${columns.length + 1}">${empty ?? emptyState({ icon: 'search', title: 'Nothing to show', text: 'Try other filters.' })}</td></tr>`}
        </tbody>
      </table></div>
      ${all.length > pageSize || all.length > 10
        ? html`<div class="pager">
            <span>${all.length ? `${num(start + 1)}–${num(start + slice.length)} of ${num(all.length)}` : '0 results'}</span>
            <div class="pages">
              <button type="button" data-page="${page - 1}" ${page === 1 ? raw('disabled') : ''} aria-label="Previous page">${icon('chevronLeft')}</button>
              ${pageButtons.map((p) =>
                p === '…'
                  ? html`<span>…</span>`
                  : html`<button type="button" data-page="${p}" aria-current="${p === page}" aria-label="Page ${p}">${p}</button>`,
              )}
              <button type="button" data-page="${page + 1}" ${page === pages ? raw('disabled') : ''} aria-label="Next page">${icon('chevronRight')}</button>
            </div>
          </div>`
        : ''}`,
    );
    mount.querySelectorAll('[data-page]').forEach((b) =>
      b.addEventListener('click', () => {
        page = Number(b.dataset.page);
        draw();
        mount.scrollIntoView({ block: 'nearest' });
      }),
    );
    mount.querySelectorAll('th[data-sort]').forEach((th) => {
      const go = () => {
        if (sortKey === th.dataset.sort) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
        else {
          sortKey = th.dataset.sort;
          sortDir = 'desc';
        }
        draw();
      };
      th.addEventListener('click', go);
      th.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), go()));
    });
    if (onRow) {
      mount.querySelectorAll('tr[data-row]').forEach((tr) =>
        tr.addEventListener('click', (e) => {
          if (e.target.closest('button, a, input')) return;
          onRow(all[Number(tr.dataset.row)], e);
        }),
      );
    }
  };
  draw();
  return {
    setRows(next, resetPage = true) {
      data = next;
      if (resetPage) page = 1;
      draw();
    },
    rowAt: (i) => sorted()[i],
    redraw: draw,
  };
}

// ------------------------------------------------------------------------ tabs
export function tabs(mount, items, active, onChange) {
  const draw = () => {
    render(
      mount,
      html`<div class="tabs" role="tablist">
        ${items.map(
          (t) => html`<button type="button" class="tab" role="tab" data-tab="${t.id}" aria-selected="${t.id === active}" tabindex="${t.id === active ? 0 : -1}">
            ${t.icon ? icon(t.icon) : ''}${t.label}${t.count !== undefined ? html`<span class="badge badge-sm ${t.countTone ? `tone-${t.countTone}` : ''}">${num(t.count)}</span>` : ''}
          </button>`,
        )}
      </div>`,
    );
    const buttons = [...mount.querySelectorAll('[data-tab]')];
    buttons.forEach((b, i) => {
      b.addEventListener('click', () => select(b.dataset.tab));
      b.addEventListener('keydown', (e) => {
        const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!d) return;
        const next = buttons[(i + d + buttons.length) % buttons.length];
        select(next.dataset.tab);
        mount.querySelector(`[data-tab="${next.dataset.tab}"]`).focus();
      });
    });
  };
  const select = (id) => {
    active = id;
    draw();
    onChange(id);
  };
  draw();
  return { select };
}
