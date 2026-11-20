// Runs: every kept run, with filters, and view / download / delete.
import { ago, api, debounce, dur, forgetRun, html, icon, num, pct, render, when } from '../lib.js';
import {
  confirmDialog,
  dataTable,
  dropdown,
  emptyState,
  iconAction,
  loading,
  refreshButton,
  sectionCard,
  spinWhile,
  statCard,
  statusBar,
  toast,
} from '../ui.js';
import { runBadge, runTitle, triggerBadge } from './common.js';

export async function page(main) {
  render(main, loading());
  let runs = [];
  const filters = { search: '', status: 'all', trigger: 'all' };

  const load = async () => {
    runs = await api.runs();
  };
  await load().catch((e) => toast(e.message, 'danger'));

  render(
    main,
    html`<div class="page-head">
        <div><h1>Runs</h1><p>Every Playwright run kept on this machine, newest first. Open one for every test, error, screenshot and trace.</p></div>
        <div class="actions">
          <button type="button" class="btn btn-outline" data-action="clear">${icon('trash')}Clear history</button>
          <a class="btn btn-primary" href="#/launch">${icon('play')}Run tests</a>
        </div>
      </div>
      <div class="stack">
        <div class="grid grid-stats" id="cards"></div>
        ${sectionCard({
          tone: 'primary',
          icon: 'history',
          title: 'Run history',
          description: 'Click a row to open it.',
          flush: true,
          body: html`<div class="toolbar">
              <label class="field grow">${icon('search')}<span class="sr-only">Search runs</span><input type="search" placeholder="Search by label, branch, commit or date" data-search /></label>
              <div data-dd="status"></div>
              <div data-dd="trigger"></div>
              ${refreshButton()}
            </div>
            <div id="table"></div>`,
        })}
      </div>`,
  );

  const drawCards = () => {
    const passed = runs.filter((r) => r.status === 'passed').length;
    const rates = runs.map((r) => r.passRate).filter((v) => v !== null && v !== undefined);
    const avgDur = runs.length ? runs.reduce((s, r) => s + r.duration, 0) / runs.length : null;
    const avgRate = rates.length ? rates.reduce((s, v) => s + v, 0) / rates.length : null;
    let streak = 0;
    for (const r of runs) {
      if (r.status !== 'passed') break;
      streak++;
    }
    render(
      main.querySelector('#cards'),
      html`${statCard({ tone: 'primary', pattern: 'rings', icon: 'history', label: 'Runs kept', value: num(runs.length), hint: runs[0] ? `Last ${ago(runs[0].startedAt)}` : 'None yet' })}
        ${statCard({ tone: 'success', pattern: 'waves', icon: 'checkCircle', label: 'Green runs', value: num(passed), hint: `${num(runs.length - passed)} with failures` })}
        ${statCard({ tone: 'violet', pattern: 'sparkles', icon: 'gauge', label: 'Average pass rate', value: pct(avgRate), hint: 'Across kept runs' })}
        ${statCard({ tone: 'cyan', pattern: 'bars', icon: 'timer', label: 'Average run time', value: dur(avgDur), hint: 'Per run' })}
        ${statCard({ tone: 'warning', pattern: 'dots', icon: 'zap', label: 'Green streak', value: num(streak), hint: 'Passing runs in a row' })}`,
    );
  };

  const filtered = () => {
    const q = filters.search.trim().toLowerCase();
    return runs.filter(
      (r) =>
        (filters.status === 'all' || r.status === filters.status) &&
        (filters.trigger === 'all' || r.trigger === filters.trigger) &&
        (!q || [r.label, r.branch, r.commit, r.id, when(r.startedAt)].some((v) => String(v ?? '').toLowerCase().includes(q))),
    );
  };

  const table = dataTable(main.querySelector('#table'), {
    rows: [],
    pageSize: 15,
    onRow: (r) => (location.hash = `#/runs/${encodeURIComponent(r.id)}`),
    empty: emptyState({ icon: 'history', title: 'No runs match', text: 'Change the filters, or start a run.' }),
    columns: [
      {
        key: 'run',
        label: 'Run',
        render: (r) => html`<div class="two-line"><strong>${runTitle(r)}</strong><span>${ago(r.startedAt)} · ${triggerBadge(r)}</span></div>`,
        sort: (r) => r.startedAt,
      },
      { key: 'status', label: 'Result', className: 'fit', render: (r) => runBadge(r.status, true), sort: (r) => r.status },
      {
        key: 'tests',
        label: 'Tests',
        render: (r) => html`<div style="min-width:140px">${statusBar(r.counts, 'thin')}<div class="small muted" style="margin-top:4px">${num(r.counts.passed)} passed · ${num(r.counts.failed + r.counts.timedOut)} failed · ${num(r.counts.flaky)} flaky · ${num(r.counts.skipped)} skipped</div></div>`,
        sort: (r) => r.counts.total,
      },
      { key: 'rate', label: 'Pass rate', className: 'fit num', render: (r) => pct(r.passRate), sort: (r) => r.passRate },
      { key: 'dur', label: 'Time', className: 'fit num', render: (r) => dur(r.duration), sort: (r) => r.duration },
      { key: 'projects', label: 'Projects', className: 'fit', render: (r) => (r.projects ?? []).join(', ') },
      {
        key: 'git',
        label: 'Code',
        className: 'fit',
        render: (r) => (r.branch ? html`<div class="two-line"><strong class="mono">${r.branch}</strong><span class="mono">${r.commit ?? ''}</span></div>` : '—'),
      },
      {
        key: 'actions',
        label: '',
        className: 'fit',
        render: (r) => html`<div class="row-actions">
          ${iconAction(`view:${r.id}`, 'eye', 'View')}
          <a class="icon-btn tone-success" href="/api/runs/${encodeURIComponent(r.id)}/download" data-tip="Download" aria-label="Download run as JSON">${icon('download')}</a>
          ${iconAction(`delete:${r.id}`, 'trash', 'Delete', 'danger')}
        </div>`,
      },
    ],
    sort: { key: 'run', dir: 'desc' },
  });

  const refreshTable = (reset = true) => {
    drawCards();
    table.setRows(filtered(), reset);
  };
  refreshTable();

  const statusOptions = [
    { value: 'all', label: 'All results' },
    { value: 'passed', label: 'Passed' },
    { value: 'failed', label: 'Failed' },
    { value: 'timedout', label: 'Timed out' },
    { value: 'interrupted', label: 'Interrupted' },
  ];
  dropdown(main.querySelector('[data-dd="status"]'), { options: statusOptions, value: 'all', label: 'Result', onChange: (v) => ((filters.status = v), refreshTable()) });
  dropdown(main.querySelector('[data-dd="trigger"]'), {
    options: [
      { value: 'all', label: 'Started from anywhere' },
      { value: 'dashboard', label: 'Dashboard' },
      { value: 'command line', label: 'Command line' },
    ],
    value: 'all',
    label: 'Started from',
    width: '200px',
    onChange: (v) => ((filters.trigger = v), refreshTable()),
  });
  main.querySelector('[data-search]').addEventListener('input', debounce((e) => ((filters.search = e.target.value), refreshTable())));

  const refreshBtn = main.querySelector('[data-action="refresh"]');
  refreshBtn.addEventListener('click', () => spinWhile(refreshBtn, async () => (await load(), refreshTable(false))));

  const ac = new AbortController();
  main.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-action]');
    if (!b) return;
    const [act, id] = b.dataset.action.split(/:(.*)/s);
    if (act === 'view') location.hash = `#/runs/${encodeURIComponent(id)}`;
    if (act === 'delete') {
      const run = runs.find((r) => r.id === id);
      if (!(await confirmDialog({ title: 'Delete this run?', text: `"${runTitle(run)}" and its screenshots, videos and traces will be removed from this machine.`, confirmLabel: 'Delete run' }))) return;
      try {
        await api.deleteRun(id);
        forgetRun(id);
        runs = runs.filter((r) => r.id !== id);
        refreshTable(false);
        toast('Run deleted');
      } catch (err) {
        toast(err.message, 'danger');
      }
    }
    if (act === 'clear') {
      if (!runs.length) return toast('Nothing to clear', 'warning');
      if (!(await confirmDialog({ title: 'Clear all history?', text: `All ${runs.length} kept runs and their evidence will be removed from this machine. This can't be undone.`, confirmLabel: 'Clear history' }))) return;
      try {
        await api.clearRuns();
        forgetRun();
        runs = [];
        refreshTable();
        toast('History cleared');
      } catch (err) {
        toast(err.message, 'danger');
      }
    }
  }, { signal: ac.signal });
  return () => ac.abort();
}
