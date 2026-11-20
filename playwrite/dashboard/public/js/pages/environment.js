// Setup: what the tests run against, the account, tools, storage, and handy commands.
import { api, bytes, html, icon, num, render } from '../lib.js';
import { confirmDialog, copyText, emptyState, loading, refreshButton, sectionCard, spinWhile, statCard, toast } from '../ui.js';
import { forgetRun } from '../lib.js';

const COMMANDS = [
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
              body: html`<div class="kv">
                <div>App address</div><div><a href="${e.baseURL}" target="_blank" rel="noopener">${e.baseURL}</a></div>
                <div>Status</div><div>${e.base.reachable ? `Answering (HTTP ${e.base.status}, ${e.base.ms} ms)` : `Not answering: ${e.base.error}`}</div>
                <div>Account</div><div>${e.account ?? 'Not set'}</div>
                <div>Password</div><div>${e.passwordSet ? 'Set (hidden)' : 'Not set'}</div>
                <div>Settings file</div><div>${e.envFile ? 'playwrite/.env' : 'Missing: copy .env.example to .env'}</div>
              </div>
              <div class="callout t-warning" style="margin-top:14px">${icon('alert')}<div>Tests use the app and database at this address. Tests that create or change records do so there; a separate test environment keeps your data clean.</div></div>`,
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
                  <div>Runs kept</div><div>${num(e.runsKept)} (the newest ${num(e.keep)}; set PW_DASHBOARD_KEEP to change)</div>
                  <div>Space used</div><div>${bytes(e.reportsBytes)}</div>
                  <div>Playwright HTML report</div><div>${e.htmlReport ? html`<a href="/html-report/index.html" target="_blank" rel="noopener">Open (latest run only) ${icon('external')}</a>` : 'Not made yet'}</div>
                </div>
                <div class="actions" style="margin-top:14px"><button type="button" class="btn btn-danger" data-clear>${icon('trash')}Clear all history</button></div>`,
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
