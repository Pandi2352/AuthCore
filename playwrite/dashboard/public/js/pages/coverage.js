// Coverage: which app pages the tests opened and which API endpoints they called.
import { setQuery } from '../app.js';
import { api, debounce, html, icon, num, render, when } from '../lib.js';
import { badge, dataTable, dropdown, emptyState, loading, openDialog, sectionCard, tabs } from '../ui.js';
import { runTitle } from './common.js';

export async function page(main, _params, query) {
  render(main, loading());
  const runs = await api.runs().catch(() => []);
  let runId = query.get('run') ?? 'latest';
  let tab = query.get('tab') ?? 'pages';
  let data = null;

  render(
    main,
    html`<div class="page-head">
        <div><h1>Coverage</h1><p>Which pages of the app the tests open and which API endpoints they call, so you can see what still has no test.</p></div>
        <div class="actions"><div data-dd="run"></div></div>
      </div>
      <div class="stack" id="cov"></div>`,
  );
  dropdown(main.querySelector('[data-dd="run"]'), {
    options: [{ value: 'latest', label: 'Latest run' }, { value: 'all', label: 'All kept runs together' }, ...runs.map((r) => ({ value: r.id, label: runTitle(r) }))],
    value: runId,
    label: 'Which runs',
    width: '260px',
    onChange: (v) => {
      runId = v;
      setQuery({ run: v === 'latest' ? '' : v, tab: tab === 'pages' ? '' : tab });
      load();
    },
  });

  const load = async () => {
    const box = main.querySelector('#cov');
    render(box, loading('Matching against the app and the API…'));
    try {
      data = await api.coverage(runId === 'latest' ? undefined : runId);
    } catch (e) {
      return render(box, emptyState({ icon: 'alert', title: 'Could not work out coverage', text: e.message }));
    }
    draw();
  };

  const draw = () => {
    const box = main.querySelector('#cov');
    const required = data.pages.filter((p) => !p.optional);
    const pagesOn = required.filter((p) => p.covered).length;
    const apiOn = data.api.filter((a) => a.covered).length;
    const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
    render(
      box,
      html`${!data.recorded
          ? html`<div class="callout t-warning">${icon('alert')}<div><strong>No coverage recorded in ${runId === 'all' ? 'the kept runs' : 'this run'} yet</strong><div>Tests record the pages and API calls they touch from now on. Run the tests once and come back.</div></div></div>`
          : ''}
        ${!data.spec ? html`<div class="callout t-warning">${icon('server')}<div><strong>No API list</strong><div>Start the test environment (or your dev backend) once so the dashboard can read the API's endpoint list. It is saved for later.</div></div></div>` : ''}
        <div class="grid grid-2">
          <div class="section t-success"><div class="body ring-row">
            <div class="ring" style="--p:${pct(pagesOn, required.length)}"><span>${pct(pagesOn, required.length)}%</span></div>
            <div><h2 style="font-size:16px">App pages</h2><p class="muted">${num(pagesOn)} of ${num(required.length)} pages opened by a test${data.pages.length > required.length ? ` (${num(data.pages.length - required.length)} redirect-only or dev pages not counted)` : ''}.</p></div>
          </div></div>
          <div class="section t-info"><div class="body ring-row">
            <div class="ring" style="--p:${pct(apiOn, data.api.length)}"><span>${pct(apiOn, data.api.length)}%</span></div>
            <div><h2 style="font-size:16px">API endpoints</h2><p class="muted">${num(apiOn)} of ${num(data.api.length)} endpoints called by a test.${data.spec ? ` Endpoint list from ${data.spec.source.includes(':3998') ? 'the test environment' : 'the dev backend'}, ${when(data.spec.fetchedAt)}.` : ''}</p></div>
          </div></div>
        </div>
        <div><div id="cov-tabs"></div><div id="cov-body"></div></div>`,
    );
    const body = box.querySelector('#cov-body');
    const views = { pages: pagesTab, api: apiTab, other: otherTab };
    if (!views[tab]) tab = 'pages';
    tabs(
      box.querySelector('#cov-tabs'),
      [
        { id: 'pages', label: 'Pages', icon: 'monitor', count: required.length - pagesOn, countTone: required.length - pagesOn ? 'warning' : undefined },
        { id: 'api', label: 'API endpoints', icon: 'server', count: data.api.length - apiOn, countTone: data.api.length - apiOn ? 'warning' : undefined },
        { id: 'other', label: 'Not in the lists', icon: 'search', count: data.otherPages.length + data.otherCalls.length },
      ],
      tab,
      (id) => {
        tab = id;
        setQuery({ run: runId === 'latest' ? '' : runId, tab: id === 'pages' ? '' : id });
        views[id](body);
      },
    );
    views[tab](body);
  };

  const testsDialog = (title, tests, extra) =>
    openDialog({
      title,
      width: 720,
      body: html`${extra ?? ''}${tests.length
        ? html`<ul class="list">${tests.map(
            (t) => html`<li><a class="list-row" href="#/runs/${encodeURIComponent(t.runId)}?test=${t.index}"><span class="grow truncate">${t.title}</span><span class="muted small">${t.project}</span>${icon('chevronRight')}</a></li>`,
          )}</ul>`
        : emptyState({ icon: 'flask', title: 'No test reaches this yet' })}`,
    });

  const pagesTab = (body) => {
    const sections = [...new Set(data.pages.map((p) => p.section))].sort((a, b) => (a === 'other') - (b === 'other') || a.localeCompare(b));
    render(
      body,
      html`<div class="stack">${sections.map((s) => {
        const items = data.pages.filter((p) => p.section === s);
        return sectionCard({
          tone: items.every((p) => p.covered || p.optional) ? 'success' : 'warning',
          icon: 'folder',
          title: s === 'other' ? 'Sign-in, account and other pages' : `/${s}`,
          description: `${num(items.filter((p) => p.covered).length)} of ${num(items.length)} opened by a test`,
          body: html`<div class="cov-grid">${items.map(
            (p) => html`<button type="button" class="cov-item ${p.covered ? 'on' : ''}" data-page="${p.path}">
              ${p.covered ? icon('checkCircle') : icon(p.optional ? 'skip' : 'xCircle')}
              <span class="grow"><span class="mono">${p.path}</span><span class="muted small">${p.optional ? 'Redirect / dev page' : p.covered ? `${num(p.tests.length)} test${p.tests.length === 1 ? '' : 's'}` : 'No test opens it'}</span></span>
            </button>`,
          )}</div>`,
        });
      })}</div>`,
    );
    body.querySelectorAll('[data-page]').forEach((b) =>
      b.addEventListener('click', () => {
        const p = data.pages.find((x) => x.path === b.dataset.page);
        testsDialog(p.path, p.tests, p.urls.length ? html`<p class="small muted" style="margin-bottom:10px">Opened as: <span class="mono">${p.urls.join(', ')}</span></p>` : '');
      }),
    );
  };

  const apiTab = (body) => {
    const f = { q: '', show: 'all', tag: 'all' };
    render(
      body,
      sectionCard({
        tone: 'info',
        icon: 'server',
        title: 'API endpoints',
        description: 'Called by the app during a test or by a test directly (set-up and clean-up). Click a row for the tests.',
        flush: true,
        body: html`<div class="toolbar">
            <label class="field grow">${icon('search')}<span class="sr-only">Search endpoints</span><input type="search" placeholder="Search path or summary" data-q/></label>
            <div data-dd="show"></div><div data-dd="tag"></div>
          </div><div id="api-table"></div>`,
      }),
    );
    const rows = () => {
      const q = f.q.toLowerCase();
      return data.api.filter((a) => (f.show === 'all' || (f.show === 'on') === a.covered) && (f.tag === 'all' || a.tag === f.tag) && (!q || `${a.path} ${a.summary}`.toLowerCase().includes(q)));
    };
    const table = dataTable(body.querySelector('#api-table'), {
      rows: rows(),
      pageSize: 30,
      onRow: (a) => testsDialog(`${a.method} ${a.path}`, a.tests, a.examples.length ? html`<p class="small muted" style="margin-bottom:10px">Called as: <span class="mono">${a.examples.join(', ')}</span></p>` : ''),
      columns: [
        { key: 'm', label: 'Method', className: 'fit', render: (a) => html`<span class="method ${a.method}">${a.method}</span>`, sort: (a) => a.method },
        { key: 'path', label: 'Endpoint', className: 'wide', render: (a) => html`<div class="two-line"><strong class="mono">${a.path}</strong><span>${a.summary}</span></div>`, sort: (a) => a.path },
        { key: 'tag', label: 'Area', className: 'fit', render: (a) => a.tag, sort: (a) => a.tag },
        { key: 'cov', label: 'Covered', className: 'fit', render: (a) => (a.covered ? badge('Yes', 'success', 'check', true) : badge('No', 'neutral', 'x', true)), sort: (a) => (a.covered ? 1 : 0) },
        { key: 'calls', label: 'Calls', className: 'fit num', render: (a) => num(a.count), sort: (a) => a.count },
        { key: 'status', label: 'Answers', className: 'fit', render: (a) => html`<span class="chips" style="gap:4px;flex-wrap:nowrap">${Object.entries(a.statuses).map(([s, n]) => badge(`${s} ×${n}`, s < 300 ? 'success' : s < 400 ? 'info' : s < 500 ? 'warning' : 'danger', null, true))}</span>` },
      ],
      sort: { key: 'cov', dir: 'asc' },
    });
    dropdown(body.querySelector('[data-dd="show"]'), {
      options: [
        { value: 'all', label: 'All endpoints' },
        { value: 'off', label: 'Not covered' },
        { value: 'on', label: 'Covered' },
      ],
      value: f.show,
      label: 'Show',
      onChange: (v) => ((f.show = v), table.setRows(rows())),
    });
    dropdown(body.querySelector('[data-dd="tag"]'), {
      options: [{ value: 'all', label: 'All areas' }, ...[...new Set(data.api.map((a) => a.tag))].sort().map((t) => ({ value: t, label: t, hint: `${data.api.filter((a) => a.tag === t && a.covered).length}/${data.api.filter((a) => a.tag === t).length}` }))],
      value: f.tag,
      label: 'Area',
      width: '200px',
      onChange: (v) => ((f.tag = v), table.setRows(rows())),
    });
    body.querySelector('[data-q]').addEventListener('input', debounce((e) => ((f.q = e.target.value), table.setRows(rows()))));
  };

  const otherTab = (body) => {
    render(
      body,
      html`<div class="grid grid-2" style="align-items:start">
        ${sectionCard({
          tone: 'violet',
          icon: 'monitor',
          title: 'Addresses not in paths.ts',
          description: 'Opened by tests but not a known page (e.g. a page with an id, or an old address).',
          flush: true,
          body: data.otherPages.length
            ? html`<ul class="list">${data.otherPages.map((p) => html`<li class="list-row"><span class="grow mono small truncate">${p.url}</span><span class="count-pill">${num(p.tests.length)}</span></li>`)}</ul>`
            : emptyState({ icon: 'checkCircle', title: 'None' }),
        })}
        ${sectionCard({
          tone: 'warning',
          icon: 'server',
          title: 'Calls not in the API list',
          description: 'Requests to /api that match no documented endpoint.',
          flush: true,
          body: data.otherCalls.length
            ? html`<ul class="list">${data.otherCalls.map((c) => html`<li class="list-row"><span class="grow mono small truncate">${c.key}</span>${Object.keys(c.statuses).map((s) => badge(s, s < 400 ? 'success' : 'danger', null, true))}<span class="count-pill">${num(c.count)}</span></li>`)}</ul>`
            : emptyState({ icon: 'checkCircle', title: 'None' }),
        })}
      </div>`,
    );
  };

  await load();
  return null;
}
