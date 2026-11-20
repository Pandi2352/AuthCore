// One run as a single self-contained HTML file: summary, problems with their errors and
// screenshots, every test, and where it ran. Opens anywhere; "Print" saves it as a PDF.
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import { escapeHtml as e, RUNS } from './util.mjs';

const LABEL = { passed: 'Passed', failed: 'Failed', timedOut: 'Timed out', flaky: 'Flaky', skipped: 'Skipped', interrupted: 'Interrupted' };
const TONE = { passed: 'ok', flaky: 'warn', failed: 'bad', timedOut: 'bad', skipped: 'muted', interrupted: 'muted' };
const MAX_IMAGE = 1_500_000;
const MAX_IMAGES = 40;

function dur(ms) {
  if (ms === null || ms === undefined) return '—';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)} s`;
  return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
}
const when = (iso) => (iso ? new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

export function exportRun(run, { print = false } = {}) {
  const c = run.counts;
  const problems = run.tests.map((t, i) => ({ t, i })).filter(({ t }) => ['failed', 'timedOut', 'flaky', 'interrupted'].includes(t.state));
  let images = 0;
  const imageFor = (t) => {
    if (images >= MAX_IMAGES) return '';
    const shot = t.results.flatMap((r) => r.attachments).find((a) => a.file && a.contentType.startsWith('image/') && a.name !== 'page-screenshot');
    if (!shot) return '';
    const file = path.join(RUNS, run.id, 'attachments', shot.file);
    if (!existsSync(file) || statSync(file).size > MAX_IMAGE) return '';
    images++;
    return `<img alt="Screenshot of the failure" src="data:${e(shot.contentType)};base64,${readFileSync(file).toString('base64')}">`;
  };
  const bar = ['passed', 'flaky', 'failed', 'skipped']
    .map((k) => {
      const n = k === 'failed' ? c.failed + c.timedOut : k === 'skipped' ? c.skipped + c.interrupted : c[k];
      return n ? `<span class="${TONE[k]}" style="flex:${n}"></span>` : '';
    })
    .join('');
  const env = run.environment ?? {};
  const title = run.label || `Run of ${when(run.startedAt)}`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(title)} · AuthCore Playwright run</title>
<style>
:root{--ok:#2f9e44;--warn:#e8890c;--bad:#e03131;--muted:#868e96;--ink:#1f2937;--soft:#6b7280;--line:#e5e7eb;--bg:#fff;--panel:#f8fafc}
*{box-sizing:border-box}body{margin:0;font:14px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--ink);background:var(--bg)}
main{max-width:1100px;margin:0 auto;padding:28px 20px 60px}h1{font-size:24px;margin:0 0 4px}h2{font-size:17px;margin:32px 0 12px}h3{font-size:15px;margin:0 0 6px}
.muted{color:var(--soft)}.meta{display:flex;flex-wrap:wrap;gap:6px 18px;color:var(--soft);margin:6px 0 18px}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px}.card{border:1px solid var(--line);border-radius:10px;padding:12px 14px;background:var(--panel)}
.card b{display:block;font-size:22px}.bar{display:flex;gap:2px;height:12px;border-radius:6px;overflow:hidden;margin:16px 0 6px;background:var(--line)}
.bar .ok{background:var(--ok)}.bar .warn{background:var(--warn)}.bar .bad{background:var(--bad)}.bar .muted{background:var(--muted)}
.badge{display:inline-block;padding:1px 8px;border-radius:999px;font-size:12px;font-weight:600;border:1px solid}.badge.ok{color:var(--ok)}.badge.warn{color:var(--warn)}.badge.bad{color:var(--bad)}.badge.muted{color:var(--muted)}
.problem{border:1px solid var(--line);border-left:4px solid var(--bad);border-radius:10px;padding:14px;margin-bottom:12px;break-inside:avoid}.problem.warn{border-left-color:var(--warn)}
pre{background:#0f172a;color:#e2e8f0;padding:10px 12px;border-radius:8px;overflow:auto;white-space:pre-wrap;word-break:break-word;font:12px/1.5 ui-monospace,Consolas,monospace;max-height:320px}
img{max-width:100%;border:1px solid var(--line);border-radius:8px;margin-top:8px}
table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:7px 8px;border-bottom:1px solid var(--line);vertical-align:top}th{font-size:12px;color:var(--soft);text-transform:uppercase;letter-spacing:.03em}tbody tr:nth-child(even){background:var(--panel)}
.mono{font-family:ui-monospace,Consolas,monospace;font-size:12px}.kv{display:grid;grid-template-columns:200px 1fr;gap:6px 14px}.kv div:nth-child(odd){color:var(--soft)}
.print{position:fixed;right:16px;top:16px;padding:8px 14px;border-radius:8px;border:1px solid var(--line);background:#fff;cursor:pointer;font:inherit}
@media print{.print{display:none}main{padding:0}pre{max-height:none}}
@media (max-width:640px){.kv{grid-template-columns:1fr}}
</style></head><body>
<button class="print" onclick="window.print()">Print / save as PDF</button>
<main>
<h1>${e(title)}</h1>
<div class="meta"><span>${e(when(run.startedAt))}</span><span>${e(dur(run.duration))}</span><span>${e(env.target ?? '')}</span>${run.branch ? `<span>${e(run.branch)}${run.commit ? ` @ ${e(run.commit)}` : ''}</span>` : ''}<span>Result: ${e(LABEL[run.status] ?? run.status)}</span></div>
<div class="cards">
<div class="card">Tests<b>${c.total}</b></div><div class="card">Passed<b>${c.passed}</b></div><div class="card">Failed<b>${c.failed + c.timedOut}</b></div>
<div class="card">Flaky<b>${c.flaky}</b></div><div class="card">Skipped<b>${c.skipped + c.interrupted}</b></div><div class="card">Pass rate<b>${run.passRate ?? '—'}${run.passRate === null ? '' : '%'}</b></div>
</div>
<div class="bar">${bar}</div>
<div class="muted">Passed ${c.passed} · Flaky ${c.flaky} · Failed ${c.failed + c.timedOut} · Skipped ${c.skipped + c.interrupted}</div>

<h2>Problems (${problems.length})</h2>
${problems.length ? problems.map(({ t }) => {
    const err = t.results.flatMap((r) => r.errors)[0];
    return `<div class="problem ${t.state === 'flaky' ? 'warn' : ''}"><h3>${e(t.fullTitle)} <span class="badge ${TONE[t.state]}">${e(LABEL[t.state])}${t.attempts > 1 ? ` · ${t.attempts} tries` : ''}</span></h3>
<div class="muted mono">${e(t.project)} · ${e(t.file)}:${t.line} · ${e(dur(t.duration))}</div>
${err ? `<pre>${e((err.message ?? '').trim())}</pre>` : '<p class="muted">Passed after a retry.</p>'}${imageFor(t)}</div>`;
  }).join('\n') : '<p class="muted">Nothing failed.</p>'}

<h2>Every test (${run.tests.length})</h2>
<table><thead><tr><th>#</th><th>Test</th><th>Project</th><th>Result</th><th>Time</th></tr></thead><tbody>
${run.tests.map((t, i) => `<tr><td>${i + 1}</td><td>${e(t.fullTitle)}<div class="mono muted">${e(t.file)}:${t.line}</div></td><td>${e(t.project)}</td><td><span class="badge ${TONE[t.state]}">${e(LABEL[t.state])}</span></td><td>${e(dur(t.duration))}</td></tr>`).join('\n')}
</tbody></table>

<h2>Where it ran</h2>
<div class="kv">
<div>Target</div><div>${e(env.target ?? '—')} (${e(env.baseURL ?? '')})</div>
<div>Command</div><div class="mono">${e(env.command ?? '—')}</div>
<div>Playwright</div><div>${e(env.playwright ?? '—')}</div>
<div>Node.js</div><div>${e(env.node ?? '—')}</div>
<div>System</div><div>${e(env.os ?? '—')}</div>
<div>Last commit</div><div>${e(env.gitMessage ?? '—')}</div>
<div>Run id</div><div class="mono">${e(run.id)}</div>
</div>
<p class="muted" style="margin-top:28px">Exported from the AuthCore test dashboard on ${e(when(new Date().toISOString()))}.${images ? '' : ''}</p>
</main>${print ? '<script>addEventListener("load",()=>setTimeout(()=>print(),300))</script>' : ''}
</body></html>`;
}
