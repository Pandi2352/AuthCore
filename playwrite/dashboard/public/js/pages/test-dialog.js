// Everything about one test in one run: overview, errors, steps, evidence, attempts,
// output and its history across runs.
import { api, bytes, dur, html, icon, num, raw, render, STATE, testKey, when } from '../lib.js';
import { badge, copyText, emptyState, loading, openDialog, stateBadge, tabs, tagBadge, toast } from '../ui.js';
import { goLaunch } from './common.js';

const FRIENDLY = {
  'error-context': 'Page snapshot at the failure',
  console: 'Browser console (errors and warnings)',
  'api-failures': 'Failed API calls',
  'page-url': 'Page address at the end',
  trace: 'Trace',
  screenshot: 'Screenshot',
  video: 'Video',
};
const kindOf = (a) => {
  if (a.contentType.startsWith('image/')) return 'image';
  if (a.contentType.startsWith('video/')) return 'video';
  if (a.name === 'trace' || a.contentType === 'application/zip') return 'trace';
  if (a.contentType.startsWith('text/') || a.contentType === 'application/json' || a.contentType === 'text/markdown') return 'text';
  return 'other';
};
const regexEscape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Markdown summary of a failing test (for tickets / chat). */
export function failureMarkdown(run, t) {
  const last = t.results.at(-1);
  const lines = [
    `### ${t.fullTitle}`,
    `- Result: ${STATE[t.state]?.label ?? t.state}${t.attempts > 1 ? ` (${t.attempts} tries)` : ''}`,
    `- Project: ${t.project}`,
    `- File: ${t.file}:${t.line}`,
    `- Run: ${when(run.startedAt)} (${run.id})`,
    `- Duration: ${dur(t.duration)}`,
  ];
  for (const e of last?.errors ?? []) {
    lines.push('', '```', (e.message ?? '').trim(), '```');
    if (e.location) lines.push(`at ${e.location.file}:${e.location.line}`);
  }
  return lines.join('\n');
}

export function openTestDialog(run, index, { onClose, startTab = 'overview' } = {}) {
  const t = run.tests[index];
  if (!t) return toast('That test is not in this run', 'danger');
  const allAttachments = t.results.flatMap((r) => r.attachments.filter((a) => a.file).map((a) => ({ ...a, retry: r.retry })));
  const errorCount = t.results.reduce((s, r) => s + r.errors.length, 0);
  const hasOutput = t.results.some((r) => r.stdout || r.stderr);

  const { el, close } = openDialog({
    title: t.title,
    description: html`${t.describe.length ? `${t.describe.join(' › ')} · ` : ''}${t.project} · ${t.file}:${t.line}`,
    width: 1040,
    body: html`<div class="actions" style="margin-bottom:12px">${stateBadge(t.state, t.attempts)}${badge(dur(t.duration), 'cyan', 'timer')}${t.tags.map(tagBadge)}</div>
      <div id="tdt"></div><div id="tdb"></div>`,
    footer: html`<button type="button" class="btn btn-outline" data-act="copy-title">${icon('copy')}Copy name</button>
      ${errorCount ? html`<button type="button" class="btn btn-outline" data-act="copy-md">${icon('copy')}Copy failure details</button>` : ''}
      <button type="button" class="btn btn-primary" data-act="rerun">${icon('play')}Run this test</button>`,
    onClose,
  });

  el.querySelector('[data-act="copy-title"]').addEventListener('click', () => copyText(t.fullTitle, 'Test name copied'));
  el.querySelector('[data-act="copy-md"]')?.addEventListener('click', () => copyText(failureMarkdown(run, t), 'Failure details copied'));
  el.querySelector('[data-act="rerun"]').addEventListener('click', () => {
    close();
    goLaunch({ projects: [t.project], files: [t.file], grep: regexEscape(t.title), label: `Re-run: ${t.title}`.slice(0, 80) });
  });

  const body = el.querySelector('#tdb');
  const items = [
    { id: 'overview', label: 'Overview', icon: 'list' },
    { id: 'errors', label: 'Errors', icon: 'bug', count: errorCount, countTone: errorCount ? 'danger' : undefined },
    { id: 'steps', label: 'Steps', icon: 'layers' },
    { id: 'evidence', label: 'Evidence', icon: 'image', count: allAttachments.length },
    { id: 'attempts', label: 'Attempts', icon: 'repeat', count: t.attempts },
    { id: 'output', label: 'Output', icon: 'terminal' },
    { id: 'history', label: 'History', icon: 'history' },
  ];
  const show = (id) => {
    const views = { overview, errors, steps, evidence, attempts, output, history };
    views[id](body, run, t, { allAttachments, hasOutput });
  };
  tabs(el.querySelector('#tdt'), items, items.some((i) => i.id === startTab) ? startTab : 'overview', show);
  show(items.some((i) => i.id === startTab) ? startTab : 'overview');
  return { close };
}

// ------------------------------------------------------------------- overview
function overview(body, run, t) {
  const last = t.results.at(-1);
  const kv = [
    ['Result', stateBadge(t.state, t.attempts)],
    ['Outcome', { expected: 'As expected', unexpected: 'Not as expected', flaky: 'Flaky (passed after a retry)', skipped: 'Skipped' }[t.outcome] ?? t.outcome],
    ['Test', t.fullTitle],
    ['Project', t.project],
    ['File', html`<span class="mono">${t.file}:${t.line}:${t.column}</span>`],
    ['Tags', t.tags.length ? html`<span class="chips">${t.tags.map(tagBadge)}</span>` : '—'],
    ['Annotations', t.annotations.length ? html`${t.annotations.map((a) => html`<div><strong>${a.type}</strong>${a.description ? `: ${a.description}` : ''}</div>`)}` : '—'],
    ['Expected result', t.expectedStatus],
    ['Total time', dur(t.duration)],
    ['Tries', `${num(t.attempts)} (retries allowed: ${num(t.retries)})`],
    ['Time limit', dur(t.timeout)],
    ['Repeat', t.repeatEachIndex ? `Copy #${t.repeatEachIndex + 1}` : '—'],
    ['Started', last ? when(last.startTime) : '—'],
    ['Worker', last ? `Worker ${last.workerIndex} (slot ${last.parallelIndex})` : '—'],
    ['Run', html`<a href="#/runs/${encodeURIComponent(run.id)}">${when(run.startedAt)}</a>`],
  ];
  const firstError = last?.errors?.[0];
  render(
    body,
    html`${firstError
        ? html`<div class="callout t-danger" style="margin-bottom:16px">${icon('xCircle')}<div style="min-width:0"><strong>Why it failed</strong><pre class="code wrap" style="background:none;border:0;padding:4px 0 0;max-height:160px">${(firstError.message ?? '').trim()}</pre></div></div>`
        : ''}
      <div class="kv">${kv.map(([k, v]) => html`<div>${k}</div><div>${v}</div>`)}</div>`,
  );
}

// --------------------------------------------------------------------- errors
function errors(body, run, t) {
  const blocks = t.results.filter((r) => r.errors.length);
  if (!blocks.length) return render(body, emptyState({ icon: 'checkCircle', title: 'No errors', text: 'Every try of this test finished without an error.' }));
  render(
    body,
    html`<div class="stack">${blocks.map(
      (r) => html`<div>
        <h3 style="font-size:14px;margin-bottom:8px;display:flex;gap:8px;align-items:center">Try ${r.retry + 1} ${stateBadge(r.status === 'passed' ? 'passed' : r.status, 1, true)}</h3>
        ${r.errors.map(
          (e) => html`<div class="stack" style="gap:8px;margin-bottom:14px">
            <pre class="code error">${(e.message ?? e.value ?? 'Unknown error').trim()}</pre>
            ${e.location ? html`<div class="muted small mono">at ${e.location.file}:${e.location.line}:${e.location.column}</div>` : ''}
            ${e.snippet ? html`<div><div class="small" style="font-weight:600;margin-bottom:4px">Code</div><pre class="code">${e.snippet}</pre></div>` : ''}
            ${e.cause ? html`<div class="small"><strong>Cause:</strong> ${e.cause}</div>` : ''}
            ${e.stack ? html`<details class="more"><summary>Full stack trace</summary><pre class="code">${e.stack}</pre></details>` : ''}
          </div>`,
        )}
      </div>`,
    )}</div>`,
  );
}

// ---------------------------------------------------------------------- steps
function steps(body, run, t) {
  let attempt = t.results.length - 1;
  let showApi = true;
  let showHooks = false;
  const draw = () => {
    const r = t.results[attempt];
    if (!r) return render(body, emptyState({ icon: 'layers', title: 'No steps recorded' }));
    const keep = (s) =>
      (showApi || s.category !== 'pw:api') && (showHooks || !['hook', 'fixture'].includes(s.category)) && s.category !== 'test.attach';
    const max = Math.max(1, ...flatten(r.steps).map((s) => s.duration));
    const tree = (list, depth) =>
      html`<ul class="steps">${list.filter(keep).map((s) => {
        const kids = (s.steps ?? []).filter(keep);
        const failedInside = Boolean(s.error);
        return html`<li>
          <div class="step ${s.error ? 'bad' : ''}">
            ${kids.length ? html`<button type="button" class="toggle" aria-expanded="${depth < 1 || failedInside}" aria-label="Show inner steps">${icon('chevronRight')}</button>` : html`<span class="spacer"></span>`}
            ${s.error ? icon('xCircle') : ''}
            <span class="title">${s.title}${s.location ? html` <span class="muted small mono">${s.location.file?.split('/').pop()}:${s.location.line}</span>` : ''}</span>
            ${badge(categoryLabel(s.category), categoryTone(s.category), null, true)}
            <span class="meter" style="width:70px" data-tip="${dur(s.duration)}"><span style="width:${Math.max(2, Math.round((s.duration / max) * 100))}%"></span></span>
            <span class="num small nowrap" style="width:62px;text-align:right">${dur(s.duration)}</span>
          </div>
          ${s.error ? html`<pre class="code error" style="margin:4px 0 8px 26px;max-height:140px">${s.error}</pre>` : ''}
          ${kids.length ? html`<div ${depth < 1 || failedInside ? '' : raw('hidden')}>${tree(s.steps, depth + 1)}</div>` : ''}
        </li>`;
      })}</ul>`;
    render(
      body,
      html`<div class="actions" style="margin-bottom:12px">
          ${t.results.length > 1 ? html`<div class="chips">${t.results.map((x, i) => html`<button type="button" class="chip" aria-pressed="${i === attempt}" data-try="${i}">Try ${i + 1} · ${STATE[x.status]?.label ?? x.status}</button>`)}</div>` : ''}
          <label class="switch" style="padding:6px 10px"><input type="checkbox" data-opt="api" ${showApi ? raw('checked') : ''}/><strong>Browser actions</strong></label>
          <label class="switch" style="padding:6px 10px"><input type="checkbox" data-opt="hooks" ${showHooks ? raw('checked') : ''}/><strong>Setup steps (hooks, fixtures)</strong></label>
        </div>
        ${r.steps.filter(keep).length ? tree(r.steps, 0) : emptyState({ icon: 'layers', title: 'No steps to show', text: 'Turn on the options above to see more.' })}`,
    );
    body.querySelectorAll('[data-try]').forEach((b) => b.addEventListener('click', () => ((attempt = Number(b.dataset.try)), draw())));
    body.querySelector('[data-opt="api"]').addEventListener('change', (e) => ((showApi = e.target.checked), draw()));
    body.querySelector('[data-opt="hooks"]').addEventListener('change', (e) => ((showHooks = e.target.checked), draw()));
    body.querySelectorAll('.toggle').forEach((b) =>
      b.addEventListener('click', () => {
        const open = b.getAttribute('aria-expanded') !== 'true';
        b.setAttribute('aria-expanded', String(open));
        b.closest('li').querySelector(':scope > div[hidden], :scope > div:not(.step)').hidden = !open;
      }),
    );
  };
  draw();
}
const flatten = (list) => list.flatMap((s) => [s, ...flatten(s.steps ?? [])]);
const categoryLabel = (c) => ({ 'pw:api': 'Browser', expect: 'Check', 'test.step': 'Step', hook: 'Hook', fixture: 'Setup' })[c] ?? c;
const categoryTone = (c) => ({ 'pw:api': 'info', expect: 'violet', 'test.step': 'primary', hook: 'neutral', fixture: 'neutral' })[c] ?? 'neutral';

// ------------------------------------------------------------------- evidence
function evidence(body, run, t, { allAttachments }) {
  if (!allAttachments.length) {
    return render(
      body,
      emptyState({ icon: 'image', title: 'No evidence kept', text: 'Screenshots, video, traces and logs are kept when a test fails, and console or API problems whenever they happen.' }),
    );
  }
  const url = (a) => api.fileUrl(run.id, a.file);
  const by = (k) => allAttachments.filter((a) => kindOf(a) === k);
  const label = (a) => `${FRIENDLY[a.name] ?? a.name}${t.attempts > 1 ? ` · try ${a.retry + 1}` : ''}`;
  render(
    body,
    html`<div class="stack">
      ${by('image').length
        ? html`<div><h3 style="font-size:14px;margin-bottom:8px">Screenshots</h3><div class="thumbs">${by('image').map(
            (a) => html`<button type="button" class="thumb" data-img="${url(a)}" data-label="${label(a)}"><img src="${url(a)}" alt="${label(a)}" loading="lazy"/><span>${label(a)}</span></button>`,
          )}</div></div>`
        : ''}
      ${by('video').map((a) => html`<div><h3 style="font-size:14px;margin-bottom:8px">${label(a)}</h3><video controls preload="metadata" src="${url(a)}"></video></div>`)}
      ${by('trace').length
        ? html`<div><h3 style="font-size:14px;margin-bottom:8px">Traces</h3><div class="stack" style="gap:8px">${by('trace').map(
            (a) => html`<div class="switch" style="align-items:center">${icon('zip')}<div style="flex:1"><strong>${label(a)}</strong><span>Every action, network call and page snapshot, step by step (${bytes(a.size)})</span></div>
              <button type="button" class="btn btn-primary btn-sm" data-trace="${a.file}">${icon('external')}Open in Trace Viewer</button>
              <a class="btn btn-outline btn-sm" href="${url(a)}?download">${icon('download')}Download</a></div>`,
          )}</div></div>`
        : ''}
      ${by('text').map(
        (a) => html`<div><h3 style="font-size:14px;margin-bottom:8px;display:flex;gap:8px;align-items:center">${icon(a.name === 'console' ? 'message' : a.name === 'api-failures' ? 'network' : 'file')}${label(a)}
            <a class="icon-btn tone-primary" href="${url(a)}?download" data-tip="Download" aria-label="Download">${icon('download')}</a></h3>
          <pre class="code wrap" data-text="${url(a)}">Loading…</pre></div>`,
      )}
      ${by('other').length
        ? html`<div><h3 style="font-size:14px;margin-bottom:8px">Other files</h3><ul class="list">${by('other').map(
            (a) => html`<li class="list-row">${icon('file')}<span class="grow">${label(a)} <span class="muted small">${a.contentType} · ${bytes(a.size)}</span></span><a class="btn btn-outline btn-sm" href="${url(a)}?download">${icon('download')}Download</a></li>`,
          )}</ul></div>`
        : ''}
    </div>`,
  );
  body.querySelectorAll('[data-text]').forEach(async (pre) => {
    try {
      const text = await api.text(pre.dataset.text);
      pre.textContent = text.length > 200_000 ? `${text.slice(0, 200_000)}\n… (cut; download for the full file)` : text || '(empty)';
    } catch (e) {
      pre.textContent = e.message;
    }
  });
  body.querySelectorAll('[data-img]').forEach((b) =>
    b.addEventListener('click', () =>
      openDialog({
        title: b.dataset.label,
        width: 1200,
        body: html`<div class="lightbox"><img src="${b.dataset.img}" alt="${b.dataset.label}"/></div>`,
        footer: html`<a class="btn btn-outline" href="${b.dataset.img}?download">${icon('download')}Download</a>`,
      }),
    ),
  );
  body.querySelectorAll('[data-trace]').forEach((b) =>
    b.addEventListener('click', async () => {
      b.disabled = true;
      try {
        await api.openTrace(run.id, b.dataset.trace);
        toast('Trace Viewer is opening in a new window');
      } catch (e) {
        toast(e.message, 'danger');
      } finally {
        b.disabled = false;
      }
    }),
  );
}

// ------------------------------------------------------------------- attempts
function attempts(body, run, t) {
  render(
    body,
    html`<div class="table-wrap"><table class="data">
      <thead><tr><th class="sno">Try</th><th>Result</th><th>Started</th><th class="fit">Time</th><th class="fit">Worker</th><th>Error</th><th class="fit">Files</th></tr></thead>
      <tbody>${t.results.map(
        (r) => html`<tr>
          <td class="sno">${r.retry + 1}</td>
          <td>${stateBadge(r.status === 'passed' ? 'passed' : r.status, 1, true)}</td>
          <td class="nowrap">${when(r.startTime)}</td>
          <td class="fit num">${dur(r.duration)}</td>
          <td class="fit">${r.workerIndex} / ${r.parallelIndex}</td>
          <td><span class="small">${(r.errors[0]?.message ?? '—').split('\n')[0]}</span></td>
          <td class="fit num">${num(r.attachments.length)}</td>
        </tr>`,
      )}</tbody></table></div>
      ${t.results.some((r) => r.annotations?.length)
        ? html`<h3 style="font-size:14px;margin:16px 0 8px">Notes added while running</h3>${t.results.flatMap((r) => r.annotations.map((a) => html`<div class="small">Try ${r.retry + 1}: <strong>${a.type}</strong> ${a.description ?? ''}</div>`))}`
        : ''}`,
  );
}

// --------------------------------------------------------------------- output
function output(body, run, t, { hasOutput }) {
  if (!hasOutput) return render(body, emptyState({ icon: 'terminal', title: 'Nothing printed', text: 'The test wrote nothing to the console (console.log or errors).' }));
  render(
    body,
    html`<div class="stack">${t.results.map(
      (r) => html`${r.stdout ? html`<div><h3 style="font-size:14px;margin-bottom:8px">Try ${r.retry + 1}: output</h3><pre class="code">${r.stdout}</pre></div>` : ''}
        ${r.stderr ? html`<div><h3 style="font-size:14px;margin-bottom:8px">Try ${r.retry + 1}: errors</h3><pre class="code error">${r.stderr}</pre></div>` : ''}`,
    )}</div>`,
  );
}

// -------------------------------------------------------------------- history
async function history(body, run, t) {
  render(body, loading('Loading history…'));
  const all = await api.history().catch(() => ({}));
  const list = all[testKey(t)] ?? [];
  if (!list.length) return render(body, emptyState({ icon: 'history', title: 'No history yet' }));
  const ran = list.filter((h) => h.state !== 'skipped');
  const ok = ran.filter((h) => h.state === 'passed' || h.state === 'flaky').length;
  const avg = ran.length ? ran.reduce((s, h) => s + h.duration, 0) / ran.length : 0;
  render(
    body,
    html`<div class="grid grid-stats" style="margin-bottom:16px">
        <div class="switch"><div><strong>${num(list.length)}</strong><span>Runs kept with this test</span></div></div>
        <div class="switch"><div><strong>${ran.length ? `${Math.round((ok / ran.length) * 100)}%` : '—'}</strong><span>Passed</span></div></div>
        <div class="switch"><div><strong>${num(list.filter((h) => h.state === 'flaky').length)}</strong><span>Times flaky</span></div></div>
        <div class="switch"><div><strong>${dur(avg)}</strong><span>Average time</span></div></div>
      </div>
      <div class="hist" style="margin-bottom:16px;flex-wrap:wrap" aria-label="Results, oldest to newest">${[...list].reverse().map(
        (h) => html`<i class="c-${STATE[h.state]?.bar ?? 'skipped'}" data-tip="${`${when(h.startedAt)}: ${STATE[h.state]?.label ?? h.state}, ${dur(h.duration)}`}"></i>`,
      )}</div>
      <div class="table-wrap"><table class="data">
        <thead><tr><th class="sno">S.No</th><th>Run</th><th>Result</th><th class="fit">Time</th><th>Error</th><th class="fit"></th></tr></thead>
        <tbody>${list.map(
          (h, i) => html`<tr>
            <td class="sno">${i + 1}</td>
            <td class="nowrap">${when(h.startedAt)}${h.runId === run.id ? html` ${badge('This run', 'primary', null, true)}` : ''}</td>
            <td>${stateBadge(h.state, h.attempts, true)}</td>
            <td class="fit num">${dur(h.duration)}</td>
            <td><span class="small">${h.error ?? '—'}</span></td>
            <td class="fit">${h.runId === run.id ? '' : html`<a class="icon-btn tone-primary" href="#/runs/${encodeURIComponent(h.runId)}?test=${h.index}" data-tip="Open" aria-label="Open this run">${icon('eye')}</a>`}</td>
          </tr>`,
        )}</tbody></table></div>`,
  );
}

