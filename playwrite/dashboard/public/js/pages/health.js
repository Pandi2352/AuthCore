// Test health: problems in the tests themselves (focused or skipped tests, fixed waits,
// tests that check nothing, tests close to their time limit).
import { api, html, icon, num, render } from '../lib.js';
import { badge, emptyState, loading, refreshButton, sectionCard, spinWhile, statCard, toast } from '../ui.js';

const KINDS = {
  only: { label: 'Only this test runs', tone: 'danger', icon: 'target' },
  pause: { label: 'page.pause() left in', tone: 'danger', icon: 'pause' },
  'list-error': { label: 'Tests could not be listed', tone: 'danger', icon: 'xCircle' },
  skip: { label: 'Skipped', tone: 'warning', icon: 'skip' },
  sleep: { label: 'Fixed waits', tone: 'warning', icon: 'clock' },
  'no-checks': { label: 'Checks nothing', tone: 'warning', icon: 'checkCircle' },
  'near-timeout': { label: 'Close to the time limit', tone: 'warning', icon: 'timer' },
};

export async function page(main) {
  render(main, loading('Reading the tests…'));
  const draw = async () => {
    const h = await api.health();
    const by = (k) => h.issues.filter((i) => i.kind === k);
    const danger = h.issues.filter((i) => i.severity === 'danger').length;
    render(
      main,
      html`<div class="page-head">
          <div><h1>Test health</h1><p>Problems in the tests themselves, from reading the test files and the latest run.</p></div>
          <div class="actions">${refreshButton()}</div>
        </div>
        <div class="stack">
          <div class="grid grid-stats">
            ${statCard({ tone: danger ? 'danger' : 'success', pattern: 'stripes', icon: danger ? 'alert' : 'checkCircle', label: 'Must fix', value: num(danger), hint: '.only, page.pause()' })}
            ${statCard({ tone: 'warning', pattern: 'dots', icon: 'alert', label: 'Worth a look', value: num(h.issues.length - danger), hint: 'Skipped, fixed waits, no checks' })}
            ${statCard({ tone: 'primary', pattern: 'rings', icon: 'flask', label: 'Test files', value: num(h.files.length), hint: `${num(h.files.reduce((s, f) => s + f.tests, 0))} tests (per project)` })}
          </div>
          ${h.issues.length
            ? Object.entries(KINDS)
                .filter(([k]) => by(k).length)
                .map(([k, meta]) =>
                  sectionCard({
                    tone: meta.tone,
                    icon: meta.icon,
                    title: `${meta.label} (${num(by(k).length)})`,
                    description: by(k)[0].text && k !== 'no-checks' && k !== 'near-timeout' ? by(k)[0].text : '',
                    flush: true,
                    body: html`<ul class="list">${by(k).map(
                      (i) => html`<li class="list-row">
                        <span class="grow">${i.file ? html`<strong class="mono small" style="display:block">${i.file}${i.line ? `:${i.line}` : ''}</strong>` : ''}
                          ${i.code ? html`<code class="small">${i.code}</code>` : html`<span class="small">${i.text}</span>`}</span>
                        ${i.runId ? html`<a class="icon-btn tone-primary" href="#/runs/${encodeURIComponent(i.runId)}?test=${i.index}" data-tip="Open in the run" aria-label="Open in the run">${icon('eye')}</a>` : ''}
                      </li>`,
                    )}</ul>`,
                  }),
                )
            : html`<div class="section t-success"><div class="body">${emptyState({ icon: 'checkCircle', title: 'The tests look healthy', text: 'No focused or skipped tests, fixed waits, or tests without checks.' })}</div></div>`}
          ${sectionCard({
            tone: 'cyan',
            icon: 'folder',
            title: 'Tests per file',
            flush: true,
            body: html`<ul class="list">${h.files.map((f) => html`<li class="list-row"><span class="grow mono small">${f.file}</span>${badge(`${num(f.tests)} tests`, 'cyan', null, true)}</li>`)}</ul>`,
          })}
        </div>`,
    );
    const btn = main.querySelector('[data-action="refresh"]');
    btn.addEventListener('click', () => spinWhile(btn, () => draw().catch((e) => toast(e.message, 'danger'))));
  };
  await draw().catch((e) => render(main, emptyState({ icon: 'alert', title: 'Could not check the tests', text: e.message })));
  return null;
}
