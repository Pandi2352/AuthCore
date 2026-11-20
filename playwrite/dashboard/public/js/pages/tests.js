// Tests: every test Playwright knows about, with its record across the kept runs.
import { ago, api, debounce, dur, html, icon, num, render, STATE, when } from '../lib.js';
import {
  badge,
  dataTable,
  dropdown,
  emptyState,
  iconAction,
  loading,
  openDialog,
  refreshButton,
  sectionCard,
  spinWhile,
  stateBadge,
  statCard,
  tagBadge,
  toast,
} from '../ui.js';
import { goLaunch } from './common.js';

const regexEscape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export async function page(main) {
  render(main, loading('Reading the test list…'));
  let rows = [];
  let catalog;
  const filters = { q: '', project: 'all', file: 'all', tag: 'all', last: 'all' };

  const load = async (refresh = false) => {
    const [cat, hist] = await Promise.all([api.catalog(refresh), api.history()]);
    catalog = cat;
    const known = new Set();
    rows = cat.tests.map((t) => {
      known.add(t.key);
      return summarize(t, hist[t.key] ?? []);
    });
    // Tests that ran before but no longer exist (renamed or deleted).
    for (const [key, list] of Object.entries(hist)) {
      if (known.has(key)) continue;
      const [project, file, fullTitle] = key.split('|');
      rows.push(summarize({ key, project, file, fullTitle, title: fullTitle.split(' › ').pop(), line: null, tags: [], removed: true }, list));
    }
  };
  try {
    await load();
  } catch (e) {
    render(main, emptyState({ icon: 'alert', title: 'Could not read the tests', text: e.message }));
    return null;
  }

  render(
    main,
    html`<div class="page-head">
        <div><h1>Tests</h1><p>Every test in the project with its record across all kept runs: last result, recent runs, pass rate and time.</p></div>
        <div class="actions"><a class="btn btn-primary" href="#/launch">${icon('play')}Run tests</a></div>
      </div>
      <div class="stack">
        <div class="grid grid-stats" id="cards"></div>
        ${catalog.error ? html`<div class="callout t-danger">${icon('alert')}<div><strong>Playwright could not list the tests</strong><pre class="code wrap" style="background:none;border:0;padding:4px 0 0">${catalog.error}</pre></div></div>` : ''}
        ${sectionCard({
          tone: 'primary',
          icon: 'flask',
          title: 'All tests',
          description: 'Click a test for its full history. Recent runs: oldest left, newest right.',
          flush: true,
          body: html`<div class="toolbar">
              <label class="field grow">${icon('search')}<span class="sr-only">Search tests</span><input type="search" placeholder="Search by test name or file" data-search /></label>
              <div data-dd="last"></div><div data-dd="project"></div><div data-dd="file"></div><div data-dd="tag"></div>
              ${refreshButton()}
            </div><div id="table"></div>`,
        })}
      </div>`,
  );

  const drawCards = () => {
    const live = rows.filter((r) => !r.removed);
    const failingNow = live.filter((r) => r.last === 'failed' || r.last === 'timedOut').length;
    const flakyEver = live.filter((r) => r.flaky > 0).length;
    const never = live.filter((r) => !r.runs).length;
    const slow = live.filter((r) => r.avg !== null && r.avg > 10_000).length;
    render(
      main.querySelector('#cards'),
      html`${statCard({ tone: 'primary', pattern: 'rings', icon: 'flask', label: 'Tests', value: num(live.length), hint: `${catalog.files.length} files · ${catalog.projects.length} projects` })}
        ${statCard({ tone: 'danger', pattern: 'stripes', icon: 'xCircle', label: 'Failing now', value: num(failingNow), hint: 'Last result was a failure', action: 'last:failed' })}
        ${statCard({ tone: 'warning', pattern: 'dots', icon: 'alert', label: 'Flaky', value: num(flakyEver), hint: 'Needed a retry at least once', action: 'last:flakyEver' })}
        ${statCard({ tone: 'neutral', pattern: 'grid', icon: 'skip', label: 'Never run', value: num(never), hint: 'No kept run has them', action: 'last:never' })}
        ${statCard({ tone: 'cyan', pattern: 'bars', icon: 'timer', label: 'Slow tests', value: num(slow), hint: 'Over 10 s on average', action: 'last:slow' })}`,
    );
    main.querySelectorAll('#cards [data-action^="last:"]').forEach((b) =>
      b.addEventListener('click', () => {
        filters.last = b.dataset.action.slice(5);
        lastDd.set(filters.last);
        update();
      }),
    );
  };

  const filtered = () => {
    const q = filters.q.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (filters.project === 'all' || r.project === filters.project) &&
        (filters.file === 'all' || r.file === filters.file) &&
        (filters.tag === 'all' || r.tags.includes(filters.tag)) &&
        (filters.last === 'all' ||
          (filters.last === 'never' && !r.runs) ||
          (filters.last === 'flakyEver' && r.flaky > 0) ||
          (filters.last === 'slow' && r.avg !== null && r.avg > 10_000) ||
          (filters.last === 'removed' && r.removed) ||
          (filters.last === 'failed' && (r.last === 'failed' || r.last === 'timedOut')) ||
          r.last === filters.last) &&
        (!q || r.fullTitle.toLowerCase().includes(q) || (r.file ?? '').toLowerCase().includes(q)),
    );
  };

  const table = dataTable(main.querySelector('#table'), {
    rows: filtered(),
    pageSize: 25,
    onRow: (r) => showHistory(r),
    empty: emptyState({ icon: 'search', title: 'No tests match', text: 'Change the search or filters.' }),
    columns: [
      {
        key: 'name',
        label: 'Test',
        className: 'wide',
        render: (r) => html`<div class="two-line"><strong>${r.fullTitle}${r.removed ? html` ${badge('No longer in the code', 'neutral', null, true)}` : ''}</strong><span class="mono">${r.file}${r.line ? `:${r.line}` : ''}</span></div>`,
        sort: (r) => r.fullTitle.toLowerCase(),
      },
      { key: 'project', label: 'Project', className: 'fit', render: (r) => badge(r.project, 'cyan', r.project === 'mobile' ? 'phone' : 'monitor', true), sort: (r) => r.project },
      { key: 'tags', label: 'Tags', className: 'fit', render: (r) => html`<span class="chips" style="gap:4px;flex-wrap:nowrap">${r.tags.map(tagBadge)}</span>` },
      { key: 'last', label: 'Last result', className: 'fit', render: (r) => (r.last ? stateBadge(r.last, 1, true) : badge('Never run', 'neutral', null, true)), sort: (r) => r.last ?? 'zz' },
      { key: 'recent', label: 'Recent runs', className: 'fit', render: (r) => strip(r.list) },
      { key: 'rate', label: 'Pass rate', className: 'fit num', render: (r) => (r.rate === null ? '—' : `${r.rate}%`), sort: (r) => r.rate },
      { key: 'flaky', label: 'Flaky', className: 'fit num', render: (r) => num(r.flaky), sort: (r) => r.flaky },
      { key: 'avg', label: 'Avg time', className: 'fit num', render: (r) => dur(r.avg), sort: (r) => r.avg },
      { key: 'when', label: 'Last run', className: 'fit nowrap', render: (r) => (r.list[0] ? html`<span data-tip="${when(r.list[0].startedAt)}">${ago(r.list[0].startedAt)}</span>` : '—'), sort: (r) => r.list[0]?.startedAt ?? '' },
      { key: 'act', label: '', className: 'fit', render: (r) => (r.removed ? '' : iconAction(`run:${r.key}`, 'play', 'Run', 'success')) },
    ],
    sort: { key: 'last', dir: 'asc' },
  });
  main.querySelector('#table').addEventListener('click', (e) => {
    const b = e.target.closest('[data-action^="run:"]');
    if (!b) return;
    const r = rows.find((x) => x.key === b.dataset.action.slice(4));
    runOne(r);
  });

  const update = () => {
    drawCards();
    table.setRows(filtered());
  };
  drawCards();

  const opts = (list, all) => [{ value: 'all', label: all }, ...list.map((v) => ({ value: v, label: v }))];
  const lastDd = dropdown(main.querySelector('[data-dd="last"]'), {
    options: [
      { value: 'all', label: 'Any result' },
      { value: 'passed', label: 'Last: passed' },
      { value: 'failed', label: 'Last: failed' },
      { value: 'flaky', label: 'Last: flaky' },
      { value: 'skipped', label: 'Last: skipped' },
      { value: 'never', label: 'Never run' },
      { value: 'flakyEver', label: 'Flaky at least once' },
      { value: 'slow', label: 'Slow (over 10 s)' },
      { value: 'removed', label: 'No longer in the code' },
    ],
    value: 'all',
    label: 'Result',
    width: '190px',
    onChange: (v) => ((filters.last = v), update()),
  });
  dropdown(main.querySelector('[data-dd="project"]'), { options: opts(catalog.projects.map((p) => p.name), 'All projects'), value: 'all', label: 'Project', onChange: (v) => ((filters.project = v), update()) });
  dropdown(main.querySelector('[data-dd="file"]'), { options: opts(catalog.files, 'All files'), value: 'all', label: 'File', width: '200px', onChange: (v) => ((filters.file = v), update()) });
  dropdown(main.querySelector('[data-dd="tag"]'), { options: opts(catalog.tags, 'All tags'), value: 'all', label: 'Tag', onChange: (v) => ((filters.tag = v), update()) });
  main.querySelector('[data-search]').addEventListener('input', debounce((e) => ((filters.q = e.target.value), update())));
  const refreshBtn = main.querySelector('[data-action="refresh"]');
  refreshBtn.addEventListener('click', () =>
    spinWhile(refreshBtn, async () => {
      try {
        await load(true);
        update();
      } catch (e) {
        toast(e.message, 'danger');
      }
    }),
  );
  return null;
}

function summarize(t, list) {
  const ran = list.filter((h) => h.state !== 'skipped' && h.state !== 'interrupted');
  const ok = ran.filter((h) => h.state === 'passed' || h.state === 'flaky').length;
  return {
    ...t,
    list,
    runs: list.length,
    last: list[0]?.state ?? null,
    rate: ran.length ? Math.round((ok / ran.length) * 100) : null,
    flaky: list.filter((h) => h.state === 'flaky').length,
    failed: list.filter((h) => h.state === 'failed' || h.state === 'timedOut').length,
    avg: ran.length ? ran.reduce((s, h) => s + h.duration, 0) / ran.length : null,
  };
}

const strip = (list) => {
  const last = list.slice(0, 15).reverse();
  if (!last.length) return html`<span class="hist"><i class="none"></i></span>`;
  return html`<span class="hist" aria-label="Recent results">${last.map(
    (h) => html`<i class="c-${STATE[h.state]?.bar ?? 'skipped'}" data-tip="${`${when(h.startedAt)}: ${STATE[h.state]?.label ?? h.state}, ${dur(h.duration)}`}"></i>`,
  )}</span>`;
};

function runOne(r) {
  goLaunch({ projects: [r.project], files: [r.file], grep: regexEscape(r.title), label: `Run: ${r.title}`.slice(0, 80) });
}

function showHistory(r) {
  const { el, close } = openDialog({
    title: r.title,
    description: html`${r.project} · <span class="mono">${r.file}${r.line ? `:${r.line}` : ''}</span>`,
    width: 900,
    body: html`<div class="grid grid-stats" style="margin-bottom:16px">
        ${statCard({ tone: 'primary', pattern: 'rings', icon: 'history', label: 'Runs', value: num(r.runs), hint: 'Kept runs with this test' })}
        ${statCard({ tone: 'success', pattern: 'waves', icon: 'checkCircle', label: 'Pass rate', value: r.rate === null ? '—' : `${r.rate}%`, hint: `${num(r.failed)} failed` })}
        ${statCard({ tone: 'warning', pattern: 'dots', icon: 'alert', label: 'Flaky', value: num(r.flaky), hint: 'Passed after a retry' })}
        ${statCard({ tone: 'cyan', pattern: 'bars', icon: 'timer', label: 'Average', value: dur(r.avg), hint: 'Per run' })}
      </div>
      ${r.tags.length ? html`<div class="chips" style="margin-bottom:12px">${r.tags.map(tagBadge)}</div>` : ''}
      ${r.list.length
        ? html`<div class="table-wrap"><table class="data"><thead><tr><th class="sno">S.No</th><th>Run</th><th>Result</th><th class="fit">Time</th><th>Error</th><th class="fit"></th></tr></thead>
            <tbody>${r.list.map(
              (h, i) => html`<tr><td class="sno">${i + 1}</td><td class="nowrap">${when(h.startedAt)}</td><td>${stateBadge(h.state, h.attempts, true)}</td><td class="fit num">${dur(h.duration)}</td><td><span class="small">${h.error ?? '—'}</span></td>
                <td class="fit"><a class="icon-btn tone-primary" href="#/runs/${encodeURIComponent(h.runId)}?test=${h.index}" data-tip="Open" aria-label="Open in that run">${icon('eye')}</a></td></tr>`,
            )}</tbody></table></div>`
        : emptyState({ icon: 'history', title: 'Never run yet', text: 'Run it to start its history.' })}`,
    footer: r.removed ? '' : html`<button type="button" class="btn btn-primary" data-run>${icon('play')}Run this test</button>`,
  });
  el.querySelector('[data-run]')?.addEventListener('click', () => {
    close();
    runOne(r);
  });
}
