// Run tests: choose what and how, start, watch progress and output live, stop.
import { live, onLive } from '../app.js';
import { api, dur, html, icon, num, raw, render } from '../lib.js';
import { dropdown, emptyState, loading, sectionCard, toast } from '../ui.js';

const PRESETS = [
  { id: 'smoke', label: 'Smoke tests', icon: 'zap', options: { tags: ['@smoke'] } },
  { id: 'all', label: 'Everything', icon: 'layers', options: {} },
  { id: 'desktop', label: 'Desktop only', icon: 'monitor', options: { projects: ['chromium', 'public'] } },
  { id: 'phone', label: 'Phone only', icon: 'phone', options: { projects: ['mobile'] } },
  { id: 'failed', label: 'Failed last time', icon: 'repeat', options: { lastFailed: true } },
];

const blank = () => ({ projects: [], files: [], tags: [], grep: '', grepInvert: '', workers: null, retries: null, repeatEach: null, maxFailures: null, headed: false, lastFailed: false, trace: false, label: '' });

export async function page(main) {
  render(main, loading());
  const [catalog, env] = await Promise.all([api.catalog().catch(() => null), api.environment().catch(() => null)]);
  if (!catalog) {
    render(main, emptyState({ icon: 'alert', title: 'Could not read the tests', text: 'Is Playwright installed in the playwrite folder?' }));
    return null;
  }
  let opts = blank();
  try {
    const saved = sessionStorage.getItem('pw-dashboard-launch');
    if (saved) {
      opts = { ...opts, ...JSON.parse(saved) };
      sessionStorage.removeItem('pw-dashboard-launch');
    }
  } catch {
    /* ignore */
  }

  render(
    main,
    html`<div class="page-head">
        <div><h1>Run tests</h1><p>Pick what to run and how. Progress and output show here live, and the full report is saved with the other runs.</p></div>
      </div>
      <div class="stack">
        ${env && !env.base.reachable ? html`<div class="callout t-danger">${icon('alert')}<div><strong>The app isn't answering at ${env.baseURL}</strong><div>${env.base.error}. Start the frontend and backend first, or most tests will fail.</div></div></div>` : ''}
        ${env && !(env.account && env.passwordSet) ? html`<div class="callout t-warning">${icon('user')}<div><strong>No test account</strong><div>Add E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to playwrite/.env; signed-in tests need them.</div></div></div>` : ''}
        <div id="live"></div>
        <div class="grid grid-2" style="align-items:start">
          <div class="stack">
            ${sectionCard({
              tone: 'primary',
              icon: 'zap',
              title: 'Quick picks',
              description: 'Fill the form with a common choice.',
              body: html`<div class="chips">${PRESETS.map((p) => html`<button type="button" class="chip" data-preset="${p.id}">${icon(p.icon)}${p.label}</button>`)}</div>`,
            })}
            ${sectionCard({
              tone: 'violet',
              icon: 'flask',
              title: 'What to run',
              description: 'Leave a choice empty to include everything.',
              body: html`<div class="stack" style="gap:16px">
                <div class="form-row"><span class="label">Projects</span><div class="chips" data-chips="projects">${catalog.projects.map((p) => html`<button type="button" class="chip" data-value="${p.name}">${icon(p.name === 'mobile' ? 'phone' : p.name === 'public' ? 'globe' : 'monitor')}${p.name}</button>`)}</div>
                  <span class="help">public: pages without sign-in · chromium: desktop · mobile: phone screen (tests tagged @mobile)</span></div>
                <div class="form-row"><span class="label">Tags</span><div class="chips" data-chips="tags">${catalog.tags.map((t) => html`<button type="button" class="chip" data-value="${t}">${icon('tag')}${t}</button>`)}</div></div>
                <div class="form-row"><span class="label" id="files-label">Files</span><div data-dd="files"></div></div>
                <div class="form-row"><label for="grep">Test name contains</label><input class="input" id="grep" data-field="grep" placeholder="Enter part of a test name (a regular expression)" /></div>
                <div class="form-row"><label for="grepInvert">Leave out tests whose name contains</label><input class="input" id="grepInvert" data-field="grepInvert" placeholder="Enter part of a test name to skip" /></div>
              </div>`,
            })}
          </div>
          <div class="stack">
            ${sectionCard({
              tone: 'cyan',
              icon: 'settings',
              title: 'How to run',
              body: html`<div class="stack" style="gap:16px">
                <div class="form-grid">
                  <div class="form-row"><label for="workers">Parallel workers</label><input class="input" type="number" min="1" max="8" id="workers" data-num="workers" placeholder="Enter 1–8 (default ${catalog.workers ?? 4})" /><span class="help">Max 4: sign-in limit</span></div>
                  <div class="form-row"><label for="retries">Retries</label><input class="input" type="number" min="0" max="5" id="retries" data-num="retries" placeholder="Enter 0–5 (default 0)" /></div>
                  <div class="form-row"><label for="repeatEach">Repeat each test</label><input class="input" type="number" min="1" max="20" id="repeatEach" data-num="repeatEach" placeholder="Enter 1–20 (finds flaky)" /></div>
                  <div class="form-row"><label for="maxFailures">Stop after failures</label><input class="input" type="number" min="1" max="1000" id="maxFailures" data-num="maxFailures" placeholder="Enter a number (default never)" /></div>
                </div>
                <label class="switch"><input type="checkbox" data-bool="headed" /><div><strong>Show the browser</strong><span>Open real browser windows so you can watch.</span></div></label>
                <label class="switch"><input type="checkbox" data-bool="trace" /><div><strong>Record traces for every test</strong><span>Not only failures. Bigger reports, but every step is replayable.</span></div></label>
                <label class="switch"><input type="checkbox" data-bool="lastFailed" /><div><strong>Only tests that failed last time</strong><span>Uses the result of the latest run.</span></div></label>
                <div class="form-row"><label for="label">Name this run</label><input class="input" id="label" data-field="label" maxlength="80" placeholder="Enter a name, e.g. After role page fix" /></div>
              </div>`,
            })}
            ${sectionCard({
              tone: 'success',
              icon: 'terminal',
              title: 'Command',
              description: 'The same run from a terminal, in the playwrite folder.',
              aside: html`<button type="button" class="icon-btn tone-primary" data-copy-cmd data-tip="Copy" aria-label="Copy command">${icon('copy')}</button>`,
              body: html`<pre class="code wrap" id="cmd"></pre>
                <div class="actions" style="margin-top:14px">
                  <button type="button" class="btn btn-primary" data-start>${icon('play')}Start run</button>
                  <button type="button" class="btn btn-outline" data-reset>${icon('refresh')}Reset</button>
                </div>`,
            })}
          </div>
        </div>
      </div>`,
  );

  // ---------------------------------------------------------------- form
  const filesDd = dropdown(main.querySelector('[data-dd="files"]'), {
    options: catalog.files.map((f) => ({ value: f, label: f })),
    value: opts.files,
    multiple: true,
    placeholder: 'All files',
    label: 'Files',
    onChange: (v) => ((opts.files = v), syncForm()),
  });

  const syncForm = () => {
    for (const group of ['projects', 'tags']) {
      main.querySelectorAll(`[data-chips="${group}"] .chip`).forEach((c) => c.setAttribute('aria-pressed', String(opts[group].includes(c.dataset.value))));
    }
    main.querySelectorAll('[data-field]').forEach((i) => {
      if (document.activeElement !== i) i.value = opts[i.dataset.field] ?? '';
    });
    main.querySelectorAll('[data-num]').forEach((i) => {
      if (document.activeElement !== i) i.value = opts[i.dataset.num] ?? '';
    });
    main.querySelectorAll('[data-bool]').forEach((i) => (i.checked = Boolean(opts[i.dataset.bool])));
    main.querySelector('#cmd').textContent = command(opts);
  };

  main.querySelectorAll('[data-chips]').forEach((box) =>
    box.addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      const g = box.dataset.chips;
      const v = chip.dataset.value;
      opts[g] = opts[g].includes(v) ? opts[g].filter((x) => x !== v) : [...opts[g], v];
      syncForm();
    }),
  );
  main.querySelectorAll('[data-field]').forEach((i) => i.addEventListener('input', () => ((opts[i.dataset.field] = i.value), syncForm())));
  main.querySelectorAll('[data-num]').forEach((i) =>
    i.addEventListener('input', () => {
      const n = Number.parseInt(i.value, 10);
      opts[i.dataset.num] = Number.isFinite(n) ? n : null;
      syncForm();
    }),
  );
  main.querySelectorAll('[data-bool]').forEach((i) => i.addEventListener('change', () => ((opts[i.dataset.bool] = i.checked), syncForm())));
  main.querySelectorAll('[data-preset]').forEach((b) =>
    b.addEventListener('click', () => {
      const p = PRESETS.find((x) => x.id === b.dataset.preset);
      opts = { ...blank(), ...structuredClone(p.options), label: p.label };
      filesDd.set(opts.files);
      syncForm();
    }),
  );
  main.querySelector('[data-reset]').addEventListener('click', () => {
    opts = blank();
    filesDd.set([]);
    syncForm();
  });
  main.querySelector('[data-copy-cmd]').addEventListener('click', () => navigator.clipboard.writeText(main.querySelector('#cmd').textContent).then(() => toast('Command copied')));
  main.querySelector('[data-start]').addEventListener('click', async (e) => {
    e.currentTarget.disabled = true;
    try {
      live.log = [];
      await api.start(opts);
      main.querySelector('#live').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
      toast(err.message, 'danger');
    } finally {
      drawLive();
    }
  });
  syncForm();

  // ---------------------------------------------------------------- live
  const liveBox = main.querySelector('#live');
  let lastResult = null;
  let tick = null;

  const drawLive = () => {
    const s = live.state;
    const startBtn = main.querySelector('[data-start]');
    if (startBtn) startBtn.disabled = Boolean(s?.running);
    if (!s?.running && !lastResult && !live.log.length) {
      liveBox.innerHTML = '';
      return;
    }
    const p = s?.progress;
    const done = p?.done ?? 0;
    const total = p?.total ?? 0;
    const elapsed = s?.startedAt ? Date.now() - new Date(s.startedAt).getTime() : 0;
    const part = (k, cls) => (p && p[k] ? html`<span class="${cls}" style="flex:${p[k]}"></span>` : '');
    render(
      liveBox,
      sectionCard({
        tone: s?.running ? 'info' : lastResult?.exitCode === 0 ? 'success' : 'danger',
        icon: s?.running ? 'activity' : lastResult?.exitCode === 0 ? 'checkCircle' : 'xCircle',
        title: s?.running ? 'Running…' : lastResult ? (lastResult.exitCode === 0 ? 'Finished: all passed' : 'Finished with failures') : 'Last run output',
        description: s?.command ?? '',
        aside: s?.running
          ? html`<button type="button" class="btn btn-danger btn-sm" data-stop>${icon('stop')}Stop</button>`
          : lastResult?.runId
            ? html`<a class="btn btn-primary btn-sm" href="#/runs/${encodeURIComponent(lastResult.runId)}">${icon('eye')}Open the report</a>`
            : '',
        body: html`<div class="stack" style="gap:14px">
          ${p
            ? html`<div>
                <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:6px" class="small">
                  <strong>${num(done)} of ${num(total)} tests done</strong>
                  <span class="muted">${dur(elapsed)}${s?.running && done ? ` · about ${dur((elapsed / done) * (total - done))} left` : ''}</span>
                </div>
                <div class="progress" role="progressbar" aria-label="Test progress" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${done}">
                  ${part('passed', 'c-passed')}${part('flaky', 'c-flaky')}${part('failed', 'c-failed')}${part('timedOut', 'c-failed')}${part('skipped', 'c-skipped')}${part('interrupted', 'c-skipped')}
                  ${total - done > 0 ? html`<span style="flex:${total - done}"></span>` : ''}
                </div>
                <div class="legend">
                  <span><i class="c-passed"></i>Passed <b>${num(p.passed)}</b></span>
                  <span><i class="c-flaky"></i>Flaky <b>${num(p.flaky)}</b></span>
                  <span><i class="c-failed"></i>Failed <b>${num(p.failed + p.timedOut)}</b></span>
                  <span><i class="c-skipped"></i>Skipped <b>${num(p.skipped + p.interrupted)}</b></span>
                </div>
              </div>`
            : s?.running
              ? html`<div class="loading" style="padding:10px 0;justify-content:flex-start"><span class="spinner"></span>Starting Playwright…</div>`
              : ''}
          ${p?.running?.length && s?.running
            ? html`<div><div class="small" style="font-weight:600;margin-bottom:6px">Running now</div><div class="chips">${p.running.map(
                (r) => html`<span class="badge tone-info">${raw('<span class="pulse"></span>')}${r.title} · ${r.project}</span>`,
              )}</div></div>`
            : ''}
          <div class="log" id="log" role="log" aria-label="Playwright output"></div>
        </div>`,
      }),
    );
    const logEl = liveBox.querySelector('#log');
    logEl.innerHTML = live.log.map(lineHtml).join('');
    logEl.scrollTop = logEl.scrollHeight;
    liveBox.querySelector('[data-stop]')?.addEventListener('click', async (e) => {
      e.currentTarget.disabled = true;
      await api.stop().catch((err) => toast(err.message, 'danger'));
    });
  };

  const appendLine = (line) => {
    const logEl = liveBox.querySelector('#log');
    if (!logEl) return drawLive();
    const nearBottom = logEl.scrollHeight - logEl.scrollTop - logEl.clientHeight < 40;
    logEl.insertAdjacentHTML('beforeend', lineHtml(line));
    if (nearBottom) logEl.scrollTop = logEl.scrollHeight;
  };

  // Catch up if a run is already going (e.g. started from another tab).
  try {
    const st = await api.liveState();
    live.state = st;
    if (st.log?.length && !live.log.length) live.log = st.log;
  } catch {
    /* ignore */
  }
  drawLive();
  const off = onLive((type, data) => {
    if (type === 'log') return appendLine(data);
    if (type === 'finished') lastResult = data;
    if (type === 'started') lastResult = null;
    drawLive();
  });
  tick = setInterval(() => live.state?.running && drawLive(), 5000);
  return () => {
    off();
    clearInterval(tick);
  };
}

const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
function lineHtml(line) {
  const cls = /✓|passed/.test(line) && !/failed/.test(line) ? 'l-ok' : /✘|failed|Error|error:/.test(line) ? 'l-bad' : /flaky|retry|skipped|-\s/.test(line) ? 'l-warn' : '';
  return `<div class="${cls}">${esc(line)}</div>`;
}

/** Mirror of the server's argument building, for display. */
function command(o) {
  const a = ['npx playwright test'];
  for (const p of o.projects) a.push(`--project=${p}`);
  const parts = [];
  if (o.tags.length) parts.push(o.tags.join('|'));
  if (o.grep?.trim()) parts.push(o.grep.trim());
  if (parts.length === 1) a.push(`--grep "${parts[0]}"`);
  if (parts.length === 2) a.push(`--grep "(?=.*(${parts[0]}))(?=.*(${parts[1]}))"`);
  if (o.grepInvert?.trim()) a.push(`--grep-invert "${o.grepInvert.trim()}"`);
  if (o.workers) a.push(`--workers=${o.workers}`);
  if (o.retries !== null && o.retries !== undefined) a.push(`--retries=${o.retries}`);
  if (o.repeatEach > 1) a.push(`--repeat-each=${o.repeatEach}`);
  if (o.maxFailures) a.push(`--max-failures=${o.maxFailures}`);
  if (o.headed) a.push('--headed');
  if (o.lastFailed) a.push('--last-failed');
  if (o.trace) a.push('--trace=on');
  a.push(...o.files);
  return a.join(' ');
}

