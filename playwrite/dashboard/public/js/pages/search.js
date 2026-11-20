// Search every kept run by test name, file or error text.
import { setQuery } from '../app.js';
import { ago, api, debounce, html, icon, num, render, when } from '../lib.js';
import { dataTable, dropdown, emptyState, sectionCard, stateBadge } from '../ui.js';

export async function page(main, _params, query) {
  const state = { q: query.get('q') ?? '', status: query.get('state') ?? 'all' };
  render(
    main,
    html`<div class="page-head"><div><h1>Search</h1><p>Find a test or an error message in every kept run, e.g. "Role key", "timeout" or a file name.</p></div></div>
      ${sectionCard({
        tone: 'primary',
        icon: 'search',
        title: 'Search all runs',
        flush: true,
        body: html`<div class="toolbar">
            <label class="field grow">${icon('search')}<span class="sr-only">Search</span><input type="search" placeholder="Enter a test name, file or error text (2+ letters)" value="${state.q}" data-q autofocus/></label>
            <div data-dd="state"></div>
          </div>
          <div id="summary" class="small muted" style="padding:10px 16px 0"></div>
          <div id="results"></div>`,
      })}`,
  );

  const table = dataTable(main.querySelector('#results'), {
    rows: [],
    pageSize: 25,
    onRow: (h) => (location.hash = `#/runs/${encodeURIComponent(h.runId)}?test=${h.index}`),
    empty: emptyState({ icon: 'search', title: state.q.length < 2 ? 'Type to search' : 'Nothing found', text: 'Searches test names, files and error messages.' }),
    columns: [
      { key: 'test', label: 'Test', className: 'wide', render: (h) => html`<div class="two-line"><strong>${h.title}</strong><span class="mono">${h.project} · ${h.file}:${h.line}</span>${h.snippet && h.where === 'error' ? html`<span class="small" style="white-space:normal">…${h.snippet}…</span>` : ''}</div>`, sort: (h) => h.title },
      { key: 'where', label: 'Found in', className: 'fit', render: (h) => ({ name: 'Name', file: 'File', error: 'Error' })[h.where] },
      { key: 'state', label: 'Result', className: 'fit', render: (h) => stateBadge(h.state, 1, true), sort: (h) => h.state },
      { key: 'run', label: 'Run', className: 'fit nowrap', render: (h) => html`<span data-tip="${when(h.startedAt)}">${h.runLabel || ago(h.startedAt)}</span>`, sort: (h) => h.startedAt },
    ],
    sort: { key: 'run', dir: 'desc' },
  });

  const go = async () => {
    setQuery({ q: state.q, state: state.status === 'all' ? '' : state.status });
    const summary = main.querySelector('#summary');
    if (state.q.trim().length < 2) {
      summary.textContent = '';
      return table.setRows([]);
    }
    summary.textContent = 'Searching…';
    try {
      const r = await api.search(state.q, state.status);
      table.setRows(r.hits);
      summary.textContent = `${num(r.hits.length)}${r.truncated ? '+' : ''} result${r.hits.length === 1 ? '' : 's'} in ${num(r.runsSearched)} runs`;
    } catch (e) {
      summary.textContent = e.message;
    }
  };
  dropdown(main.querySelector('[data-dd="state"]'), {
    options: [
      { value: 'all', label: 'Any result' },
      { value: 'failed', label: 'Failed' },
      { value: 'flaky', label: 'Flaky' },
      { value: 'passed', label: 'Passed' },
      { value: 'skipped', label: 'Skipped' },
    ],
    value: state.status,
    label: 'Result',
    onChange: (v) => ((state.status = v), go()),
  });
  main.querySelector('[data-q]').addEventListener('input', debounce((e) => ((state.q = e.target.value), go()), 300));
  main.querySelector('[data-q]').focus();
  if (state.q) go();
  return null;
}
