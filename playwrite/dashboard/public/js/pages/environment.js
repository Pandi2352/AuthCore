// Setup: what the tests run against, the account, tools, storage, and handy commands.
import { notifyOn, notifySupported } from '../app.js';
import { api, bytes, html, icon, num, pref, raw, render } from '../lib.js';
import { confirmDialog, copyText, emptyState, loading, refreshButton, sectionCard, spinWhile, statCard, toast } from '../ui.js';
import { forgetRun } from '../lib.js';

const COMMANDS = [
  ['npm run env:test', 'Start the test environment (own database, emails to a folder)'],
  ['npm run env:test:reset', 'Start it from an empty database'],
  ['npm test', 'Run every test (headless)'],
  ['npm run test:smoke', 'Only tests tagged @smoke'],
  ['npm run test:headed', 'Watch the browser while tests run'],
  ['npm run test:ui', "Playwright's own UI mode (pick, re-run, time-travel)"],
  ['npm run test:debug', 'Step through a test with the inspector'],
  ['npm run report', "Open Playwright's HTML report of the last run"],
  ['npm run codegen', 'Record clicks into a new test'],
  ['npm run dashboard', 'Start this dashboard'],
  ['npx playwright show-trace <file.zip>', 'Open a trace file'],
];

export async function page(main) {
  render(main, loading());
  const draw = async () => {
    const e = await api.environment();
    render(
      main,
      html`<div class="page-head">
          <div><h1>Setup</h1><p>What the tests run against, the account they use, the tools, and where reports are kept.</p></div>
          <div class="actions">${refreshButton()}</div>
        </div>
        <div class="stack">
          <div class="grid grid-stats">
            ${statCard({ tone: e.base.reachable ? 'success' : 'danger', pattern: 'rings', icon: 'globe', label: 'App', value: e.base.reachable ? 'Answering' : 'Not answering', hint: e.base.reachable ? `${e.base.ms} ms · ${e.baseURL}` : e.baseURL })}
            ${statCard({ tone: e.account && e.passwordSet ? 'success' : 'warning', pattern: 'waves', icon: 'user', label: 'Test account', value: e.account && e.passwordSet ? 'Ready' : 'Missing', hint: e.account ?? 'Set it in .env' })}
            ${statCard({ tone: 'primary', pattern: 'sparkles', icon: 'flask', label: 'Tests found', value: num(e.testCount), hint: `Playwright ${e.playwright ?? '—'}` })}
            ${statCard({ tone: 'cyan', pattern: 'bars', icon: 'database', label: 'Reports on disk', value: bytes(e.reportsBytes), hint: `${num(e.runsKept)} of ${num(e.keep)} runs kept` })}
          </div>
          ${e.catalogError ? html`<div class="callout t-danger">${icon('alert')}<div><strong>Playwright could not list the tests</strong><pre class="code wrap" style="background:none;border:0;padding:4px 0 0">${e.catalogError}</pre></div></div>` : ''}
          <div class="grid grid-2" style="align-items:start">
            ${sectionCard({
              tone: 'primary',
              icon: 'globe',
              title: 'What the tests run against',
              description: html`Default: <strong>${e.targets.find((t) => t.name === e.target)?.label}</strong> (PW_ENV in playwrite/.env). Each run can pick another on Run tests.`,
              body: html`<div class="stack" style="gap:10px">${e.targets.map(
                  (t) => html`<div class="switch" style="align-items:center">${icon(t.name === 'test' ? 'flask' : 'monitor')}
                    <div style="flex:1;min-width:0"><strong>${t.label}${t.name === e.target ? html` <span class="badge badge-sm tone-primary">Default</span>` : ''}</strong>
                      <span style="display:block">${t.baseURL} · ${t.account ?? 'no account set'}${t.passwordSet ? '' : ' · password missing'}</span></div>
                    ${t.status.reachable ? html`<span class="badge badge-sm tone-success">${icon('check')}Answering${t.status.ms !== undefined ? ` · ${t.status.ms} ms` : ''}</span>` : html`<span class="badge badge-sm tone-danger">${icon('x')}Not running</span>`}
                  </div>`,
                )}</div>
                <div class="kv" style="margin-top:14px">
                  <div>Test environment API</div><div class="mono small">${e.testEnv.api}/api/v1</div>
                  <div>Its database</div><div class="mono small">${e.testEnv.database}</div>
                  <div>Its emails (never sent)</div><div class="mono small">${e.testEnv.outbox}</div>
                  <div>Its logs</div><div class="mono small">${e.testEnv.logs}</div>
                </div>
                <div class="callout t-info" style="margin-top:14px">${icon('server')}<div style="flex:1">Start, stop or reset the test environment on the <a href="#/testenv">Test environment</a> page (or <code>npm run env:test</code> in a terminal). The dev servers use your dev database and may send real email.</div></div>`,
            })}
            ${sectionCard({
              tone: 'cyan',
              icon: 'cpu',
              title: 'Tools and machine',
              body: html`<div class="kv">
                <div>Playwright</div><div>${e.playwright ?? '—'}</div>
                <div>Node.js</div><div>${e.node}</div>
                <div>System</div><div>${e.os}</div>
                <div>CPU cores</div><div>${num(e.cpus)}</div>
                <div>Memory</div><div>${e.memoryGb} GB</div>
                <div>Test folder</div><div class="mono small">${e.root}</div>
                <div>Dashboard</div><div class="mono small">${e.dashboard}</div>
              </div>`,
            })}
            ${sectionCard({
              tone: 'violet',
              icon: 'database',
              title: 'Report storage',
              description: 'Kept in playwrite/reports (not committed).',
              body: html`<div class="kv">
                  <div>Runs kept</div><div>${num(e.runsKept)}</div>
                  <div>Space used</div><div>${bytes(e.reportsBytes)}</div>
                  <div>Playwright HTML report</div><div>${e.htmlReport ? html`<a href="/html-report/index.html" target="_blank" rel="noopener">Open (latest run only) ${icon('external')}</a>` : 'Not made yet'}</div>
                </div>
                <div class="inline-form" style="margin-top:16px">
                  <div class="form-row"><label for="keep">Keep the newest runs</label><input class="input" id="keep" type="number" min="1" max="500" value="${e.keep}" placeholder="Enter 1–500" ${e.keepFromEnv ? 'disabled' : ''}/>${e.keepFromEnv ? html`<span class="help">Set by PW_DASHBOARD_KEEP</span>` : ''}</div>
                  <div class="form-row"><label for="maxAge">Delete runs older than (days)</label><input class="input" id="maxAge" type="number" min="1" max="3650" value="${e.maxAgeDays ?? ''}" placeholder="Enter days, or leave empty"/></div>
                  <button type="button" class="btn btn-primary" data-save-keep>${icon('check')}Save</button>
                </div>
                <div class="small" style="color:var(--danger);margin-top:6px" role="alert" data-keep-err></div>
                <div class="actions" style="margin-top:14px"><button type="button" class="btn btn-danger" data-clear>${icon('trash')}Clear all history</button></div>`,
            })}
            ${sectionCard({
              tone: 'warning',
              icon: 'bell',
              title: 'Notifications',
              description: 'A desktop notification when a run finishes, so you can work elsewhere meanwhile.',
              body: html`<div id="notify"></div>`,
            })}
            ${sectionCard({
              tone: 'success',
              icon: 'terminal',
              title: 'Commands',
              description: 'Run these in the playwrite folder.',
              flush: true,
              body: html`<ul class="list">${COMMANDS.map(
                ([cmd, what]) => html`<li class="list-row"><span class="grow"><code>${cmd}</code><span class="muted small" style="display:block">${what}</span></span>
                  <button type="button" class="icon-btn tone-primary" data-copy="${cmd}" data-tip="Copy" aria-label="Copy ${cmd}">${icon('copy')}</button></li>`,
              )}</ul>`,
            })}
          </div>
        </div>`,
    );
    const btn = main.querySelector('[data-action="refresh"]');
    btn.addEventListener('click', () => spinWhile(btn, () => draw().catch((err) => toast(err.message, 'danger'))));
    main.querySelectorAll('[data-copy]').forEach((b) => b.addEventListener('click', () => copyText(b.dataset.copy, 'Command copied')));
    main.querySelector('[data-save-keep]').addEventListener('click', async () => {
      const err = main.querySelector('[data-keep-err]');
      err.textContent = '';
      try {
        const r = await api.saveSettings({ keep: main.querySelector('#keep').value || e.keep, maxAgeDays: main.querySelector('#maxAge').value });
        toast(r.removed ? `Saved. ${num(r.removed)} old run${r.removed === 1 ? '' : 's'} removed` : 'Saved');
        forgetRun();
        draw();
      } catch (ex) {
        err.textContent = ex.message;
      }
    });
    const drawNotify = () => {
      const box = main.querySelector('#notify');
      if (!notifySupported()) return render(box, html`<p class="muted">This browser can't show notifications.</p>`);
      const perm = Notification.permission;
      const on = notifyOn();
      render(
        box,
        perm === 'denied'
          ? html`<div class="callout t-warning">${icon('bellOff')}<div>Notifications are blocked for this page. Allow them in the browser's site settings (the icon left of the address), then come back.</div></div>`
          : html`<label class="switch"><input type="checkbox" data-notify ${on ? raw('checked') : ''}/><div><strong>Tell me when a run finishes</strong><span>Also scheduled runs. Click the notification to open the run.</span></div></label>
              ${on ? html`<button type="button" class="btn btn-outline btn-sm" style="margin-top:10px" data-test-notify>${icon('bell')}Send a test notification</button>` : ''}`,
      );
      box.querySelector('[data-notify]')?.addEventListener('change', async (ev) => {
        if (ev.target.checked && Notification.permission !== 'granted') {
          const answer = await Notification.requestPermission();
          if (answer !== 'granted') {
            pref.set('notify', false);
            return drawNotify();
          }
        }
        pref.set('notify', ev.target.checked);
        drawNotify();
      });
      box.querySelector('[data-test-notify]')?.addEventListener('click', () => new Notification('AuthCore tests', { body: 'Notifications work. You will get one when a run finishes.' }));
    };
    drawNotify();
    main.querySelector('[data-clear]').addEventListener('click', async () => {
      if (!(await confirmDialog({ title: 'Clear all history?', text: "Every kept run and its screenshots, videos and traces will be removed from this machine. This can't be undone.", confirmLabel: 'Clear history' }))) return;
      try {
        await api.clearRuns();
        forgetRun();
        toast('History cleared');
        draw();
      } catch (err) {
        toast(err.message, 'danger');
      }
    });
  };
  await draw().catch((e) => render(main, emptyState({ icon: 'alert', title: 'Could not load the setup', text: e.message })));
  return null;
}
