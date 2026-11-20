// One run in full: every test (filter, sort, open), problems, timeline per worker,
// projects & files, run output, environment & settings, exports.
import { setQuery } from '../app.js';
import { tipRows } from '../charts.js';
import {
  api,
  csvCell,
  debounce,
  download,
  dur,
  forgetRun,
  getRun,
  html,
  icon,
  num,
  pct,
  render,
  STATE,
  when,
} from '../lib.js';
import {
  badge,
  confirmDialog,
  copyText,
  dataTable,
  dropdown,
  emptyState,
  hideTip,
  iconAction,
  loading,
  sectionCard,
  showTip,
  stateBadge,
  statCard,
  statusBar,
  statusLegend,
  tabs,
  tagBadge,
  toast,
} from '../ui.js';
import { goLaunch, rerunOptions, runBadge, runBanner, runTitle } from './common.js';
import { failureMarkdown, openTestDialog } from './test-dialog.js';

const PROBLEM = ['failed', 'timedOut', 'flaky', 'interrupted'];

export async function page(main, { id }, query) {
  render(main, loading());
  let run;
  try {
    run = await getRun(id);
  } catch (e) {
    render(main, emptyState({ icon: 'alert', title: 'Run not found', text: e.message, action: html`<a class="btn btn-primary" href="#/runs">Back to runs</a>` }));
    return null;
  }
  const index = await api.runs().catch(() => []);
  const isLatest = index[0]?.id === run.id;
  const c = run.counts;
  const tests = run.tests.map((t, i) => ({ ...t, i }));
  const problems = tests.filter((t) => PROBLEM.includes(t.state));
  const evidenceCount = (t) => t.results.reduce((s, r) => s + r.attachments.filter((a) => a.file).length, 0);
  const workers = new Set(tests.flatMap((t) => t.results.map((r) => r.parallelIndex))).size;

  render(
    main,
    html`<a class="back-link" href="#/runs">${icon('chevronLeft')}All runs</a>
      <div class="page-head">
        <div style="min-width:0"><h1>${runTitle(run)} ${runBadge(run.status)}</h1><p class="mono small">${run.id}</p></div>
        <div class="actions">
          <button type="button" class="btn btn-outline" data-act="csv">${icon('download')}Tests as CSV</button>
          <a class="btn btn-outline" href="/api/runs/${encodeURIComponent(run.id)}/download">${icon('download')}Full report (JSON)</a>
          ${problems.length ? html`<button type="button" class="btn btn-outline" data-act="copy">${icon('copy')}Copy problems</button>` : ''}
          ${isLatest ? html`<a class="btn btn-outline" href="/html-report/index.html" target="_blank" rel="noopener">${icon('external')}Playwright report</a>` : ''}
          <button type="button" class="btn btn-outline" data-act="delete">${icon('trash')}Delete</button>
          ${problems.length && isLatest ? html`<button type="button" class="btn btn-primary" data-act="rerun-failed">${icon('repeat')}Re-run failed</button>` : ''}
          <button type="button" class="btn btn-primary" data-act="rerun">${icon('play')}Run again</button>
        </div>
      </div>
      <div class="stack">
        ${runBanner(run)}
        <div class="grid grid-stats">
          ${statCard({ tone: 'primary', pattern: 'rings', icon: 'flask', label: 'Tests', value: num(c.total), hint: `${run.projects.length} project${run.projects.length === 1 ? '' : 's'}`, action: 'filter:all' })}
          ${statCard({ tone: 'success', pattern: 'waves', icon: 'checkCircle', label: 'Passed', value: num(c.passed), hint: 'First try', action: 'filter:passed' })}
          ${statCard({ tone: 'danger', pattern: 'stripes', icon: 'xCircle', label: 'Failed', value: num(c.failed + c.timedOut), hint: c.timedOut ? `${num(c.timedOut)} timed out` : 'Need a look', action: 'filter:failed' })}
          ${statCard({ tone: 'warning', pattern: 'dots', icon: 'alert', label: 'Flaky', value: num(c.flaky), hint: 'Passed after a retry', action: 'filter:flaky' })}
          ${statCard({ tone: 'neutral', pattern: 'grid', icon: 'skip', label: 'Skipped', value: num(c.skipped + c.interrupted), hint: 'Not run', action: 'filter:skipped' })}
          ${statCard({ tone: 'violet', pattern: 'sparkles', icon: 'gauge', label: 'Pass rate', value: pct(run.passRate), hint: 'Of tests that ran' })}
          ${statCard({ tone: 'cyan', pattern: 'bars', icon: 'timer', label: 'Run time', value: dur(run.duration), hint: `${dur(tests.reduce((s, t) => s + t.duration, 0))} of test time` })}
          ${statCard({ tone: 'info', pattern: 'bubbles', icon: 'cpu', label: 'Workers', value: num(workers || run.config?.workers), hint: `${num(run.config?.workers)} allowed` })}
        </div>
        <div class="section t-success"><div class="body">${statusBar(c, 'big')}${statusLegend(c)}</div></div>
        <div>
          <div id="run-tabs"></div>
          <div id="run-body"></div>
        </div>
      </div>`,
  );

  const body = main.querySelector('#run-body');
  const state = {
    tab: query.get('tab') ?? 'tests',
    status: query.get('state') ?? 'all',
    project: query.get('project') ?? 'all',
    file: query.get('file') ?? 'all',
    tag: query.get('tag') ?? 'all',
    q: query.get('q') ?? '',
  };
  const syncQuery = (extra = {}) =>
    setQuery({ tab: state.tab === 'tests' ? '' : state.tab, state: state.status === 'all' ? '' : state.status, project: state.project === 'all' ? '' : state.project, file: state.file === 'all' ? '' : state.file, tag: state.tag === 'all' ? '' : state.tag, q: state.q, ...extra });

  // --------------------------------------------------------------- tests tab
  const testsTab = () => {
    if (!tests.length) {
      return render(
        body,
        html`<div class="section t-neutral"><div class="body">${emptyState({
          icon: 'stop',
          title: run.status === 'interrupted' ? 'Stopped before it finished' : 'No tests in this run',
          text: run.status === 'interrupted' ? 'Only the progress counts were kept. Run again for full details of every test.' : 'Nothing matched the chosen filters.',
        })}</div></div>`,
      );
    }
    render(
      body,
      sectionCard({
        tone: 'primary',
        icon: 'flask',
        title: 'Every test in this run',
        description: 'Filter, sort by any column, and click a test for its errors, steps, screenshots and trace.',
        flush: true,
        body: html`<div class="toolbar">
            <label class="field grow">${icon('search')}<span class="sr-only">Search tests</span><input type="search" placeholder="Search by test name, file or error" value="${state.q}" data-search /></label>
            <div data-dd="status"></div><div data-dd="project"></div><div data-dd="file"></div><div data-dd="tag"></div>
          </div><div id="tests-table"></div>`,
      }),
    );
    const maxDur = Math.max(1, ...tests.map((t) => t.duration));
    const filtered = () => {
      const q = state.q.trim().toLowerCase();
      return tests.filter(
        (t) =>
          (state.status === 'all' ||
            t.state === state.status ||
            (state.status === 'failed' && t.state === 'timedOut') ||
            (state.status === 'skipped' && t.state === 'interrupted')) &&
          (state.project === 'all' || t.project === state.project) &&
          (state.file === 'all' || t.file === state.file) &&
          (state.tag === 'all' || t.tags.includes(state.tag)) &&
          (!q ||
            t.fullTitle.toLowerCase().includes(q) ||
            t.file.toLowerCase().includes(q) ||
            t.results.some((r) => r.errors.some((e) => (e.message ?? '').toLowerCase().includes(q)))),
      );
    };
    const table = dataTable(body.querySelector('#tests-table'), {
      rows: filtered(),
      pageSize: 25,
      onRow: (t) => openTest(t.i),
      empty: emptyState({ icon: 'search', title: 'No tests match', text: 'Change the search or filters.' }),
      columns: [
        {
          key: 'name',
          label: 'Test',
          className: 'wide',
          render: (t) => html`<div class="two-line"><strong>${t.fullTitle}</strong><span class="mono">${t.file}:${t.line}</span></div>`,
          sort: (t) => t.fullTitle.toLowerCase(),
        },
        { key: 'project', label: 'Project', className: 'fit', render: (t) => badge(t.project, 'cyan', t.project === 'mobile' ? 'phone' : 'monitor', true), sort: (t) => t.project },
        { key: 'tags', label: 'Tags', className: 'fit', render: (t) => html`<span class="chips" style="gap:4px;flex-wrap:nowrap">${t.tags.map(tagBadge)}</span>` },
        { key: 'state', label: 'Result', className: 'fit', render: (t) => stateBadge(t.state, t.attempts, true), sort: (t) => ['failed', 'timedOut', 'flaky', 'interrupted', 'passed', 'skipped'].indexOf(t.state) },
        {
          key: 'dur',
          label: 'Time',
          className: 'fit',
          render: (t) => html`<div style="display:flex;align-items:center;gap:8px"><span class="meter" style="width:70px"><span style="width:${Math.round((t.duration / maxDur) * 100)}%"></span></span><span class="num nowrap">${dur(t.duration)}</span></div>`,
          sort: (t) => t.duration,
        },
        {
          key: 'evidence',
          label: 'Evidence',
          className: 'fit',
          render: (t) => evidenceIcons(t),
          sort: (t) => evidenceCount(t),
        },
        { key: 'open', label: '', className: 'fit', render: (t) => iconAction(`open:${t.i}`, 'eye', 'View') },
      ],
      sort: { key: 'state', dir: 'asc' },
    });
    const update = () => {
      table.setRows(filtered());
      syncQuery();
    };
    const opts = (list, all) => [{ value: 'all', label: all }, ...list.map((v) => ({ value: v, label: v }))];
    dropdown(body.querySelector('[data-dd="status"]'), {
      options: [
        { value: 'all', label: 'All results', hint: num(c.total) },
        { value: 'passed', label: 'Passed', hint: num(c.passed) },
        { value: 'failed', label: 'Failed', hint: num(c.failed + c.timedOut) },
        { value: 'flaky', label: 'Flaky', hint: num(c.flaky) },
        { value: 'skipped', label: 'Skipped', hint: num(c.skipped + c.interrupted) },
      ],
      value: state.status,
      label: 'Result',
      onChange: (v) => ((state.status = v), update()),
    });
    dropdown(body.querySelector('[data-dd="project"]'), { options: opts([...new Set(tests.map((t) => t.project))], 'All projects'), value: state.project, label: 'Project', onChange: (v) => ((state.project = v), update()) });
    dropdown(body.querySelector('[data-dd="file"]'), { options: opts([...new Set(tests.map((t) => t.file))].sort(), 'All files'), value: state.file, label: 'File', width: '200px', onChange: (v) => ((state.file = v), update()) });
    dropdown(body.querySelector('[data-dd="tag"]'), { options: opts([...new Set(tests.flatMap((t) => t.tags))].sort(), 'All tags'), value: state.tag, label: 'Tag', onChange: (v) => ((state.tag = v), update()) });
    body.querySelector('[data-search]').addEventListener('input', debounce((e) => ((state.q = e.target.value), update())));
    body.querySelector('#tests-table').addEventListener('click', (e) => {
      const b = e.target.closest('[data-action^="open:"]');
      if (b) openTest(Number(b.dataset.action.slice(5)));
    });
  };

  // ------------------------------------------------------------ problems tab
  const problemsTab = () => {
    if (!problems.length) {
      return render(body, html`<div class="section t-success"><div class="body">${emptyState({ icon: 'checkCircle', title: 'No problems in this run', text: 'Nothing failed, timed out or needed a retry.' })}</div></div>`);
    }
    render(
      body,
      html`<div class="stack">${problems.map((t) => {
        const last = t.results.at(-1);
        const err = t.results.flatMap((r) => r.errors)[0];
        const shot = t.results.flatMap((r) => r.attachments).find((a) => a.file && a.contentType.startsWith('image/'));
        const trace = t.results.flatMap((r) => r.attachments).find((a) => a.file && a.name === 'trace');
        return sectionCard({
          tone: t.state === 'flaky' ? 'warning' : 'danger',
          icon: t.state === 'flaky' ? 'alert' : 'xCircle',
          title: t.fullTitle,
          description: html`${t.project} · <span class="mono">${t.file}:${t.line}</span> · ${dur(t.duration)}`,
          aside: stateBadge(t.state, t.attempts, true),
          body: html`<div style="display:grid;gap:16px;grid-template-columns:${shot ? 'minmax(0,1fr) 260px' : '1fr'}" class="problem-grid">
            <div class="stack" style="gap:10px;min-width:0">
              ${err ? html`<pre class="code error" style="max-height:220px">${(err.message ?? '').trim()}</pre>` : html`<p class="muted">Passed on try ${t.attempts}; earlier tries failed.</p>`}
              ${err?.snippet ? html`<details class="more"><summary>Code where it failed</summary><pre class="code">${err.snippet}</pre></details>` : ''}
              <div class="actions">
                <button type="button" class="btn btn-primary btn-sm" data-open="${t.i}">${icon('eye')}All details</button>
                ${trace ? html`<button type="button" class="btn btn-outline btn-sm" data-trace="${trace.file}">${icon('external')}Open trace</button>` : ''}
                <button type="button" class="btn btn-outline btn-sm" data-copy="${t.i}">${icon('copy')}Copy details</button>
                ${last ? html`<span class="muted small">Last try ${when(last.startTime)}</span>` : ''}
              </div>
            </div>
            ${shot ? html`<button type="button" class="thumb" data-open-evidence="${t.i}"><img src="${api.fileUrl(run.id, shot.file)}" alt="Screenshot of the failure" loading="lazy"/><span>Screenshot</span></button>` : ''}
          </div>`,
        });
      })}</div>`,
    );
    body.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => openTest(Number(b.dataset.open))));
    body.querySelectorAll('[data-open-evidence]').forEach((b) => b.addEventListener('click', () => openTest(Number(b.dataset.openEvidence), 'evidence')));
    body.querySelectorAll('[data-copy]').forEach((b) => b.addEventListener('click', () => copyText(failureMarkdown(run, run.tests[Number(b.dataset.copy)]), 'Details copied')));
    body.querySelectorAll('[data-trace]').forEach((b) =>
      b.addEventListener('click', async () => {
        try {
          await api.openTrace(run.id, b.dataset.trace);
          toast('Trace Viewer is opening in a new window');
        } catch (e) {
          toast(e.message, 'danger');
        }
      }),
    );
  };

  // ------------------------------------------------------------ timeline tab
  const timelineTab = () => {
    const attempts = tests.flatMap((t) => t.results.map((r) => ({ t, r })));
    if (!attempts.length) return render(body, emptyState({ icon: 'timer', title: 'Nothing ran' }));
    const start = Math.min(...attempts.map((a) => new Date(a.r.startTime).getTime()));
    const end = Math.max(...attempts.map((a) => new Date(a.r.startTime).getTime() + a.r.duration));
    const span = Math.max(1, end - start);
    const lanes = [...new Set(attempts.map((a) => a.r.parallelIndex))].sort((a, b) => a - b);
    const ticks = 6;
    const barState = (a) => (a.r.status === 'passed' ? (a.t.state === 'flaky' ? 'flaky' : 'passed') : a.r.status === 'skipped' ? 'skipped' : 'failed');
    render(
      body,
      sectionCard({
        tone: 'cyan',
        icon: 'timer',
        title: 'Timeline',
        description: 'When each test ran on each worker slot. Hover for details; click to open. Gaps are sign-in and setup time.',
        body: html`<div class="timeline"><div class="tl-inner">
            <div class="tl-axis"><span></span><div class="ticks">${Array.from({ length: ticks + 1 }, (_, i) => html`<span style="left:${(i / ticks) * 100}%">${dur((span * i) / ticks)}</span>`)}</div></div>
            ${lanes.map(
              (lane) => html`<div class="tl-lane"><span class="name">Worker slot ${lane + 1}</span><div class="tl-track">${attempts
                .map((a, k) => ({ a, k }))
                .filter(({ a }) => a.r.parallelIndex === lane)
                .map(
                  ({ a, k }) => html`<span class="tl-bar c-${barState(a)}" data-k="${k}" style="left:${((new Date(a.r.startTime) - start) / span) * 100}%;width:${(a.r.duration / span) * 100}%"></span>`,
                )}</div></div>`,
            )}
          </div></div>
          <div class="legend">${['passed', 'flaky', 'failed', 'skipped'].map((k) => html`<span><i class="c-${k}"></i>${STATE[k].label}</span>`)}</div>`,
      }),
    );
    body.querySelectorAll('.tl-bar').forEach((bar) => {
      const a = attempts[Number(bar.dataset.k)];
      bar.addEventListener('mousemove', (e) =>
        showTip(
          tipRows(a.t.fullTitle, [
            ['Project', a.t.project],
            ['Try', String(a.r.retry + 1)],
            ['Result', STATE[a.r.status]?.label ?? a.r.status],
            ['Started', `+${dur(new Date(a.r.startTime) - start)}`],
            ['Took', dur(a.r.duration)],
          ]),
          e.clientX,
          e.clientY,
        ),
      );
      bar.addEventListener('mouseleave', hideTip);
      bar.addEventListener('click', () => openTest(a.t.i));
    });
  };

  // ----------------------------------------------------------- breakdown tab
  const breakdownTab = () => {
    const group = (keyOf) => {
      const map = new Map();
      for (const t of tests) {
        const k = keyOf(t);
        const g = map.get(k) ?? { key: k, total: 0, passed: 0, failed: 0, flaky: 0, skipped: 0, timedOut: 0, interrupted: 0, duration: 0 };
        g.total++;
        g[t.state]++;
        g.duration += t.duration;
        map.set(k, g);
      }
      return [...map.values()];
    };
    const tagRows = [...new Set(tests.flatMap((t) => t.tags))].map((tag) => {
      const g = { key: tag, total: 0, passed: 0, failed: 0, flaky: 0, skipped: 0, timedOut: 0, interrupted: 0, duration: 0 };
      for (const t of tests.filter((x) => x.tags.includes(tag))) {
        g.total++;
        g[t.state]++;
        g.duration += t.duration;
      }
      return g;
    });
    const tableHtml = (rows, label, filterKey) => html`<div class="table-wrap"><table class="data">
      <thead><tr><th class="sno">S.No</th><th>${label}</th><th>Results</th><th class="fit">Tests</th><th class="fit">Failed</th><th class="fit">Flaky</th><th class="fit">Time</th><th class="fit"></th></tr></thead>
      <tbody>${rows.map(
        (g, i) => html`<tr><td class="sno">${i + 1}</td><td><strong class="${filterKey === 'file' ? 'mono' : ''}">${g.key}</strong></td><td style="min-width:140px">${statusBar(g, 'thin')}</td>
          <td class="fit num">${num(g.total)}</td><td class="fit num">${num(g.failed + g.timedOut)}</td><td class="fit num">${num(g.flaky)}</td><td class="fit num">${dur(g.duration)}</td>
          <td class="fit">${iconAction(`only:${filterKey}:${g.key}`, 'eye', 'Show tests')}</td></tr>`,
      )}</tbody></table></div>`;
    render(
      body,
      html`<div class="stack">
        ${sectionCard({ tone: 'cyan', icon: 'monitor', title: 'By project', description: 'Desktop, phone and pages without sign-in.', flush: true, body: tableHtml(group((t) => t.project), 'Project', 'project') })}
        ${sectionCard({ tone: 'violet', icon: 'folder', title: 'By file', flush: true, body: tableHtml(group((t) => t.file), 'File', 'file') })}
        ${tagRows.length ? sectionCard({ tone: 'warning', icon: 'tag', title: 'By tag', flush: true, body: tableHtml(tagRows, 'Tag', 'tag') }) : ''}
      </div>`,
    );
    body.querySelectorAll('[data-action^="only:"]').forEach((b) =>
      b.addEventListener('click', () => {
        const [, key, ...rest] = b.dataset.action.split(':');
        state.project = state.file = state.tag = 'all';
        state.status = 'all';
        state[key] = rest.join(':');
        switchTab('tests');
      }),
    );
  };

  // -------------------------------------------------------------- output tab
  const outputTab = () => {
    render(
      body,
      html`<div class="stack">
        ${sectionCard({
          tone: 'danger',
          icon: 'bug',
          title: 'Errors outside tests',
          description: 'Problems in setup or teardown that no single test owns.',
          body: run.globalErrors.length
            ? html`<div class="stack" style="gap:10px">${run.globalErrors.map(
                (e) => html`<div><pre class="code error">${(e.message ?? '').trim()}</pre>${e.stack ? html`<details class="more"><summary>Stack trace</summary><pre class="code">${e.stack}</pre></details>` : ''}</div>`,
              )}</div>`
            : emptyState({ icon: 'checkCircle', title: 'None', text: 'No errors outside the tests.' }),
        })}
        ${sectionCard({
          tone: 'info',
          icon: 'terminal',
          title: 'Console output outside tests',
          aside: run.globalOutput ? html`<button type="button" class="btn btn-outline btn-sm" data-copy-out>${icon('copy')}Copy</button>` : '',
          body: run.globalOutput ? html`<pre class="code">${run.globalOutput}</pre>` : emptyState({ icon: 'terminal', title: 'Nothing printed' }),
        })}
        ${sectionCard({
          tone: 'violet',
          icon: 'message',
          title: 'Printed by tests',
          description: 'Everything tests wrote with console.log or to errors.',
          flush: true,
          body: (() => {
            const printed = tests.filter((t) => t.results.some((r) => r.stdout || r.stderr));
            return printed.length
              ? html`<ul class="list">${printed.map((t) => html`<li><button type="button" class="list-row" data-open-out="${t.i}"><span class="grow truncate">${t.fullTitle}</span><span class="muted small">${t.project}</span>${icon('chevronRight')}</button></li>`)}</ul>`
              : emptyState({ icon: 'terminal', title: 'No test printed anything' });
          })(),
        })}
      </div>`,
    );
    body.querySelector('[data-copy-out]')?.addEventListener('click', () => copyText(run.globalOutput, 'Output copied'));
    body.querySelectorAll('[data-open-out]').forEach((b) => b.addEventListener('click', () => openTest(Number(b.dataset.openOut), 'output')));
  };

  // --------------------------------------------------------- environment tab
  const environmentTab = () => {
    const e = run.environment ?? {};
    const cfg = run.config ?? {};
    const kv = (rows) => html`<div class="kv">${rows.map(([k, v]) => html`<div>${k}</div><div>${v ?? '—'}</div>`)}</div>`;
    render(
      body,
      html`<div class="stack">
        <div class="grid grid-2">
          ${sectionCard({ tone: 'primary', icon: 'globe', title: 'What was tested', body: kv([['App address', e.baseURL], ['Test account', e.account], ['Command', html`<span class="mono">${e.command}</span>`], ['Started from', run.trigger === 'dashboard' ? 'Dashboard' : 'Command line'], ['Label', run.label]]) })}
          ${sectionCard({ tone: 'violet', icon: 'branch', title: 'Code', body: kv([['Branch', run.branch], ['Commit', run.commit ? html`<span class="mono">${run.commit}</span>` : null], ['Last commit message', e.gitMessage], ['Uncommitted files', num(e.gitDirty)]]) })}
          ${sectionCard({ tone: 'cyan', icon: 'cpu', title: 'Machine', body: kv([['Playwright', e.playwright], ['Node.js', e.node], ['System', e.os], ['Computer', e.host], ['CPU cores', num(e.cpus)], ['Memory', e.memoryGb ? `${e.memoryGb} GB` : null], ['CI', e.ci ? 'Yes' : 'No']]) })}
          ${sectionCard({ tone: 'warning', icon: 'settings', title: 'Run settings', body: kv([['Workers', num(cfg.workers)], ['Fully parallel', cfg.fullyParallel ? 'Yes' : 'No'], ['Stop after failures', cfg.maxFailures ? num(cfg.maxFailures) : 'Never'], ['Time limit for the run', cfg.globalTimeout ? dur(cfg.globalTimeout) : 'None'], ['Filter', cfg.grep], ['Shard', cfg.shard ? `${cfg.shard.current} of ${cfg.shard.total}` : 'None'], ['Reporters', (cfg.reporters ?? []).join(', ')]]) })}
        </div>
        ${sectionCard({
          tone: 'info',
          icon: 'layers',
          title: 'Projects',
          flush: true,
          body: html`<div class="table-wrap"><table class="data"><thead><tr><th class="sno">S.No</th><th>Project</th><th>Browser</th><th>Screen</th><th class="fit">Time limit</th><th class="fit">Retries</th><th>Trace</th><th>Screenshot</th><th>Video</th><th>Filter</th></tr></thead>
            <tbody>${(cfg.projects ?? []).map(
              (p, i) => html`<tr><td class="sno">${i + 1}</td><td><strong>${p.name}</strong></td><td>${p.browser}${p.isMobile ? ' (phone)' : ''}</td><td>${p.viewport ?? '—'}</td><td class="fit">${dur(p.timeout)}</td><td class="fit">${num(p.retries)}</td><td>${p.trace ?? '—'}</td><td>${p.screenshot ?? '—'}</td><td>${p.video ?? '—'}</td><td class="mono small">${p.grep}</td></tr>`,
            )}</tbody></table></div>`,
        })}
      </div>`,
    );
  };

  // --------------------------------------------------------------- plumbing
  const views = { tests: testsTab, problems: problemsTab, timeline: timelineTab, breakdown: breakdownTab, output: outputTab, environment: environmentTab };
  if (!views[state.tab]) state.tab = 'tests';
  const tabItems = [
    { id: 'tests', label: 'Tests', icon: 'flask', count: c.total },
    { id: 'problems', label: 'Problems', icon: 'bug', count: problems.length, countTone: problems.length ? 'danger' : undefined },
    { id: 'timeline', label: 'Timeline', icon: 'timer' },
    { id: 'breakdown', label: 'Projects & files', icon: 'folder' },
    { id: 'output', label: 'Run output', icon: 'terminal', count: run.globalErrors.length || undefined, countTone: 'danger' },
    { id: 'environment', label: 'Environment', icon: 'cpu' },
  ];
  const tabCtl = tabs(main.querySelector('#run-tabs'), tabItems, state.tab, (tabId) => {
    state.tab = tabId;
    syncQuery();
    views[tabId]();
  });
  const switchTab = (tabId) => tabCtl.select(tabId);
  views[state.tab]();

  let dialog = null;
  function openTest(i, startTab) {
    dialog?.close();
    syncQuery({ test: String(i) });
    dialog = openTestDialog(run, i, {
      startTab,
      onClose: () => {
        dialog = null;
        syncQuery();
      },
    });
  }
  if (query.get('test') !== null && query.get('test') !== '') openTest(Number(query.get('test')));

  main.querySelectorAll('[data-action^="filter:"]').forEach((b) =>
    b.addEventListener('click', () => {
      state.status = b.dataset.action.slice(7);
      state.project = state.file = state.tag = 'all';
      state.q = '';
      switchTab('tests');
      main.querySelector('#run-tabs').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }),
  );
  main.querySelector('[data-act="csv"]').addEventListener('click', () => {
    const header = ['S.No', 'Test', 'Describe', 'Project', 'File', 'Line', 'Tags', 'Result', 'Tries', 'Duration (ms)', 'Error'];
    const rows = tests.map((t, i) => [i + 1, t.title, t.describe.join(' › '), t.project, t.file, t.line, t.tags.join(' '), STATE[t.state]?.label ?? t.state, t.attempts, t.duration, (t.results.at(-1)?.errors?.[0]?.message ?? '').split('\n')[0]]);
    // BOM so Excel reads it as UTF-8.
    download(`playwright-tests-${run.id}.csv`, String.fromCharCode(0xfeff) + [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n'), 'text/csv');
  });
  main.querySelector('[data-act="copy"]')?.addEventListener('click', () =>
    copyText([`## Playwright run ${when(run.startedAt)}: ${num(problems.length)} problem(s)`, '', ...problems.map((t) => failureMarkdown(run, t))].join('\n\n'), 'Problems copied'),
  );
  main.querySelector('[data-act="rerun"]').addEventListener('click', () => goLaunch(rerunOptions(run)));
  main.querySelector('[data-act="rerun-failed"]')?.addEventListener('click', () => goLaunch({ ...rerunOptions(run), lastFailed: true, label: 'Re-run failed tests' }));
  main.querySelector('[data-act="delete"]').addEventListener('click', async () => {
    if (!(await confirmDialog({ title: 'Delete this run?', text: 'The run and its screenshots, videos and traces will be removed from this machine.', confirmLabel: 'Delete run' }))) return;
    try {
      await api.deleteRun(run.id);
      forgetRun(run.id);
      toast('Run deleted');
      location.hash = '#/runs';
    } catch (e) {
      toast(e.message, 'danger');
    }
  });

  return {
    onQuery: (q) => {
      const t = q.get('test');
      if (t !== null && t !== '' && !dialog) openTest(Number(t));
    },
    dispose: () => dialog?.close(),
  };
}

function evidenceIcons(t) {
  const all = t.results.flatMap((r) => r.attachments.filter((a) => a.file));
  const count = (fn) => all.filter(fn).length;
  const items = [
    ['image', count((a) => a.contentType.startsWith('image/')), 'Screenshots'],
    ['video', count((a) => a.contentType.startsWith('video/')), 'Videos'],
    ['zip', count((a) => a.name === 'trace'), 'Traces'],
    ['message', count((a) => a.name === 'console'), 'Console messages'],
    ['network', count((a) => a.name === 'api-failures'), 'Failed API calls'],
  ].filter(([, n]) => n > 0);
  if (!items.length) return html`<span class="muted">—</span>`;
  return html`<span class="evidence-icons">${items.map(([ic, n, label]) => html`<span data-tip="${`${label}: ${n}`}">${icon(ic)}${n > 1 ? n : ''}</span>`)}</span>`;
}

