// Pieces several pages share.
import { ago, dur, html, icon, num, pct, raw, RUN_STATE, when } from '../lib.js';
import { runBadge } from '../ui.js';

export const runTitle = (run) => run.label || `Run of ${when(run.startedAt)}`;

export const triggerBadge = (run) =>
  html`<span class="badge badge-sm ${run.trigger === 'dashboard' ? 'tone-primary' : 'tone-cyan'}">${icon(run.trigger === 'dashboard' ? 'monitor' : 'terminal')}${run.trigger === 'dashboard' ? 'Dashboard' : 'Command line'}</span>`;

const dotsSvg = raw(
  '<svg class="dots" aria-hidden="true"><defs><pattern id="banner-dots" width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.5" fill="#fff"/></pattern></defs><rect width="100%" height="100%" fill="url(#banner-dots)"/></svg>',
);

/** Colored banner for a run: result, when, how long, where from. */
export function runBanner(run, actions) {
  const s = RUN_STATE[run.status] ?? RUN_STATE.interrupted;
  const c = run.counts;
  const headline =
    run.status === 'passed'
      ? c.flaky
        ? `All passed, ${num(c.flaky)} only after a retry`
        : 'All tests passed'
      : run.status === 'interrupted'
        ? 'Run was stopped'
        : run.status === 'timedout'
          ? 'Run ran out of time'
          : `${num(c.failed + c.timedOut)} test${c.failed + c.timedOut === 1 ? '' : 's'} failed`;
  return html`<section class="banner ${run.status}" aria-label="Run result">
    ${dotsSvg}
    <div class="row">
      <div style="min-width:0">
        <h2>${icon(s.icon)}${headline}</h2>
        <div class="meta">
          <span>${icon('clock')}${when(run.startedAt)} (${ago(run.startedAt)})</span>
          <span>${icon('timer')}${dur(run.duration)}</span>
          <span>${icon('flask')}${num(c.total)} tests · ${pct(run.passRate)} pass rate</span>
          <span>${icon(run.trigger === 'dashboard' ? 'monitor' : 'terminal')}${run.trigger === 'dashboard' ? 'Started from the dashboard' : 'Started from the command line'}</span>
          ${run.branch ? html`<span>${icon('branch')}${run.branch}${run.commit ? ` @ ${run.commit}` : ''}</span>` : ''}
          ${run.target ? html`<span>${icon(run.target === 'dev' ? 'monitor' : 'flask')}${run.target === 'dev' ? 'Dev servers' : 'Test environment'}</span>` : ''}
          ${run.label ? html`<span>${icon('tag')}${run.label}</span>` : ''}
        </div>
      </div>
      ${actions ? html`<div class="actions">${actions}</div>` : ''}
    </div>
  </section>`;
}

export { runBadge };

/** Launch options that repeat a run (projects it covered). */
export const rerunOptions = (run) => ({ projects: run.projects ?? [] });

/** Remember options for the "Run tests" page and go there. */
export function goLaunch(options) {
  try {
    sessionStorage.setItem('pw-dashboard-launch', JSON.stringify(options));
  } catch {
    /* ignore */
  }
  location.hash = '#/launch';
}
