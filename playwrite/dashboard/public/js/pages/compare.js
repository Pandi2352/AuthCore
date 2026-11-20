// Compare two runs: what newly failed, what got fixed, what got slower or faster.
import { setQuery } from '../app.js';
import { api, dur, getRun, html, icon, num, pct, render, testKey, when } from '../lib.js';
import { dropdown, emptyState, loading, sectionCard, stateBadge, statCard } from '../ui.js';
import { runTitle } from './common.js';

const BAD = ['failed', 'timedOut'];
const OK = ['passed', 'flaky'];

export async function page(main, _params, query) {
  render(main, loading());
  const runs = (await api.runs().catch(() => [])).filter((r) => r.status !== 'interrupted' || r.counts.total);
  if (runs.length < 2) {
    render(main, html`${head()}<div class="section t-neutral"><div class="body">${emptyState({ icon: 'compare', title: 'Needs two runs', text: 'Run the tests at least twice to compare.' , action: html`<a class="btn btn-primary" href="#/launch">${icon('play')}Run tests</a>` })}</div></div>`);
    return null;
  }
  let b = runs.some((r) => r.id === query.get('b')) ? query.get('b') : runs[0].id;
  let a = runs.some((r) => r.id === query.get('a')) ? query.get('a') : runs.find((r) => r.id !== b)?.id;

  render(
    main,
    html`${head()}
      <div class="stack">
        <div class="section t-primary"><div class="body">
          <div class="inline-form">
            <div class="form-row"><span class="label">Before</span><div data-dd="a"></div></div>
            <button type="button" class="btn btn-outline" data-swap aria-label="Swap the runs">${icon('repeat')}Swap</button>
            <div class="form-row"><span class="label">After</span><div data-dd="b"></div></div>
          </div>
        </div></div>
        <div id="cmp"></div>
      </div>`,
  );
  const options = runs.map((r) => ({ value: r.id, label: runTitle(r), hint: pct(r.passRate) }));
  const ddA = dropdown(main.querySelector('[data-dd="a"]'), { options, value: a, label: 'Before', width: '280px', onChange: (v) => ((a = v), draw()) });
  const ddB = dropdown(main.querySelector('[data-dd="b"]'), { options, value: b, label: 'After', width: '280px', onChange: (v) => ((b = v), draw()) });
  main.querySelector('[data-swap]').addEventListener('click', () => {
    [a, b] = [b, a];
    ddA.set(a);
    ddB.set(b);
    draw();
  });

  async function draw() {
    setQuery({ a, b });
    const box = main.querySelector('#cmp');
    if (a === b) return render(box, html`<div class="callout t-warning">${icon('alert')}<div>Pick two different runs.</div></div>`);
    render(box, loading());
    const [ra, rb] = await Promise.all([getRun(a), getRun(b)]);
    const mapA = new Map(ra.tests.map((t, i) => [testKey(t), { t, i }]));
    const mapB = new Map(rb.tests.map((t, i) => [testKey(t), { t, i }]));
    const pairs = [...new Set([...mapA.keys(), ...mapB.keys()])].map((k) => ({ k, before: mapA.get(k), after: mapB.get(k) }));
    const both = pairs.filter((p) => p.before && p.after);
    const groups = {
      newFail: both.filter((p) => BAD.includes(p.after.t.state) && !BAD.includes(p.before.t.state)),
      fixed: both.filter((p) => BAD.includes(p.before.t.state) && OK.includes(p.after.t.state)),
      still: both.filter((p) => BAD.includes(p.before.t.state) && BAD.includes(p.after.t.state)),
      newFlaky: both.filter((p) => p.after.t.state === 'flaky' && p.before.t.state !== 'flaky'),
      added: pairs.filter((p) => !p.before),
      removed: pairs.filter((p) => !p.after),
      slower: both.filter((p) => OK.includes(p.after.t.state) && p.after.t.duration > 1000 && p.after.t.duration > p.before.t.duration * 1.3).sort((x, y) => y.after.t.duration - y.before.t.duration - (x.after.t.duration - x.before.t.duration)),
      faster: both.filter((p) => p.before.t.duration > 1000 && p.after.t.duration < p.before.t.duration * 0.7).sort((x, y) => x.after.t.duration - x.before.t.duration - (y.after.t.duration - y.before.t.duration)),
    };
    const delta = (x, y, fmt, betterWhenLower) => {
      if (x === null || x === undefined || y === null || y === undefined) return '—';
      const d = y - x;
      if (!d) return 'No change';
      const better = betterWhenLower ? d < 0 : d > 0;
      return html`<span class="${better ? 'delta-down' : 'delta-up'}">${d > 0 ? '+' : '−'}${fmt(Math.abs(d))}</span> vs before`;
    };
    const link = (run, entry) => `#/runs/${encodeURIComponent(run.id)}?test=${entry.i}`;
    const list = (items, kind) =>
      items.length
        ? html`<ul class="list">${items.slice(0, 100).map(({ before, after }) => {
            const t = (after ?? before).t;
            return html`<li class="list-row">
              <span class="grow"><strong class="truncate" style="display:block">${t.fullTitle}</strong><span class="muted small">${t.project} · ${t.file}</span></span>
              ${before ? html`<a href="${link(ra, before)}" data-tip="Before">${stateBadge(before.t.state, before.t.attempts, true)}</a>` : html`<span class="badge badge-sm">Not there</span>`}
              ${icon('chevronRight')}
              ${after ? html`<a href="${link(rb, after)}" data-tip="After">${stateBadge(after.t.state, after.t.attempts, true)}</a>` : html`<span class="badge badge-sm">Gone</span>`}
              ${kind === 'time' ? html`<span class="nowrap small" style="width:150px;text-align:right">${dur(before.t.duration)} → <strong>${dur(after.t.duration)}</strong></span>` : ''}
            </li>`;
          })}</ul>`
        : emptyState({ icon: 'checkCircle', title: 'None' });
    render(
      box,
      html`<div class="stack">
        <div class="grid grid-stats">
          ${statCard({ tone: 'violet', pattern: 'sparkles', icon: 'gauge', label: 'Pass rate', value: pct(rb.passRate), hint: delta(ra.passRate, rb.passRate, (v) => `${Math.round(v * 10) / 10} pts`, false) })}
          ${statCard({ tone: 'cyan', pattern: 'bars', icon: 'timer', label: 'Run time', value: dur(rb.duration), hint: delta(ra.duration, rb.duration, dur, true) })}
          ${statCard({ tone: 'danger', pattern: 'stripes', icon: 'xCircle', label: 'Newly failing', value: num(groups.newFail.length), hint: `${num(groups.still.length)} still failing` })}
          ${statCard({ tone: 'success', pattern: 'waves', icon: 'checkCircle', label: 'Fixed', value: num(groups.fixed.length), hint: 'Failed before, pass now' })}
          ${statCard({ tone: 'warning', pattern: 'dots', icon: 'alert', label: 'Newly flaky', value: num(groups.newFlaky.length), hint: 'Needed a retry now' })}
          ${statCard({ tone: 'primary', pattern: 'rings', icon: 'flask', label: 'Tests', value: num(rb.counts.total), hint: `${num(groups.added.length)} new · ${num(groups.removed.length)} gone` })}
        </div>
        <div class="grid grid-2" style="align-items:start">
          ${sectionCard({ tone: 'danger', icon: 'xCircle', title: `Newly failing (${num(groups.newFail.length)})`, description: 'Passed or skipped before, fail now.', flush: true, body: list(groups.newFail) })}
          ${sectionCard({ tone: 'success', icon: 'checkCircle', title: `Fixed (${num(groups.fixed.length)})`, description: 'Failed before, pass now.', flush: true, body: list(groups.fixed) })}
          ${sectionCard({ tone: 'danger', icon: 'bug', title: `Still failing (${num(groups.still.length)})`, flush: true, body: list(groups.still) })}
          ${sectionCard({ tone: 'warning', icon: 'alert', title: `Newly flaky (${num(groups.newFlaky.length)})`, flush: true, body: list(groups.newFlaky) })}
          ${sectionCard({ tone: 'cyan', icon: 'timer', title: `Slower (${num(groups.slower.length)})`, description: 'At least 30% slower (tests over 1 s).', flush: true, body: list(groups.slower, 'time') })}
          ${sectionCard({ tone: 'success', icon: 'zap', title: `Faster (${num(groups.faster.length)})`, description: 'At least 30% faster.', flush: true, body: list(groups.faster, 'time') })}
          ${sectionCard({ tone: 'primary', icon: 'plus', title: `New tests (${num(groups.added.length)})`, flush: true, body: list(groups.added) })}
          ${sectionCard({ tone: 'neutral', icon: 'trash', title: `Tests no longer there (${num(groups.removed.length)})`, flush: true, body: list(groups.removed) })}
        </div>
        <p class="muted small">Before: ${runTitle(ra)} (${when(ra.startedAt)}) · After: ${runTitle(rb)} (${when(rb.startedAt)})</p>
      </div>`,
    );
  }
  await draw();
  return null;
}

const head = () => html`<div class="page-head"><div><h1>Compare runs</h1><p>Pick two runs to see what newly failed, what got fixed, and what got slower or faster.</p></div></div>`;
