// Hand-drawn SVG charts: thin marks, recessive grid, hover details, redraw on resize.
import { esc, html, num, render } from './lib.js';
import { hideTip, showTip } from './ui.js';

const PAD = { top: 12, right: 12, bottom: 26, left: 40 };

/** Draws with the mount's current width and again whenever it changes size. */
function responsive(mount, draw) {
  let last = 0;
  const go = () => {
    const w = Math.max(240, Math.round(mount.clientWidth));
    if (w === last) return;
    last = w;
    draw(w);
  };
  const ro = new ResizeObserver(go);
  ro.observe(mount);
  go();
}

function niceMax(v) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

function yAxis(w, h, max, fmt, ticks = Number.isInteger(max / 4) || !Number.isInteger(max / 5) ? 4 : 5) {
  let out = '';
  for (let i = 0; i <= ticks; i++) {
    const v = (max / ticks) * i;
    const y = PAD.top + (h - PAD.top - PAD.bottom) * (1 - i / ticks);
    out += `<line class="grid-line" x1="${PAD.left}" x2="${w - PAD.right}" y1="${y}" y2="${y}"/>`;
    out += `<text class="axis-text" x="${PAD.left - 6}" y="${y + 4}" text-anchor="end">${esc(fmt(v))}</text>`;
  }
  return out;
}

/** Which x labels to show so they don't collide. */
const labelEvery = (n, w) => Math.max(1, Math.ceil(n / Math.max(1, Math.floor((w - PAD.left - PAD.right) / 70))));

/**
 * Line chart (one series). points: [{ label, value, tip (html), onClick? }], oldest first.
 */
export function lineChart(mount, { points, max = null, height = 220, format = (v) => num(v) }) {
  if (!points.length) return render(mount, html`<div class="chart-empty">No runs yet</div>`);
  responsive(mount, (w) => {
    const top = max ?? niceMax(Math.max(...points.map((p) => p.value ?? 0)));
    const innerW = w - PAD.left - PAD.right;
    const innerH = height - PAD.top - PAD.bottom;
    const x = (i) => PAD.left + (points.length === 1 ? innerW / 2 : (innerW * i) / (points.length - 1));
    const y = (v) => PAD.top + innerH * (1 - (v ?? 0) / top);
    const valid = points.map((p, i) => ({ ...p, i })).filter((p) => p.value !== null && p.value !== undefined);
    const d = valid.map((p, k) => `${k ? 'L' : 'M'}${x(p.i)},${y(p.value)}`).join('');
    const area = valid.length > 1 ? `${d}L${x(valid.at(-1).i)},${y(0)}L${x(valid[0].i)},${y(0)}Z` : '';
    const every = labelEvery(points.length, w);
    const slot = points.length > 1 ? innerW / (points.length - 1) : innerW;
    let svg = `<svg class="chart" viewBox="0 0 ${w} ${height}" height="${height}" role="img">`;
    svg += yAxis(w, height, top, format);
    svg += points
      .map((p, i) =>
        i % every === 0 || i === points.length - 1
          ? `<text class="axis-text" x="${x(i)}" y="${height - 6}" text-anchor="middle">${esc(p.label)}</text>`
          : '',
      )
      .join('');
    if (area) svg += `<path class="area" d="${area}"/>`;
    svg += `<path class="line" d="${d}"/>`;
    svg += `<line class="hover-line" x1="0" x2="0" y1="${PAD.top}" y2="${height - PAD.bottom}" visibility="hidden"/>`;
    svg += valid.map((p) => `<circle class="dot" cx="${x(p.i)}" cy="${y(p.value)}" r="${points.length > 40 ? 3 : 4.5}"/>`).join('');
    svg += points
      .map(
        (p, i) =>
          `<rect class="hit" data-i="${i}" x="${x(i) - slot / 2}" y="${PAD.top}" width="${slot}" height="${innerH}"/>`,
      )
      .join('');
    svg += '</svg>';
    mount.innerHTML = svg;
    const line = mount.querySelector('.hover-line');
    mount.querySelectorAll('.hit').forEach((r) => {
      const p = points[Number(r.dataset.i)];
      r.addEventListener('mousemove', (e) => {
        line.setAttribute('x1', x(Number(r.dataset.i)));
        line.setAttribute('x2', x(Number(r.dataset.i)));
        line.setAttribute('visibility', 'visible');
        showTip(p.tip, e.clientX, e.clientY);
      });
      r.addEventListener('mouseleave', () => {
        line.setAttribute('visibility', 'hidden');
        hideTip();
      });
      if (p.onClick) r.addEventListener('click', p.onClick);
    });
  });
}

/** Bars (one series). bars: [{ label, value, tip, onClick? }]. */
export function barChart(mount, { bars, height = 220, format = (v) => num(v) }) {
  if (!bars.length) return render(mount, html`<div class="chart-empty">No runs yet</div>`);
  responsive(mount, (w) => {
    const top = niceMax(Math.max(...bars.map((b) => b.value ?? 0)));
    const innerW = w - PAD.left - PAD.right;
    const innerH = height - PAD.top - PAD.bottom;
    const slot = innerW / bars.length;
    const bw = Math.max(3, Math.min(36, slot - 2));
    const every = labelEvery(bars.length, w);
    let svg = `<svg class="chart" viewBox="0 0 ${w} ${height}" height="${height}" role="img">`;
    svg += yAxis(w, height, top, format);
    bars.forEach((b, i) => {
      const cx = PAD.left + slot * i + slot / 2;
      const bh = Math.max(b.value ? 2 : 0, (innerH * (b.value ?? 0)) / top);
      const y0 = PAD.top + innerH;
      const r = Math.min(4, bw / 2, bh);
      // Rounded only at the data end (top), square at the baseline.
      svg += `<path class="${b.cls ?? 'bar-primary'}" d="M${cx - bw / 2},${y0}V${y0 - bh + r}Q${cx - bw / 2},${y0 - bh} ${cx - bw / 2 + r},${y0 - bh}H${cx + bw / 2 - r}Q${cx + bw / 2},${y0 - bh} ${cx + bw / 2},${y0 - bh + r}V${y0}Z"/>`;
      if (i % every === 0 || i === bars.length - 1) {
        svg += `<text class="axis-text" x="${cx}" y="${height - 6}" text-anchor="middle">${esc(b.label)}</text>`;
      }
      svg += `<rect class="hit" data-i="${i}" x="${cx - slot / 2}" y="${PAD.top}" width="${slot}" height="${innerH}"/>`;
    });
    svg += '</svg>';
    mount.innerHTML = svg;
    wireHits(mount, bars);
  });
}

/** Stacked status bars per run. bars: [{ label, parts: {passed, flaky, failed, skipped}, tip, onClick? }]. */
export function stackedBars(mount, { bars, height = 220 }) {
  if (!bars.length) return render(mount, html`<div class="chart-empty">No runs yet</div>`);
  const order = ['passed', 'flaky', 'failed', 'skipped'];
  responsive(mount, (w) => {
    const total = (b) => order.reduce((s, k) => s + (b.parts[k] ?? 0), 0);
    const top = niceMax(Math.max(...bars.map(total)));
    const innerW = w - PAD.left - PAD.right;
    const innerH = height - PAD.top - PAD.bottom;
    const slot = innerW / bars.length;
    const bw = Math.max(3, Math.min(36, slot - 2));
    const every = labelEvery(bars.length, w);
    let svg = `<svg class="chart" viewBox="0 0 ${w} ${height}" height="${height}" role="img">`;
    svg += yAxis(w, height, top, (v) => num(Math.round(v)));
    bars.forEach((b, i) => {
      const cx = PAD.left + slot * i + slot / 2;
      let y = PAD.top + innerH;
      const present = order.filter((k) => b.parts[k] > 0);
      present.forEach((k, j) => {
        const h = (innerH * b.parts[k]) / top;
        // 2px surface gap between segments.
        const gap = j < present.length - 1 ? 2 : 0;
        const segH = Math.max(1, h - gap);
        const isTop = j === present.length - 1;
        const r = isTop ? Math.min(4, bw / 2, segH) : 0;
        const yTop = y - segH;
        svg += r
          ? `<path class="f-${k}" d="M${cx - bw / 2},${y}V${yTop + r}Q${cx - bw / 2},${yTop} ${cx - bw / 2 + r},${yTop}H${cx + bw / 2 - r}Q${cx + bw / 2},${yTop} ${cx + bw / 2},${yTop + r}V${y}Z"/>`
          : `<rect class="f-${k}" x="${cx - bw / 2}" y="${yTop}" width="${bw}" height="${segH}"/>`;
        y -= h;
      });
      if (i % every === 0 || i === bars.length - 1) {
        svg += `<text class="axis-text" x="${cx}" y="${height - 6}" text-anchor="middle">${esc(b.label)}</text>`;
      }
      svg += `<rect class="hit" data-i="${i}" x="${cx - slot / 2}" y="${PAD.top}" width="${slot}" height="${innerH}"/>`;
    });
    svg += '</svg>';
    mount.innerHTML = svg;
    wireHits(mount, bars);
  });
}

function wireHits(mount, items) {
  mount.querySelectorAll('.hit').forEach((r) => {
    const item = items[Number(r.dataset.i)];
    r.addEventListener('mousemove', (e) => showTip(item.tip, e.clientX, e.clientY));
    r.addEventListener('mouseleave', hideTip);
    if (item.onClick) r.addEventListener('click', item.onClick);
  });
}

/** Tiny trend line (oldest → newest) for table cells. Values may contain nulls. */
export function sparkline(values, { width = 120, height = 28, label = 'Trend' } = {}) {
  const pts = values.map((v, i) => ({ v, i })).filter((p) => p.v !== null && p.v !== undefined);
  if (pts.length < 2) return html`<span class="muted small">—</span>`;
  const max = Math.max(...pts.map((p) => p.v));
  const min = Math.min(...pts.map((p) => p.v));
  const x = (i) => 3 + ((width - 6) * i) / Math.max(1, values.length - 1);
  const y = (v) => height - 3 - ((height - 6) * (v - min)) / Math.max(1e-9, max - min);
  const d = pts.map((p, k) => `${k ? 'L' : 'M'}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join('');
  const last = pts.at(-1);
  return html`<svg class="spark" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${label}"><path d="${d}"/><circle cx="${x(last.i)}" cy="${y(last.v)}" r="2.5"/></svg>`;
}

/** Tooltip body: a title and rows of label/value. */
export const tipRows = (title, rows) =>
  html`<b>${title}</b>${rows.map(([k, v]) => html`<div class="row"><span>${k}</span><b>${v}</b></div>`)}`;

