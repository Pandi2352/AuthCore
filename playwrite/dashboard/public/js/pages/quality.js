// Accessibility & speed: accessibility scan results per page (axe, WCAG 2.2 AA) and how
// long each page takes to open, with trends across runs.
import { setQuery } from '../app.js';
import { barChart, lineChart, sparkline, tipRows } from '../charts.js';
import { api, dur, getRun, html, icon, num, render, when } from '../lib.js';
import { badge, dataTable, dropdown, emptyState, loading, openDialog, sectionCard, statCard, tabs } from '../ui.js';
import { runTitle } from './common.js';

const IMPACTS = ['critical', 'serious', 'moderate', 'minor'];
const IMPACT_LABEL = { critical: 'Critical', serious: 'Serious', moderate: 'Moderate', minor: 'Minor' };
const impactTone = { critical: 'danger', serious: 'danger', moderate: 'warning', minor: 'neutral' };

export async function page(main, _params, query) {
  render(main, loading());
  const [runs, trend] = await Promise.all([api.runs().catch(() => []), api.quality().catch(() => ({ runs: [] }))]);
  const scanned = trend.runs.filter((r) => r.a11y || r.loads.length);
  let runId = query.get('run') ?? scanned[0]?.id ?? runs[0]?.id;
  let tab = query.get('tab') ?? 'a11y';

  render(
    main,
    html`<div class="page-head">
        <div><h1>Accessibility & speed</h1><p>The smoke tests scan every page for accessibility problems (WCAG 2.2 AA, with axe) and time how long each page takes to open.</p></div>
        <div class="actions"><div data-dd="run"></div></div>
      </div>
      <div class="stack" id="q"></div>`,
  );
  if (!runs.length) {
    render(main.querySelector('#q'), emptyState({ icon: 'access', title: 'No runs yet' }));
    return null;
  }
  dropdown(main.querySelector('[data-dd="run"]'), {
    options: runs.map((r) => ({ value: r.id, label: runTitle(r), hint: trend.runs.find((t) => t.id === r.id)?.a11y ? 'scanned' : '' })),
    value: runId,
    label: 'Run',
    width: '260px',
    onChange: (v) => {
      runId = v;
      setQuery({ run: v, tab: tab === 'a11y' ? '' : tab });
      draw();
    },
  });

  async function draw() {
    const box = main.querySelector('#q');
    render(box, loading());
    const run = await getRun(runId);
    const pages = run.a11y ?? [];
    const loads = (run.metrics ?? []).filter((m) => m.kind === 'page-load');
    const count = (imp) => pages.reduce((s, p) => s + (p.violations ?? []).filter((v) => v.impact === imp).length, 0);
    const total = pages.reduce((s, p) => s + (p.violations ?? []).length, 0);
    const clean = pages.filter((p) => !p.error && !(p.violations ?? []).length).length;
    const slowest = [...loads].sort((a, b) => b.ms - a.ms)[0];
    render(
      box,
      html`${!pages.length && !loads.length ? html`<div class="callout t-warning">${icon('alert')}<div><strong>This run has no scans</strong><div>The smoke tests scan pages and time them from now on (turn off with PW_PAGE_CHECKS=0). Run them once.</div></div></div>` : ''}
        <div class="grid grid-stats">
          ${statCard({ tone: 'primary', pattern: 'rings', icon: 'access', label: 'Pages scanned', value: num(pages.length), hint: `${num(clean)} with no problems`, action: 'tab:a11y' })}
          ${statCard({ tone: count('critical') + count('serious') ? 'danger' : 'success', pattern: 'stripes', icon: 'alert', label: 'Critical & serious', value: num(count('critical') + count('serious')), hint: `${num(total)} problems in all`, action: 'tab:a11y' })}
          ${statCard({ tone: 'cyan', pattern: 'bars', icon: 'timer', label: 'Slowest page', value: slowest ? dur(slowest.ms) : '—', hint: slowest ? `${slowest.name} · ${slowest.project}` : 'Not timed', action: 'tab:speed' })}
          ${statCard({ tone: 'violet', pattern: 'sparkles', icon: 'gauge', label: 'Average page', value: loads.length ? dur(loads.reduce((s, m) => s + m.ms, 0) / loads.length) : '—', hint: `${num(loads.length)} pages timed`, action: 'tab:speed' })}
        </div>
        <div><div id="q-tabs"></div><div id="q-body"></div></div>`,
    );
    const body = box.querySelector('#q-body');
    const views = { a11y: () => a11yTab(body, run, pages), speed: () => speedTab(body, run, loads) };
    if (!views[tab]) tab = 'a11y';
    const ctl = tabs(
      box.querySelector('#q-tabs'),
      [
        { id: 'a11y', label: 'Accessibility', icon: 'access', count: total, countTone: total ? 'danger' : undefined },
        { id: 'speed', label: 'Page speed', icon: 'timer' },
      ],
      tab,
      (id) => {
        tab = id;
        setQuery({ run: runId, tab: id === 'a11y' ? '' : id });
        views[id]();
      },
    );
    views[tab]();
    box.querySelectorAll('[data-action^="tab:"]').forEach((b) => b.addEventListener('click', () => ctl.select(b.dataset.action.slice(4))));
  }

  // ------------------------------------------------------------- accessibility
  function a11yTab(body, run, pages) {
    const rules = new Map();
    for (const p of pages) {
      for (const v of p.violations ?? []) {
        const r = rules.get(v.id) ?? { ...v, pages: [], nodesTotal: 0 };
        r.pages.push(p);
        r.nodesTotal += v.nodes;
        rules.set(v.id, r);
      }
    }
    const ruleRows = [...rules.values()].sort((a, b) => IMPACTS.indexOf(a.impact) - IMPACTS.indexOf(b.impact) || b.pages.length - a.pages.length);
    const trendRuns = [...trend.runs].reverse().filter((r) => r.a11y).slice(-30);
    render(
      body,
      html`<div class="stack">
        <div class="grid grid-2" style="align-items:start">
          ${sectionCard({
            tone: 'danger',
            icon: 'alert',
            title: 'Problems by rule',
            description: 'Each rule once, with the pages it shows up on. Click for where and how to fix it.',
            flush: true,
            body: ruleRows.length
              ? html`<ul class="list">${ruleRows.map(
                  (r) => html`<li><button type="button" class="list-row" data-rule="${r.id}">
                    <span class="grow"><strong style="display:block">${r.help}</strong><span class="muted small mono">${r.id} · ${num(r.pages.length)} page${r.pages.length === 1 ? '' : 's'} · ${num(r.nodesTotal)} element${r.nodesTotal === 1 ? '' : 's'}</span></span>
                    ${badge(IMPACT_LABEL[r.impact] ?? r.impact, impactTone[r.impact] ?? 'neutral', null, true)}${icon('chevronRight')}
                  </button></li>`,
                )}</ul>`
              : emptyState({ icon: 'checkCircle', title: pages.length ? 'No problems found' : 'Not scanned', text: pages.length ? 'Every scanned page passed the automatic checks. Automatic checks find about a third of real problems: try the keyboard and a screen reader too.' : '' }),
          })}
          ${sectionCard({ tone: 'violet', icon: 'activity', title: 'Problems over runs', description: 'Rules broken, summed over all scanned pages.', body: html`<div id="a11y-trend"></div>` })}
        </div>
        ${sectionCard({ tone: 'primary', icon: 'monitor', title: 'Every page scanned', flush: true, body: html`<div id="a11y-pages"></div>` })}
      </div>`,
    );
    lineChart(body.querySelector('#a11y-trend'), {
      points: trendRuns.map((r, i) => ({
        label: `#${i + 1}`,
        value: r.a11y.violations,
        tip: tipRows(when(r.startedAt), [['Problems', num(r.a11y.violations)], ['Critical', num(r.a11y.critical)], ['Serious', num(r.a11y.serious)], ['Pages', num(r.a11y.pages)]]),
        onClick: () => (location.hash = `#/quality?run=${encodeURIComponent(r.id)}`),
      })),
    });
    dataTable(body.querySelector('#a11y-pages'), {
      rows: pages,
      pageSize: 30,
      onRow: (p) => pageDialog(p),
      empty: emptyState({ icon: 'access', title: 'No pages scanned in this run' }),
      columns: [
        { key: 'page', label: 'Page', className: 'wide', render: (p) => html`<strong class="mono">${p.page}</strong>`, sort: (p) => p.page },
        { key: 'project', label: 'Project', className: 'fit', render: (p) => badge(p.project, 'cyan', p.project === 'mobile' ? 'phone' : 'monitor', true), sort: (p) => p.project },
        ...IMPACTS.map((imp) => ({ key: imp, label: IMPACT_LABEL[imp], className: 'fit num', render: (p) => { const n = (p.violations ?? []).filter((v) => v.impact === imp).length; return n ? html`<span class="impact impact-${imp}">${n}</span>` : html`<span class="muted">0</span>`; }, sort: (p) => (p.violations ?? []).filter((v) => v.impact === imp).length })),
        { key: 'passes', label: 'Checks passed', className: 'fit num', render: (p) => (p.error ? badge('Scan failed', 'warning', null, true) : num(p.passes)), sort: (p) => p.passes ?? 0 },
      ],
      sort: { key: 'critical', dir: 'desc' },
    });
    body.querySelectorAll('[data-rule]').forEach((b) => b.addEventListener('click', () => ruleDialog(rules.get(b.dataset.rule))));
  }

  const examples = (v) => html`${(v.examples ?? []).map(
    (ex) => html`<div style="margin-top:8px"><div class="small"><strong>Element:</strong> <span class="mono">${ex.target}</span></div><pre class="code wrap" style="max-height:120px">${ex.html}</pre>${ex.summary ? html`<div class="small muted" style="white-space:pre-wrap">${ex.summary}</div>` : ''}</div>`,
  )}`;

  function ruleDialog(r) {
    openDialog({
      title: r.help,
      description: html`<span class="mono">${r.id}</span> · ${IMPACT_LABEL[r.impact] ?? r.impact} · ${(r.tags ?? []).join(', ')}`,
      width: 900,
      body: html`<p style="margin-bottom:12px">${r.description}</p>
        <a class="btn btn-outline btn-sm" href="${r.helpUrl}" target="_blank" rel="noopener noreferrer">${icon('external')}How to fix it (Deque)</a>
        ${r.pages.map((p) => {
          const v = p.violations.find((x) => x.id === r.id);
          return html`<div style="margin-top:16px;padding-top:12px;border-top:1px solid var(--border)"><strong class="mono">${p.page}</strong> <span class="muted small">${p.project} · ${num(v.nodes)} element${v.nodes === 1 ? '' : 's'}</span>${examples(v)}</div>`;
        })}`,
    });
  }

  function pageDialog(p) {
    openDialog({
      title: p.page,
      description: `${p.project} · ${num(p.passes)} checks passed · ${num(p.incomplete)} need a person to check`,
      width: 900,
      body: p.error
        ? html`<div class="callout t-warning">${icon('alert')}<div>The scan failed: ${p.error}</div></div>`
        : (p.violations ?? []).length
          ? html`${p.violations.map(
              (v) => html`<div style="margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid var(--border)">
                <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">${badge(IMPACT_LABEL[v.impact] ?? v.impact, impactTone[v.impact] ?? 'neutral', null, true)}<strong>${v.help}</strong><span class="muted small mono">${v.id}</span></div>
                <p class="small" style="margin-top:4px">${v.description} <a href="${v.helpUrl}" target="_blank" rel="noopener noreferrer">How to fix ${icon('external')}</a></p>
                ${examples(v)}
              </div>`,
            )}`
          : emptyState({ icon: 'checkCircle', title: 'No problems found on this page' }),
    });
  }

  // -------------------------------------------------------------------- speed
  function speedTab(body, run, loads) {
    const history = new Map();
    for (const r of [...trend.runs].reverse()) {
      for (const l of r.loads) {
        const k = `${l.project}|${l.name}`;
        const list = history.get(k) ?? [];
        list.push(l.ms);
        history.set(k, list);
      }
    }
    const rows = loads.map((l) => {
      const list = history.get(`${l.project}|${l.name}`) ?? [];
      const avg = list.length ? list.reduce((s, v) => s + v, 0) / list.length : null;
      return { ...l, avg, trend: list.slice(-20), change: avg ? (l.ms - avg) / avg : null };
    });
    render(
      body,
      html`<div class="stack">
        ${sectionCard({ tone: 'cyan', icon: 'timer', title: 'Time to open each page', description: 'From the menu click to the page heading showing, in this run. Pages that were already open are not timed.', body: html`<div id="speed-chart"></div>` })}
        ${sectionCard({ tone: 'primary', icon: 'activity', title: 'Every page', description: 'This run against the average of all kept runs.', flush: true, body: html`<div id="speed-table"></div>` })}
      </div>`,
    );
    const sorted = [...rows].sort((a, b) => b.ms - a.ms).slice(0, 30);
    barChart(body.querySelector('#speed-chart'), {
      bars: sorted.map((r) => ({ label: r.name.split('/').pop() || '/', value: r.ms, tip: tipRows(r.name, [['Project', r.project], ['This run', dur(r.ms)], ['Average', dur(r.avg)]]) })),
      format: (v) => dur(v),
    });
    dataTable(body.querySelector('#speed-table'), {
      rows,
      pageSize: 40,
      empty: emptyState({ icon: 'timer', title: 'No pages timed in this run' }),
      columns: [
        { key: 'name', label: 'Page', className: 'wide', render: (r) => html`<strong class="mono">${r.name}</strong>`, sort: (r) => r.name },
        { key: 'project', label: 'Project', className: 'fit', render: (r) => badge(r.project, 'cyan', r.project === 'mobile' ? 'phone' : 'monitor', true), sort: (r) => r.project },
        { key: 'ms', label: 'This run', className: 'fit num', render: (r) => html`<strong>${dur(r.ms)}</strong>`, sort: (r) => r.ms },
        { key: 'avg', label: 'Average', className: 'fit num', render: (r) => dur(r.avg), sort: (r) => r.avg },
        { key: 'change', label: 'vs average', className: 'fit num', render: (r) => (r.change === null ? '—' : html`<span class="${r.change > 0.25 ? 'delta-up' : r.change < -0.25 ? 'delta-down' : ''}">${r.change > 0 ? '+' : ''}${Math.round(r.change * 100)}%</span>`), sort: (r) => r.change },
        { key: 'trend', label: 'Trend', className: 'fit', render: (r) => sparkline(r.trend, { label: 'Load time per run' }) },
      ],
      sort: { key: 'ms', dir: 'desc' },
    });
  }

  await draw();
  return null;
}
