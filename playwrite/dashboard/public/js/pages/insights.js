// Flaky & slow: tests that pass and fail without a change, tests getting slower, and
// failures that share the same error.
import { setQuery } from '../app.js';
import { sparkline } from '../charts.js';
import { ago, api, dur, errorSignature, html, icon, num, regexEscape, render, STATE, when } from '../lib.js';
import { dataTable, dropdown, emptyState, iconAction, loading, sectionCard, statCard, tabs } from '../ui.js';
import { goLaunch, runTitle } from './common.js';

export async function page(main, _params, query) {
  render(main, loading('Reading every kept run…'));
  let hist;
  let runs;
  try {
    [hist, runs] = await Promise.all([api.history(), api.runs()]);
  } catch (e) {
    render(main, emptyState({ icon: 'alert', title: 'Could not load the history', text: e.message }));
    return null;
  }
  let tab = query.get('tab') ?? 'flaky';

  const rows = Object.entries(hist).map(([key, list]) => {
    const [project, file, fullTitle] = key.split('|');
    const ran = list.filter((h) => !['skipped', 'interrupted'].includes(h.state));
    const firstTry = ran.filter((h) => h.state === 'passed').length;
    const flaky = ran.filter((h) => h.state === 'flaky').length;
    const failed = ran.filter((h) => h.state === 'failed' || h.state === 'timedOut').length;
    const durations = ran.map((h) => h.duration);
    const recent = durations.slice(0, 5);
    const earlier = durations.slice(5, 10);
    const avg = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null);
    const recentAvg = avg(recent);
    const earlierAvg = avg(earlier);
    return {
      key,
      project,
      file,
      fullTitle,
      title: fullTitle.split(' › ').pop(),
      list,
      runs: ran.length,
      firstTry,
      flaky,
      failed,
      // Unstable: needed a retry, or failed in some runs and passed in others.
      unstable: flaky + (failed && firstTry ? failed : 0),
      stableRate: ran.length ? Math.round((firstTry / ran.length) * 100) : null,
      lastFlaky: list.find((h) => h.state === 'flaky')?.startedAt ?? null,
      recentAvg,
      earlierAvg,
      change: recentAvg !== null && earlierAvg ? (recentAvg - earlierAvg) / earlierAvg : null,
      latest: durations[0] ?? null,
      max: durations.length ? Math.max(...durations) : null,
      trend: durations.slice(0, 20).reverse(),
    };
  });

  const openLatest = (r, state) => {
    const h = state ? r.list.find((x) => x.state === state) ?? r.list[0] : r.list[0];
    if (h) location.hash = `#/runs/${encodeURIComponent(h.runId)}?test=${h.index}`;
  };
  const repeat = (r, times) =>
    goLaunch({ projects: [r.project], files: [r.file], grep: regexEscape(r.title), repeatEach: times, retries: 0, label: `Repeat ×${times}: ${r.title}`.slice(0, 80) });

  render(
    main,
    html`<div class="page-head">
        <div><h1>Flaky & slow</h1><p>Across all ${num(runs.length)} kept runs: tests that pass and fail without a code change, tests that are slow or getting slower, and failures that share one error.</p></div>
      </div>
      <div class="stack"><div class="grid grid-stats" id="ins-cards"></div><div><div id="ins-tabs"></div><div id="ins-body"></div></div></div>`,
  );

  const flakyRows = rows.filter((r) => r.unstable > 0).sort((a, b) => b.unstable / b.runs - a.unstable / a.runs || b.unstable - a.unstable);
  const slowRows = rows.filter((r) => r.recentAvg !== null).sort((a, b) => b.recentAvg - a.recentAvg);
  const slower = slowRows.filter((r) => r.change !== null && r.change > 0.25 && r.recentAvg > 1000);
  render(
    main.querySelector('#ins-cards'),
    html`${statCard({ tone: 'warning', pattern: 'dots', icon: 'alert', label: 'Unstable tests', value: num(flakyRows.length), hint: 'Retried, or passed and failed', action: 'tab:flaky' })}
      ${statCard({ tone: 'cyan', pattern: 'bars', icon: 'timer', label: 'Slowest test', value: dur(slowRows[0]?.recentAvg), hint: slowRows[0]?.title ?? '—', action: 'tab:slow' })}
      ${statCard({ tone: 'danger', pattern: 'stripes', icon: 'activity', label: 'Getting slower', value: num(slower.length), hint: '25%+ slower than before', action: 'tab:slow' })}
      ${statCard({ tone: 'violet', pattern: 'sparkles', icon: 'layers', label: 'Runs looked at', value: num(runs.length), hint: runs[0] ? `Newest ${ago(runs[0].startedAt)}` : '—' })}`,
  );

  const strip = (list) => html`<span class="hist">${list
    .slice(0, 15)
    .reverse()
    .map((h) => html`<i class="c-${STATE[h.state]?.bar ?? 'skipped'}" data-tip="${`${when(h.startedAt)}: ${STATE[h.state]?.label ?? h.state}, ${dur(h.duration)}`}"></i>`)}</span>`;
  const testCell = (r) => html`<div class="two-line"><strong>${r.fullTitle}</strong><span class="mono">${r.project} · ${r.file}</span></div>`;

  // ------------------------------------------------------------------- flaky
  const flakyTab = (body) => {
    render(
      body,
      sectionCard({
        tone: 'warning',
        icon: 'alert',
        title: 'Unstable tests',
        description: 'Needed a retry, or failed in some runs and passed in others. Repeat one many times to see whether it really is flaky.',
        flush: true,
        body: html`<div id="flaky-table"></div>`,
      }),
    );
    const t = dataTable(body.querySelector('#flaky-table'), {
      rows: flakyRows,
      pageSize: 20,
      onRow: (r) => openLatest(r, 'flaky'),
      empty: emptyState({ icon: 'checkCircle', title: 'No unstable tests', text: 'Every test either always passed or always failed in the kept runs.' }),
      columns: [
        { key: 'test', label: 'Test', className: 'wide', render: testCell, sort: (r) => r.fullTitle },
        { key: 'stable', label: 'Passed first try', className: 'fit num', render: (r) => `${r.stableRate}%`, sort: (r) => r.stableRate },
        { key: 'flaky', label: 'Retried', className: 'fit num', render: (r) => num(r.flaky), sort: (r) => r.flaky },
        { key: 'failed', label: 'Failed', className: 'fit num', render: (r) => num(r.failed), sort: (r) => r.failed },
        { key: 'recent', label: 'Recent runs', className: 'fit', render: (r) => strip(r.list) },
        { key: 'last', label: 'Last retried', className: 'fit nowrap', render: (r) => (r.lastFlaky ? ago(r.lastFlaky) : '—'), sort: (r) => r.lastFlaky ?? '' },
        { key: 'act', label: '', className: 'fit', render: (r) => iconAction(`repeat:${r.key}`, 'repeat', 'Run it 10 times', 'success') },
      ],
      sort: { key: 'stable', dir: 'asc' },
    });
    body.querySelector('#flaky-table').addEventListener('click', (e) => {
      const b = e.target.closest('[data-action^="repeat:"]');
      if (b) repeat(rows.find((r) => r.key === b.dataset.action.slice(7)), 10);
    });
    return t;
  };

  // -------------------------------------------------------------------- slow
  const slowTab = (body) => {
    let top = 10;
    render(
      body,
      html`<div class="stack">
        ${sectionCard({
          tone: 'cyan',
          icon: 'timer',
          title: 'Slowest tests',
          description: 'Average of the last 5 runs. Trend: up to 20 runs, oldest on the left.',
          aside: html`<div data-dd="top"></div>`,
          flush: true,
          body: html`<div id="slow-table"></div>`,
        })}
        ${sectionCard({
          tone: 'danger',
          icon: 'activity',
          title: 'Getting slower',
          description: 'Last 5 runs at least 25% slower than the 5 before (tests over 1 s).',
          flush: true,
          body: slower.length
            ? html`<ul class="list">${slower.map(
                (r) => html`<li><button type="button" class="list-row" data-open="${r.key}">
                  <span class="grow">${testCell(r)}</span>${sparkline(r.trend, { label: 'Time per run' })}
                  <span class="nowrap small">${dur(r.earlierAvg)} → <strong>${dur(r.recentAvg)}</strong></span>
                  <span class="delta-up nowrap">+${Math.round(r.change * 100)}%</span>
                </button></li>`,
              )}</ul>`
            : emptyState({ icon: 'checkCircle', title: 'Nothing is getting slower', text: 'Needs at least 6 runs of a test to compare.' }),
        })}
      </div>`,
    );
    const columns = [
      { key: 'test', label: 'Test', className: 'wide', render: testCell, sort: (r) => r.fullTitle },
      { key: 'avg', label: 'Average', className: 'fit num', render: (r) => html`<strong>${dur(r.recentAvg)}</strong>`, sort: (r) => r.recentAvg },
      { key: 'latest', label: 'Latest', className: 'fit num', render: (r) => dur(r.latest), sort: (r) => r.latest },
      { key: 'max', label: 'Slowest', className: 'fit num', render: (r) => dur(r.max), sort: (r) => r.max },
      {
        key: 'change',
        label: 'Change',
        className: 'fit num',
        render: (r) => (r.change === null ? html`<span class="muted">—</span>` : html`<span class="${r.change > 0.1 ? 'delta-up' : r.change < -0.1 ? 'delta-down' : ''}">${r.change > 0 ? '+' : ''}${Math.round(r.change * 100)}%</span>`),
        sort: (r) => r.change,
      },
      { key: 'trend', label: 'Trend', className: 'fit', render: (r) => sparkline(r.trend, { label: 'Time per run' }) },
    ];
    const table = dataTable(body.querySelector('#slow-table'), { rows: slowRows.slice(0, top), pageSize: 50, columns, onRow: (r) => openLatest(r), sort: { key: 'avg', dir: 'desc' }, empty: emptyState({ icon: 'timer', title: 'No runs yet' }) });
    dropdown(body.querySelector('[data-dd="top"]'), {
      options: [10, 25, 50].map((n) => ({ value: n, label: `Top ${n}` })).concat([{ value: 9999, label: 'All tests' }]),
      value: top,
      label: 'How many',
      onChange: (v) => ((top = v), table.setRows(slowRows.slice(0, top))),
    });
    body.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => openLatest(rows.find((r) => r.key === b.dataset.open))));
  };

  // -------------------------------------------------------------- same error
  const errorsTab = async (body) => {
    const withProblems = runs.filter((r) => r.counts.failed + r.counts.timedOut + r.counts.flaky > 0);
    let runId = query.get('run') ?? withProblems[0]?.id ?? runs[0]?.id;
    render(
      body,
      html`<div class="stack">
        ${sectionCard({
          tone: 'danger',
          icon: 'bug',
          title: 'Failures in one run, grouped by error',
          description: 'Tests that failed with the same message (ids, numbers and generated names ignored) are shown once. Fix one cause, fix them all.',
          aside: html`<div data-dd="run"></div>`,
          flush: true,
          body: html`<div id="groups"></div>`,
        })}
        ${sectionCard({
          tone: 'violet',
          icon: 'history',
          title: 'Most common errors across all kept runs',
          flush: true,
          body: html`<div id="all-groups"></div>`,
        })}
      </div>`,
    );
    dropdown(body.querySelector('[data-dd="run"]'), {
      options: (withProblems.length ? withProblems : runs).map((r) => ({ value: r.id, label: runTitle(r), hint: `${num(r.counts.failed + r.counts.timedOut)} failed` })),
      value: runId,
      label: 'Run',
      width: '260px',
      onChange: (v) => {
        runId = v;
        setQuery({ tab: 'errors', run: v });
        drawGroups();
      },
    });
    const drawGroups = async () => {
      const box = body.querySelector('#groups');
      if (!runId) return render(box, emptyState({ icon: 'checkCircle', title: 'No runs yet' }));
      render(box, loading());
      const groups = await api.groups(runId).catch(() => []);
      render(
        box,
        groups.length
          ? html`<ul class="list">${groups.map(
              (g) => html`<li style="padding:12px 16px">
                <div style="display:flex;gap:10px;align-items:flex-start;flex-wrap:wrap">
                  <span class="badge tone-danger">${num(g.tests.length)} test${g.tests.length === 1 ? '' : 's'}</span>
                  <pre class="code error" style="flex:1;min-width:240px;margin:0;max-height:120px">${g.example || g.signature}</pre>
                </div>
                <div class="chips" style="margin-top:8px">${g.tests.map(
                  (t) => html`<a class="chip" href="#/runs/${encodeURIComponent(runId)}?test=${t.index}">${STATE[t.state]?.label ?? t.state} · ${t.title} · ${t.project}</a>`,
                )}</div>
              </li>`,
            )}</ul>`
          : emptyState({ icon: 'checkCircle', title: 'Nothing failed in this run' }),
      );
    };
    drawGroups();

    // Across history: the first error line of each failed result.
    const all = new Map();
    for (const r of rows) {
      for (const h of r.list) {
        if (!h.error || !['failed', 'timedOut', 'flaky'].includes(h.state)) continue;
        const sig = errorSignature(h.error);
        const g = all.get(sig) ?? { sig, example: h.error, tests: new Set(), runs: new Set(), last: h };
        g.tests.add(r.key);
        g.runs.add(h.runId);
        if (h.startedAt > g.last.startedAt) g.last = h;
        all.set(sig, g);
      }
    }
    const top = [...all.values()].sort((a, b) => b.runs.size - a.runs.size || b.tests.size - a.tests.size).slice(0, 25);
    render(
      body.querySelector('#all-groups'),
      top.length
        ? html`<div class="table-wrap"><table class="data"><thead><tr><th class="sno">S.No</th><th>Error</th><th class="fit">Tests</th><th class="fit">Runs</th><th class="fit">Last seen</th><th class="fit"></th></tr></thead>
            <tbody>${top.map(
              (g, i) => html`<tr><td class="sno">${i + 1}</td><td><span class="small mono">${g.example}</span></td><td class="fit num">${num(g.tests.size)}</td><td class="fit num">${num(g.runs.size)}</td><td class="fit nowrap">${ago(g.last.startedAt)}</td>
                <td class="fit"><a class="icon-btn tone-primary" href="#/runs/${encodeURIComponent(g.last.runId)}?test=${g.last.index}" data-tip="Open the latest" aria-label="Open the latest failure">${icon('eye')}</a></td></tr>`,
            )}</tbody></table></div>`
        : emptyState({ icon: 'checkCircle', title: 'No failures in the kept runs' }),
    );
  };

  const body = main.querySelector('#ins-body');
  const views = { flaky: flakyTab, slow: slowTab, errors: errorsTab };
  if (!views[tab]) tab = 'flaky';
  const tabCtl = tabs(
    main.querySelector('#ins-tabs'),
    [
      { id: 'flaky', label: 'Unstable', icon: 'alert', count: flakyRows.length, countTone: flakyRows.length ? 'warning' : undefined },
      { id: 'slow', label: 'Slow', icon: 'timer' },
      { id: 'errors', label: 'Same error', icon: 'bug' },
    ],
    tab,
    (id) => {
      tab = id;
      setQuery({ tab: id === 'flaky' ? '' : id });
      views[id](body);
    },
  );
  views[tab](body);
  main.querySelectorAll('#ins-cards [data-action^="tab:"]').forEach((b) => b.addEventListener('click', () => tabCtl.select(b.dataset.action.slice(4))));
  return null;
}

