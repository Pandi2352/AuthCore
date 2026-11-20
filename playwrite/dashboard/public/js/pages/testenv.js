// Test environment: start / stop it, follow its backend log, and clean up data tests left.
import { live, onLive, setQuery } from '../app.js';
import { ago, api, debounce, html, icon, num, raw, render } from '../lib.js';
import { confirmDialog, dropdown, emptyState, loading, openDialog, refreshButton, sectionCard, spinWhile, statCard, tabs, toast } from '../ui.js';
import { logLinesHtml, matchesLog } from './logview.js';

const PHASE = {
  ready: { label: 'Running', tone: 'success', icon: 'checkCircle' },
  starting: { label: 'Starting…', tone: 'warning', icon: 'refresh' },
  failed: { label: 'Failed to start', tone: 'danger', icon: 'xCircle' },
  stopped: { label: 'Stopped', tone: 'neutral', icon: 'stop' },
};

export async function page(main, _params, query) {
  render(main, loading());
  let status = await api.envStatus().catch((e) => ({ phase: 'stopped', error: e.message, output: [], web: {}, api: {} }));
  const opts = { reset: false, rebuild: false };
  let tab = query.get('tab') ?? 'log';

  render(
    main,
    html`<div class="page-head">
        <div><h1>Test environment</h1><p>The separate AuthCore the tests run against: its own database, emails saved to a folder (never sent), and its own backend log.</p></div>
        <div class="actions">${refreshButton()}</div>
      </div>
      <div class="stack">
        <div class="grid grid-stats" id="env-cards"></div>
        <div class="grid grid-2" style="align-items:start">
          <div id="env-control"></div>
          <div id="env-output"></div>
        </div>
        <div><div id="env-tabs"></div><div id="env-body"></div></div>
      </div>`,
  );

  // ------------------------------------------------------------ status + control
  const drawStatus = () => {
    const p = PHASE[status.phase] ?? PHASE.stopped;
    render(
      main.querySelector('#env-cards'),
      html`${statCard({ tone: p.tone, pattern: 'rings', icon: p.icon, label: 'State', value: p.label, hint: status.startedAt && status.phase === 'ready' ? `Since ${ago(status.startedAt)}` : status.external ? 'Started from a terminal' : 'Start it below' })}
        ${statCard({ tone: status.web?.up ? 'success' : 'neutral', pattern: 'waves', icon: 'globe', label: 'App', value: status.web?.up ? 'Answering' : 'Not answering', hint: status.web?.url ?? '' })}
        ${statCard({ tone: status.api?.up ? 'success' : 'neutral', pattern: 'bars', icon: 'server', label: 'API', value: status.api?.up ? `${status.api.ms} ms` : 'Not answering', hint: status.api?.url ?? '' })}
        ${statCard({ tone: 'violet', pattern: 'dots', icon: 'database', label: 'Database', value: 'Its own', hint: (status.database ?? '').split('/').pop() || '—' })}`,
    );
    const running = status.phase === 'ready' || status.phase === 'starting';
    render(
      main.querySelector('#env-control'),
      sectionCard({
        tone: 'primary',
        icon: 'power',
        title: 'Start and stop',
        description: running
          ? html`${status.external ? 'Started from a terminal. ' : ''}Sign in at <a href="${status.web.url}" target="_blank" rel="noopener">${status.web.url}</a> as <strong>${status.admin}</strong> (password in playwrite/.env).`
          : 'Builds what changed (backend into dist-pw, your dist/ is untouched), then starts it. Started here, it stops when the dashboard stops.',
        body: html`<div class="stack" style="gap:12px">
          <label class="switch"><input type="checkbox" data-opt="reset" ${opts.reset ? raw('checked') : ''}/><div><strong>Start from an empty database</strong><span>Drops the test database and empties the email folder and uploads first.</span></div></label>
          <label class="switch"><input type="checkbox" data-opt="rebuild" ${opts.rebuild ? raw('checked') : ''}/><div><strong>Rebuild everything</strong><span>Build the backend and frontend even if nothing changed.</span></div></label>
          <div class="actions">
            ${running
              ? html`<button type="button" class="btn btn-primary" data-act="restart">${icon('refresh')}Restart</button>
                  <button type="button" class="btn btn-danger" data-act="stop">${icon('stop')}Stop</button>`
              : html`<button type="button" class="btn btn-primary" data-act="start">${icon('play')}Start</button>`}
            ${running ? html`<a class="btn btn-outline" href="${status.web.url}" target="_blank" rel="noopener">${icon('external')}Open the app</a><a class="btn btn-outline" href="${status.api.docs}" target="_blank" rel="noopener">${icon('code')}API docs</a>` : ''}
          </div>
        </div>`,
      }),
    );
    main.querySelectorAll('[data-opt]').forEach((i) => i.addEventListener('change', () => (opts[i.dataset.opt] = i.checked)));
    main.querySelector('[data-act="start"]')?.addEventListener('click', (e) => act(e.currentTarget, () => api.envStart(opts)));
    main.querySelector('[data-act="stop"]')?.addEventListener('click', async (e) => {
      if (!(await confirmDialog({ title: 'Stop the test environment?', text: 'Tests against it will fail until you start it again. Its data stays.', confirmLabel: 'Stop' }))) return;
      act(e.currentTarget, () => api.envStop());
    });
    main.querySelector('[data-act="restart"]')?.addEventListener('click', (e) =>
      act(e.currentTarget, async () => {
        await api.envStop();
        live.envLog = [];
        return api.envStart(opts);
      }),
    );
  };

  const act = async (btn, work) => {
    btn.disabled = true;
    try {
      status = await work();
      drawStatus();
      drawOutput();
    } catch (err) {
      toast(err.message, 'danger');
    } finally {
      btn.disabled = false;
    }
  };

  // --------------------------------------------------------------- start output
  const drawOutput = () => {
    const lines = live.envLog.length ? live.envLog : (status.output ?? []);
    render(
      main.querySelector('#env-output'),
      sectionCard({
        tone: 'info',
        icon: 'terminal',
        title: 'Start-up output',
        description: status.managed || lines.length ? 'What the start script printed.' : 'Shows here when you start it from the dashboard.',
        body: lines.length
          ? html`<div class="log" id="env-lines" style="height:260px" role="log" aria-label="Start-up output">${lines.map((l) => html`<div class="${/fail|error|refus/i.test(l) ? 'l-bad' : /Ready|done|up to date|signs in/i.test(l) ? 'l-ok' : ''}">${l}</div>`)}</div>`
          : emptyState({ icon: 'terminal', title: status.external ? 'Started from a terminal' : 'Not started yet', text: status.external ? 'Its start-up output is in that terminal. Restart it here to see it on this page.' : 'Press Start; the build and start-up steps show here.' }),
      }),
    );
    const box = main.querySelector('#env-lines');
    if (box) box.scrollTop = box.scrollHeight;
  };

  // ----------------------------------------------------------------- backend log
  const logState = { lines: [], offset: undefined, q: '', level: 'all', apiOnly: false, follow: true, timer: null, missing: false };
  const logTab = (body) => {
    render(
      body,
      sectionCard({
        tone: 'cyan',
        icon: 'logs',
        title: 'Backend log',
        description: 'Everything the test backend writes: requests, warnings, errors. It starts over each time the environment starts.',
        flush: true,
        body: html`<div class="toolbar">
            <label class="field grow">${icon('search')}<span class="sr-only">Filter the log</span><input type="search" placeholder="Filter by text, e.g. /api/v1/roles or 500" data-q value="${logState.q}"/></label>
            <div data-dd="level"></div>
            <label class="switch" style="padding:6px 10px"><input type="checkbox" data-api ${logState.apiOnly ? raw('checked') : ''}/><strong>Only API requests</strong></label>
            <button type="button" class="btn btn-outline" data-follow>${icon(logState.follow ? 'pause' : 'play')}${logState.follow ? 'Pause' : 'Follow'}</button>
          </div>
          <div style="padding:12px 16px 16px"><div class="logview" id="logview" role="log" aria-label="Backend log"></div><div class="small muted" id="log-count" style="margin-top:6px"></div></div>`,
      }),
    );
    dropdown(body.querySelector('[data-dd="level"]'), {
      options: [
        { value: 'all', label: 'All levels' },
        { value: 'problems', label: 'Warnings and errors' },
        { value: 'error', label: 'Errors' },
        { value: 'warn', label: 'Warnings' },
        { value: 'info', label: 'Info' },
        { value: 'debug', label: 'Debug' },
      ],
      value: logState.level,
      label: 'Level',
      onChange: (v) => ((logState.level = v), drawLog(true)),
    });
    body.querySelector('[data-q]').addEventListener('input', debounce((e) => ((logState.q = e.target.value), drawLog(true))));
    body.querySelector('[data-api]').addEventListener('change', (e) => ((logState.apiOnly = e.target.checked), drawLog(true)));
    body.querySelector('[data-follow]').addEventListener('click', (e) => {
      logState.follow = !logState.follow;
      render(e.currentTarget, html`${icon(logState.follow ? 'pause' : 'play')}${logState.follow ? 'Pause' : 'Follow'}`);
      if (logState.follow) pull();
    });
    drawLog(true);
    pull();
  };
  const drawLog = (jump = false) => {
    const view = main.querySelector('#logview');
    if (!view) return;
    const shown = logState.lines.filter((l) => matchesLog(l, logState)).slice(-3000);
    const atBottom = view.scrollHeight - view.scrollTop - view.clientHeight < 40;
    view.innerHTML = logState.missing
      ? '<div class="plain">No log yet: start the test environment.</div>'
      : shown.length
        ? logLinesHtml(shown, logState.q)
        : '<div class="plain">No lines match.</div>';
    if (jump || (atBottom && logState.follow)) view.scrollTop = view.scrollHeight;
    const count = main.querySelector('#log-count');
    if (count) count.textContent = `${num(shown.length)} of ${num(logState.lines.length)} lines shown${logState.follow ? ' · following' : ' · paused'}`;
  };
  const pull = async () => {
    clearTimeout(logState.timer);
    try {
      const chunk = await api.envLogs(logState.offset);
      logState.missing = Boolean(chunk.missing);
      if (chunk.reset) logState.lines = [];
      if (chunk.lines.length) {
        logState.lines.push(...chunk.lines);
        if (logState.lines.length > 20000) logState.lines.splice(0, logState.lines.length - 20000);
      }
      logState.offset = chunk.offset;
      if (chunk.lines.length || chunk.reset || logState.missing) drawLog();
    } catch {
      /* try again later */
    }
    if (logState.follow && tab === 'log' && main.isConnected) logState.timer = setTimeout(pull, 2000);
  };

  // ------------------------------------------------------------------ leftovers
  const leftoverTab = async (body) => {
    render(body, loading('Looking in the test database…'));
    let groups;
    try {
      groups = await api.leftovers();
    } catch (e) {
      return render(body, html`<div class="section t-neutral"><div class="body">${emptyState({ icon: 'database', title: 'Could not read the test database', text: e.message })}</div></div>`);
    }
    const total = groups.reduce((s, g) => s + g.items.length, 0);
    render(
      body,
      sectionCard({
        tone: total ? 'warning' : 'success',
        icon: 'eraser',
        title: 'Leftover test data',
        description: 'Records tests made (names and keys starting with PW, users pw.…@authcore.test) that are still in the test database, e.g. after a test was stopped half-way.',
        aside: total ? html`<button type="button" class="btn btn-danger btn-sm" data-clean="">${icon('eraser')}Clean up all (${num(total)})</button>` : '',
        flush: true,
        body: total
          ? html`${groups.filter((g) => g.items.length).map(
              (g) => html`<div style="padding:12px 16px;border-top:1px solid var(--border)">
                <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px"><strong>${g.label}</strong><span class="count-pill">${num(g.items.length)}</span><span class="muted small">${g.how}</span>
                  <button type="button" class="btn btn-outline btn-sm" style="margin-left:auto" data-clean="${g.kind}">${icon('eraser')}Clean up</button></div>
                <ul class="list">${g.items.slice(0, 50).map((it) => html`<li class="list-row"><span class="grow truncate">${it.name}</span><span class="muted small nowrap">${it.createdAt ? ago(it.createdAt) : ''}</span></li>`)}</ul>
                ${g.items.length > 50 ? html`<div class="muted small">…and ${num(g.items.length - 50)} more</div>` : ''}
              </div>`,
            )}`
          : emptyState({ icon: 'checkCircle', title: 'Nothing left behind', text: 'No test-made records in the test database.' }),
      }),
    );
    body.querySelectorAll('[data-clean]').forEach((b) =>
      b.addEventListener('click', async () => {
        const kind = b.dataset.clean;
        const what = kind ? groups.find((g) => g.kind === kind) : null;
        const count = what ? what.items.length : total;
        if (!(await confirmDialog({ title: `Clean up ${num(count)} record${count === 1 ? '' : 's'}?`, text: `${what ? what.label : 'Every leftover record'} made by tests will be removed from the test database. Your dev database is not touched.`, confirmLabel: 'Clean up' }))) return;
        await spinWhile(b, async () => {
          b.disabled = true;
          try {
            const results = await api.cleanup(kind ? [kind] : []);
            const failed = results.filter((r) => !r.ok);
            if (failed.length) {
              openDialog({
                title: `${num(results.length - failed.length)} removed, ${num(failed.length)} not`,
                width: 640,
                body: html`<ul class="list">${failed.map((r) => html`<li class="list-row"><span class="grow">${r.name}</span><span class="badge badge-sm tone-danger">${r.message}</span></li>`)}</ul>`,
              });
            } else toast(`${num(results.length)} record${results.length === 1 ? '' : 's'} removed`);
          } catch (e) {
            toast(e.message, 'danger');
          }
        });
        leftoverTab(body);
      }),
    );
  };

  // ---------------------------------------------------------------------- plumbing
  const body = main.querySelector('#env-body');
  const views = { log: logTab, leftovers: leftoverTab };
  if (!views[tab]) tab = 'log';
  tabs(
    main.querySelector('#env-tabs'),
    [
      { id: 'log', label: 'Backend log', icon: 'logs' },
      { id: 'leftovers', label: 'Leftover test data', icon: 'eraser' },
    ],
    tab,
    (id) => {
      tab = id;
      setQuery({ tab: id === 'log' ? '' : id });
      views[id](body);
    },
  );
  drawStatus();
  drawOutput();
  views[tab](body);

  const refreshBtn = main.querySelector('[data-action="refresh"]');
  refreshBtn.addEventListener('click', () =>
    spinWhile(refreshBtn, async () => {
      status = await api.envStatus();
      drawStatus();
      drawOutput();
      if (tab === 'leftovers') leftoverTab(body);
    }),
  );
  const off = onLive((type, data) => {
    if (type === 'env') {
      status = { ...status, ...data };
      drawStatus();
      if (data.phase === 'ready' && tab === 'log') {
        logState.offset = undefined;
        pull();
      }
    }
    if (type === 'env-line') {
      const box = main.querySelector('#env-lines');
      if (!box) return drawOutput();
      const div = document.createElement('div');
      div.textContent = data;
      if (/fail|error|refus/i.test(data)) div.className = 'l-bad';
      else if (/Ready|done|up to date|signs in/i.test(data)) div.className = 'l-ok';
      box.append(div);
      box.scrollTop = box.scrollHeight;
    }
  });
  return () => {
    off();
    clearTimeout(logState.timer);
    logState.follow = false;
  };
}

