// Schedules: run tests every N minutes or daily at a time, while the dashboard is running.
import { ago, api, html, icon, num, raw, render, when } from '../lib.js';
import { confirmDialog, dataTable, dropdown, emptyState, iconAction, loading, openDialog, sectionCard, statCard, toast } from '../ui.js';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const BUILT_IN = [
  { value: 'smoke', label: 'Smoke tests (@smoke)', options: { tags: ['@smoke'] } },
  { value: 'all', label: 'Every test', options: {} },
  { value: 'desktop', label: 'Desktop only', options: { projects: ['chromium', 'public'] } },
  { value: 'phone', label: 'Phone only', options: { projects: ['mobile'] } },
];

const describeWhen = (s) =>
  s.mode === 'interval'
    ? s.everyMinutes % 1440 === 0
      ? `Every ${s.everyMinutes / 1440} day${s.everyMinutes === 1440 ? '' : 's'}`
      : s.everyMinutes % 60 === 0
        ? `Every ${s.everyMinutes / 60} hour${s.everyMinutes === 60 ? '' : 's'}`
        : `Every ${s.everyMinutes} minutes`
    : `${s.days?.length && s.days.length < 7 ? s.days.map((d) => DAYS[d]).join(', ') : 'Daily'} at ${s.at}`;

export async function page(main) {
  render(main, loading());
  let list = [];
  let presets = [];
  let env = null;
  const load = async () => {
    [list, presets, env] = await Promise.all([api.schedules(), api.presets().catch(() => []), api.environment().catch(() => null)]);
  };
  await load().catch((e) => toast(e.message, 'danger'));

  render(
    main,
    html`<div class="page-head">
        <div><h1>Schedules</h1><p>Run tests on their own: every few minutes, or daily at a set time. Results land in Runs like any other run, marked "Scheduled".</p></div>
        <div class="actions"><button type="button" class="btn btn-primary" data-new>${icon('plus')}New schedule</button></div>
      </div>
      <div class="stack">
        <div class="callout t-info">${icon('clock')}<div>Schedules run while this dashboard is running (<code>npm run dashboard</code>). A run that is due while another is going starts right after it. Times are this computer's local time.</div></div>
        <div class="grid grid-stats" id="cards"></div>
        ${sectionCard({ tone: 'primary', icon: 'calendar', title: 'Schedules', flush: true, body: html`<div id="table"></div>` })}
      </div>`,
  );

  const what = (s) => {
    const p = presets.find((x) => x.id === s.source);
    return p ? `Saved: ${p.name}` : (BUILT_IN.find((b) => b.value === s.source)?.label ?? 'Custom choice');
  };
  const table = dataTable(main.querySelector('#table'), {
    rows: list,
    pageSize: 20,
    empty: emptyState({ icon: 'calendar', title: 'No schedules yet', text: 'Make one to run the smoke tests every hour, or everything every night.', action: html`<button type="button" class="btn btn-primary" data-new>${icon('plus')}New schedule</button>` }),
    columns: [
      { key: 'name', label: 'Schedule', className: 'wide', render: (s) => html`<div class="two-line"><strong>${s.name}</strong><span>${what(s)} · ${s.options?.target === 'dev' ? 'Dev servers' : 'Test environment'}${s.startEnv ? ' (starts it if needed)' : ''}</span></div>`, sort: (s) => s.name },
      { key: 'when', label: 'When', className: 'fit nowrap', render: (s) => describeWhen(s) },
      { key: 'next', label: 'Next run', className: 'fit nowrap', render: (s) => (s.enabled && s.nextRunAt ? html`<span data-tip="${when(s.nextRunAt)}">${new Date(s.nextRunAt) <= new Date() ? 'Due now' : `in ${until(s.nextRunAt)}`}</span>` : html`<span class="muted">Paused</span>`), sort: (s) => s.nextRunAt ?? 'z' },
      {
        key: 'last',
        label: 'Last run',
        className: 'fit nowrap',
        render: (s) =>
          s.lastError
            ? html`<span class="badge badge-sm tone-danger" data-tip="${s.lastError}">${icon('x')}Did not start</span>`
            : s.lastRunId
              ? html`<a href="#/runs/${encodeURIComponent(s.lastRunId)}">${s.lastExitCode === 0 ? html`<span class="badge badge-sm tone-success">${icon('check')}Passed</span>` : html`<span class="badge badge-sm tone-danger">${icon('x')}Failed</span>`} ${ago(s.lastRunAt)}</a>`
              : s.lastRunAt
                ? ago(s.lastRunAt)
                : html`<span class="muted">Not yet</span>`,
        sort: (s) => s.lastRunAt ?? '',
      },
      { key: 'on', label: 'On', className: 'fit', render: (s) => html`<label class="switch" style="padding:4px 8px;border:0"><input type="checkbox" data-toggle="${s.id}" ${s.enabled ? raw('checked') : ''} aria-label="Turn ${s.name} on or off"/></label>` },
      {
        key: 'act',
        label: '',
        className: 'fit',
        render: (s) => html`<div class="row-actions">${iconAction(`now:${s.id}`, 'play', 'Run now', 'success')}${iconAction(`edit:${s.id}`, 'edit', 'Edit')}${iconAction(`del:${s.id}`, 'trash', 'Delete', 'danger')}</div>`,
      },
    ],
    sort: { key: 'next', dir: 'asc' },
  });

  const drawCards = () => {
    const on = list.filter((s) => s.enabled);
    const next = on.map((s) => s.nextRunAt).filter(Boolean).sort()[0];
    const lastRuns = list.filter((s) => s.lastRunId);
    render(
      main.querySelector('#cards'),
      html`${statCard({ tone: 'primary', pattern: 'rings', icon: 'calendar', label: 'Schedules', value: num(list.length), hint: `${num(on.length)} turned on` })}
        ${statCard({ tone: 'cyan', pattern: 'bars', icon: 'clock', label: 'Next run', value: next ? (new Date(next) <= new Date() ? 'Due now' : `in ${until(next)}`) : '—', hint: next ? when(next) : 'Nothing planned' })}
        ${statCard({ tone: 'success', pattern: 'waves', icon: 'checkCircle', label: 'Last runs passed', value: `${num(lastRuns.filter((s) => s.lastExitCode === 0).length)} of ${num(lastRuns.length)}`, hint: 'Latest run of each schedule' })}`,
    );
  };
  const refresh = async () => {
    await load();
    table.setRows(list, false);
    drawCards();
  };
  drawCards();

  main.addEventListener('click', async (e) => {
    if (e.target.closest('[data-new]')) return edit(null);
    const b = e.target.closest('[data-action]');
    if (!b) return;
    const [act, id] = b.dataset.action.split(':');
    const s = list.find((x) => x.id === id);
    if (!s) return;
    if (act === 'edit') edit(s);
    if (act === 'now') {
      try {
        await api.start({ ...s.options, label: `Scheduled: ${s.name} (started by hand)`.slice(0, 80) });
        toast('Run started');
        location.hash = '#/launch';
      } catch (err) {
        toast(err.message, 'danger');
      }
    }
    if (act === 'del') {
      if (!(await confirmDialog({ title: `Delete "${s.name}"?`, text: 'It stops running. Runs it already made stay in the history.', confirmLabel: 'Delete' }))) return;
      await api.deleteSchedule(id).catch((err) => toast(err.message, 'danger'));
      toast('Schedule deleted');
      refresh();
    }
  });
  main.addEventListener('change', async (e) => {
    const t = e.target.closest('[data-toggle]');
    if (!t) return;
    const s = list.find((x) => x.id === t.dataset.toggle);
    try {
      await api.saveSchedule({ ...s, enabled: t.checked });
      toast(t.checked ? 'Schedule turned on' : 'Schedule paused');
      refresh();
    } catch (err) {
      toast(err.message, 'danger');
    }
  });

  function edit(s) {
    const form = {
      name: s?.name ?? '',
      source: s?.source ?? 'smoke',
      target: s?.options?.target ?? env?.target ?? 'test',
      mode: s?.mode ?? 'interval',
      everyMinutes: s?.everyMinutes ?? 60,
      at: s?.at ?? '02:00',
      days: s?.days ?? [],
      startEnv: s?.startEnv ?? true,
      enabled: s?.enabled ?? true,
    };
    const sources = [...BUILT_IN.map((b) => ({ value: b.value, label: b.label })), ...presets.map((p) => ({ value: p.id, label: `Saved: ${p.name}` }))];
    const { el, close } = openDialog({
      title: s ? 'Edit schedule' : 'New schedule',
      width: 600,
      body: html`<div class="stack" style="gap:14px">
        <div class="form-row"><label for="s-name">Name</label><input class="input" id="s-name" maxlength="60" value="${form.name}" placeholder="Enter a name, e.g. Hourly smoke" data-autofocus/></div>
        <div class="form-row"><span class="label">What to run</span><div data-dd="source"></div><span class="help">Save more choices on Run tests with "Save this setup".</span></div>
        <div class="form-row"><span class="label">Against</span><div data-dd="target"></div></div>
        <div class="form-row"><span class="label">When</span><div class="chips" data-mode>
          <button type="button" class="chip" data-m="interval">${icon('repeat')}Every few minutes or hours</button>
          <button type="button" class="chip" data-m="daily">${icon('calendar')}At a time of day</button></div></div>
        <div data-when></div>
        <label class="switch"><input type="checkbox" data-startenv ${form.startEnv ? raw('checked') : ''}/><div><strong>Start the test environment if it isn't running</strong><span>Only for runs against the test environment.</span></div></label>
        <label class="switch"><input type="checkbox" data-enabled ${form.enabled ? raw('checked') : ''}/><div><strong>Turned on</strong><span>Turn off to pause it without deleting.</span></div></label>
        <div class="field-error small" style="color:var(--danger)" role="alert" data-err></div>
      </div>`,
      footer: html`<button type="button" class="btn btn-outline" data-cancel>Cancel</button><button type="button" class="btn btn-primary" data-save>${icon('check')}Save</button>`,
    });
    dropdown(el.querySelector('[data-dd="source"]'), { options: sources, value: form.source, label: 'What to run', onChange: (v) => (form.source = v) });
    dropdown(el.querySelector('[data-dd="target"]'), {
      options: (env?.targets ?? [{ name: 'test', label: 'Test environment' }]).map((t) => ({ value: t.name, label: t.label })),
      value: form.target,
      label: 'Against',
      onChange: (v) => (form.target = v),
    });
    const drawWhen = () => {
      el.querySelectorAll('[data-m]').forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.m === form.mode)));
      render(
        el.querySelector('[data-when]'),
        form.mode === 'interval'
          ? html`<div class="form-row"><label for="s-every">Every (minutes)</label><input class="input" id="s-every" type="number" min="5" max="10080" value="${form.everyMinutes}" placeholder="Enter minutes, e.g. 60"/><span class="help">5 minutes to 7 days (10080). 60 = hourly, 1440 = daily.</span></div>`
          : html`<div class="form-grid"><div class="form-row"><label for="s-at">Time</label><input class="input" id="s-at" type="time" value="${form.at}"/></div></div>
              <div class="form-row" style="margin-top:12px"><span class="label">Days (none chosen = every day)</span><div class="weekdays">${DAYS.map((d, i) => html`<button type="button" class="chip" data-day="${i}" aria-pressed="${form.days.includes(i)}">${d}</button>`)}</div></div>`,
      );
      el.querySelector('#s-every')?.addEventListener('input', (e) => (form.everyMinutes = e.target.value));
      el.querySelector('#s-at')?.addEventListener('input', (e) => (form.at = e.target.value));
      el.querySelectorAll('[data-day]').forEach((c) =>
        c.addEventListener('click', () => {
          const d = Number(c.dataset.day);
          form.days = form.days.includes(d) ? form.days.filter((x) => x !== d) : [...form.days, d];
          c.setAttribute('aria-pressed', String(form.days.includes(d)));
        }),
      );
    };
    el.querySelectorAll('[data-m]').forEach((c) => c.addEventListener('click', () => ((form.mode = c.dataset.m), drawWhen())));
    drawWhen();
    el.querySelector('[data-cancel]').addEventListener('click', close);
    el.querySelector('[data-save]').addEventListener('click', async () => {
      form.name = el.querySelector('#s-name').value;
      form.startEnv = el.querySelector('[data-startenv]').checked;
      form.enabled = el.querySelector('[data-enabled]').checked;
      const preset = presets.find((p) => p.id === form.source);
      const base = preset ? preset.options : (BUILT_IN.find((b) => b.value === form.source)?.options ?? {});
      try {
        await api.saveSchedule({
          id: s?.id,
          name: form.name,
          source: form.source,
          mode: form.mode,
          everyMinutes: form.everyMinutes,
          at: form.at,
          days: form.days,
          startEnv: form.startEnv,
          enabled: form.enabled,
          options: { ...base, target: form.target },
        });
        close();
        toast(s ? 'Schedule saved' : 'Schedule made');
        refresh();
      } catch (err) {
        el.querySelector('[data-err]').textContent = err.message;
      }
    });
  }
  return null;
}

function until(iso) {
  const s = Math.max(0, Math.round((new Date(iso) - Date.now()) / 1000));
  if (s < 60) return `${s} s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ${m % 60} min`;
  return `${Math.floor(h / 24)} d ${h % 24} h`;
}
