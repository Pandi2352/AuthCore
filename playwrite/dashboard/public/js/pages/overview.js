// Overview: the latest run at a glance, trends across runs, and what needs a look.
import { barChart, lineChart, stackedBars, tipRows } from '../charts.js';
import { api, dur, getNotes, getRun, groups, html, icon, num, pct, render, testKey, when } from '../lib.js';
import {
  emptyState,
  loading,
  refreshButton,
  sectionCard,
  spinWhile,
  stateBadge,
  statCard,
  statusBar,
  statusLegend,
} from '../ui.js';
import { goLaunch, rerunOptions, runBanner } from './common.js';
import { openTestDialog } from './test-dialog.js';

export async function page(main) {
  render(main, loading());
  const draw = async () => {
    const [runs, hist, notes] = await Promise.all([api.runs(), api.history(), getNotes(true)]);
    if (!runs.length) {
      render(
        main,
        html`${head()}
          <div class="section t-primary"><div class="body">
            ${emptyState({
              icon: 'flask',
              title: 'No test runs yet',
              text: 'Start a run here, or run "npm test" in the playwrite folder. Every run shows up here with full details.',
              action: html`<a class="btn btn-primary" href="#/launch">${icon('play')}Run tests</a>`,
            })}
          </div></div>`,
      );
      return wire();
    }
    const latest = await getRun(runs[0].id);
    const prev = runs[1];
    const chrono = runs.slice(0, 30).reverse();
    const c = latest.counts;
    const executed = c.total - c.skipped;
    const durDelta = prev ? latest.duration - prev.duration : null;
    const last7 = runs.filter((r) => Date.now() - new Date(r.startedAt) < 7 * 864e5).length;

    // Across history: flakiest and most failing tests.
    const tally = Object.entries(hist).map(([key, list]) => ({
      key,
      list,
      flaky: list.filter((h) => h.state === 'flaky').length,
      failed: list.filter((h) => h.state === 'failed' || h.state === 'timedOut').length,
      runs: list.length,
    }));
    const flakiest = tally.filter((t) => t.flaky).sort((a, b) => b.flaky - a.flaky).slice(0, 8);
    const failing = tally.filter((t) => t.failed).sort((a, b) => b.failed - a.failed).slice(0, 8);
    // Known issues (muted on the test's Notes tab) go last.
    const isKnown = (t) => Boolean(notes[testKey(t)]?.muted);
    const failures = latest.tests
      .map((t, i) => ({ t, i }))
      .filter(({ t }) => ['failed', 'timedOut', 'flaky'].includes(t.state))
      .sort((a, b) => Number(isKnown(a.t)) - Number(isKnown(b.t)));
    const knownFailing = failures.filter(({ t }) => isKnown(t) && t.state !== 'flaky').length;
    const slowest = latest.tests.map((t, i) => ({ t, i })).sort((a, b) => b.t.duration - a.t.duration).slice(0, 8);
    const avgTest = executed ? latest.tests.reduce((s, t) => s + t.duration, 0) / Math.max(1, latest.tests.length) : 0;

    const byProject = {};
    for (const t of latest.tests) {
      byProject[t.project] ??= { passed: 0, failed: 0, flaky: 0, skipped: 0, timedOut: 0, interrupted: 0, total: 0, duration: 0 };
      byProject[t.project][t.state]++;
      byProject[t.project].total++;
      byProject[t.project].duration += t.duration;
    }

    const go = (filter) => `#/runs/${encodeURIComponent(latest.id)}${filter ? `?state=${filter}` : ''}`;
    render(
      main,
      html`${head()}
      <div class="stack">
        ${runBanner(
          latest,
          html`<a class="btn btn-outline" href="${go()}">${icon('eye')}Open run</a>
            <button type="button" class="btn btn-ghost" data-action="rerun">${icon('repeat')}Run again</button>`,
        )}
        <div class="grid grid-stats">
          ${statCard({ tone: 'primary', pattern: 'rings', icon: 'flask', label: 'Tests', value: num(c.total), hint: `${latest.projects.length} project${latest.projects.length === 1 ? '' : 's'}`, action: 'go:' })}
          ${statCard({ tone: 'success', pattern: 'waves', icon: 'checkCircle', label: 'Passed', value: num(c.passed), hint: 'First try', action: 'go:passed' })}
          ${statCard({ tone: 'danger', pattern: 'stripes', icon: 'xCircle', label: 'Failed', value: num(c.failed + c.timedOut), hint: knownFailing ? `${num(knownFailing)} known issue${knownFailing === 1 ? '' : 's'}` : c.timedOut ? `${num(c.timedOut)} timed out` : 'Need a look', action: 'go:failed' })}
          ${statCard({ tone: 'warning', pattern: 'dots', icon: 'alert', label: 'Flaky', value: num(c.flaky), hint: 'Passed after a retry', action: 'go:flaky' })}
          ${statCard({ tone: 'neutral', pattern: 'grid', icon: 'skip', label: 'Skipped', value: num(c.skipped + c.interrupted), hint: c.interrupted ? `${num(c.interrupted)} interrupted` : 'Not run', action: 'go:skipped' })}
          ${statCard({ tone: 'violet', pattern: 'sparkles', icon: 'gauge', label: 'Pass rate', value: pct(latest.passRate), hint: prev?.passRate !== undefined && prev?.passRate !== null && latest.passRate !== null ? `${latest.passRate - prev.passRate >= 0 ? '+' : ''}${Math.round((latest.passRate - prev.passRate) * 10) / 10} pts vs previous` : 'Of tests that ran' })}
          ${statCard({ tone: 'cyan', pattern: 'bars', icon: 'timer', label: 'Run time', value: dur(latest.duration), hint: durDelta === null ? `${dur(avgTest)} per test` : `${durDelta >= 0 ? '+' : '−'}${dur(Math.abs(durDelta))} vs previous` })}
          ${statCard({ tone: 'info', pattern: 'bubbles', icon: 'history', label: 'Runs kept', value: num(runs.length), hint: `${num(last7)} in the last 7 days`, action: 'runs' })}
        </div>

        <div class="grid grid-2">
          ${sectionCard({
            tone: 'success',
            icon: 'checkCircle',
            title: 'Latest run results',
            description: 'Every test in the last run, and per project.',
            body: html`${statusBar(c, 'big')}${statusLegend(c)}
              <div class="table-wrap" style="margin-top:16px"><table class="data">
                <thead><tr><th>Project</th><th>Results</th><th class="fit">Tests</th><th class="fit">Time</th></tr></thead>
                <tbody>${Object.entries(byProject).map(
                  ([name, pc]) => html`<tr><td><strong>${name}</strong></td><td>${statusBar(pc, 'thin')}</td><td class="fit num">${num(pc.total)}</td><td class="fit num">${dur(pc.duration)}</td></tr>`,
                )}</tbody>
              </table></div>`,
          })}
          ${sectionCard({ tone: 'violet', icon: 'activity', title: 'Pass rate over runs', description: `Last ${chrono.length} runs, oldest on the left. Click a point to open the run.`, body: html`<div id="ch-rate"></div>` })}
        </div>
        <div class="grid grid-2">
          ${sectionCard({ tone: 'primary', icon: 'layers', title: 'Results per run', description: 'Passed, flaky, failed and skipped in each run.', body: html`<div id="ch-stack"></div>${statusLegend({ passed: chrono.reduce((s, r) => s + r.counts.passed, 0), flaky: chrono.reduce((s, r) => s + r.counts.flaky, 0), failed: chrono.reduce((s, r) => s + r.counts.failed + r.counts.timedOut, 0), skipped: chrono.reduce((s, r) => s + r.counts.skipped + r.counts.interrupted, 0) })}` })}
          ${sectionCard({ tone: 'cyan', icon: 'timer', title: 'Run time', description: 'How long each run took.', body: html`<div id="ch-dur"></div>` })}
        </div>

        <div class="grid grid-2">
          ${sectionCard({
            tone: 'danger',
            icon: 'bug',
            title: 'Problems in the latest run',
            description: 'Failed, timed out and flaky tests.',
            flush: true,
            body: failures.length
              ? html`<ul class="list">${failures.map(
                  ({ t, i }) => html`<li><button type="button" class="list-row" data-test="${i}">
                    <span class="grow"><strong class="truncate" style="display:block">${t.fullTitle}</strong><span class="muted small truncate" style="display:block">${t.project} · ${firstLine(t)}</span></span>
                    ${isKnown(t) ? html`<span class="badge badge-sm">${icon('bellOff')}Known issue</span>` : ''}${stateBadge(t.state, t.attempts, true)}${icon('chevronRight')}
                  </button></li>`,
                )}</ul>`
              : emptyState({ icon: 'checkCircle', title: 'Nothing failed', text: 'Every test passed on the first try.' }),
          })}
          ${sectionCard({
            tone: 'warning',
            icon: 'timer',
            title: 'Slowest tests in the latest run',
            description: 'Total time, including retries.',
            flush: true,
            body: html`<ul class="list">${slowest.map(
              ({ t, i }) => html`<li><button type="button" class="list-row" data-test="${i}">
                <span class="grow"><strong class="truncate" style="display:block">${t.fullTitle}</strong><span class="muted small">${t.project}</span></span>
                <span class="meter" style="width:90px"><span style="width:${Math.round((t.duration / Math.max(1, slowest[0].t.duration)) * 100)}%"></span></span>
                <span class="num nowrap" style="width:64px;text-align:right">${dur(t.duration)}</span>
              </button></li>`,
            )}</ul>`,
          })}
        </div>
        <div class="grid grid-2">
          ${historyList('Flakiest tests', 'Passed only after a retry, across all kept runs.', 'warning', 'alert', flakiest, 'flaky')}
          ${historyList('Most failing tests', 'Failed or timed out, across all kept runs.', 'danger', 'xCircle', failing, 'failed')}
        </div>
      </div>`,
    );

    lineChart(main.querySelector('#ch-rate'), {
      points: chrono.map((r, i) => ({
        label: `#${runs.length - chrono.length + i + 1}`,
        value: r.passRate,
        tip: tipRows(when(r.startedAt), [['Pass rate', pct(r.passRate)], ['Passed', num(r.counts.passed)], ['Failed', num(r.counts.failed + r.counts.timedOut)], ['Flaky', num(r.counts.flaky)]]),
        onClick: () => (location.hash = `#/runs/${encodeURIComponent(r.id)}`),
      })),
      max: 100,
      format: (v) => `${Math.round(v)}%`,
    });
    stackedBars(main.querySelector('#ch-stack'), {
      bars: chrono.map((r, i) => ({
        label: `#${runs.length - chrono.length + i + 1}`,
        parts: groups(r.counts),
        tip: tipRows(when(r.startedAt), [['Passed', num(r.counts.passed)], ['Flaky', num(r.counts.flaky)], ['Failed', num(r.counts.failed + r.counts.timedOut)], ['Skipped', num(r.counts.skipped + r.counts.interrupted)]]),
        onClick: () => (location.hash = `#/runs/${encodeURIComponent(r.id)}`),
      })),
    });
    barChart(main.querySelector('#ch-dur'), {
      bars: chrono.map((r, i) => ({
        label: `#${runs.length - chrono.length + i + 1}`,
        value: r.duration / 1000,
        tip: tipRows(when(r.startedAt), [['Run time', dur(r.duration)], ['Tests', num(r.counts.total)]]),
        onClick: () => (location.hash = `#/runs/${encodeURIComponent(r.id)}`),
      })),
      format: (v) => `${Math.round(v)}s`,
    });

    main.querySelectorAll('[data-test]').forEach((b) =>
      b.addEventListener('click', () => openTestDialog(latest, Number(b.dataset.test))),
    );
    main.querySelectorAll('[data-hist]').forEach((b) =>
      b.addEventListener('click', () => {
        const last = hist[b.dataset.hist][0];
        location.hash = `#/runs/${encodeURIComponent(last.runId)}?test=${last.index}`;
      }),
    );
    main.querySelectorAll('[data-action^="go:"]').forEach((b) =>
      b.addEventListener('click', () => (location.hash = go(b.dataset.action.slice(3)))),
    );
    main.querySelector('[data-action="runs"]')?.addEventListener('click', () => (location.hash = '#/runs'));
    main.querySelector('[data-action="rerun"]')?.addEventListener('click', () => goLaunch(rerunOptions(latest)));
    wire();
  };

  const wire = () => {
    const btn = main.querySelector('[data-action="refresh"]');
    btn?.addEventListener('click', () => spinWhile(btn, draw));
  };

  await draw().catch((e) => render(main, emptyState({ icon: 'alert', title: 'Could not load runs', text: e.message })));
}

const head = () => html`<div class="page-head">
  <div><h1>Overview</h1><p>The latest Playwright run, trends across runs, and the tests that need a look.</p></div>
  <div class="actions">${refreshButton()}<a class="btn btn-primary" href="#/launch">${icon('play')}Run tests</a></div>
</div>`;

const firstLine = (t) => {
  const e = t.results.at(-1)?.errors?.[0]?.message;
  return e ? e.split('\n').find((l) => l.trim()) ?? '' : t.state === 'flaky' ? 'Passed after a retry' : '';
};

function historyList(title, description, tone, ic, items, kind) {
  return sectionCard({
    tone,
    icon: ic,
    title,
    description,
    flush: true,
    body: items.length
      ? html`<ul class="list">${items.map((t) => {
          const [project, file, name] = t.key.split('|');
          return html`<li><button type="button" class="list-row" data-hist="${t.key}">
            <span class="grow"><strong class="truncate" style="display:block">${name}</strong><span class="muted small truncate" style="display:block">${project} · ${file}</span></span>
            <span class="badge badge-sm tone-${tone}">${num(t[kind])} of ${num(t.runs)} runs</span>${icon('chevronRight')}
          </button></li>`;
        })}</ul>`
      : emptyState({ icon: 'checkCircle', title: kind === 'flaky' ? 'No flaky tests' : 'No failures', text: 'Across all kept runs.' }),
  });
}
