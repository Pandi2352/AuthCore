// Scheduled runs: every N minutes, or daily at a time (on chosen weekdays). They run while
// the dashboard is running; a run that is due while another is going starts after it.
import { newId, store } from './util.mjs';

const schedules = store('schedules', []);
let timer = null;

/** When a schedule is next due (ISO), from its last run (or when it was made). */
export function nextRun(s, from = new Date()) {
  if (!s.enabled) return null;
  const last = new Date(s.lastRunAt ?? s.createdAt);
  if (s.mode === 'interval') {
    const every = Math.max(5, s.everyMinutes ?? 60) * 60_000;
    return new Date(Math.max(last.getTime() + every, Date.now() - 1)).toISOString();
  }
  // Daily at HH:MM on the chosen weekdays (local time of this machine).
  const [h, m] = String(s.at ?? '02:00').split(':').map(Number);
  const days = s.days?.length ? s.days : [0, 1, 2, 3, 4, 5, 6];
  const start = new Date(Math.max(last.getTime(), from.getTime() - 60_000));
  for (let i = 0; i < 8; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    d.setHours(h, m, 0, 0);
    if (d > last && days.includes(d.getDay())) return d.toISOString();
  }
  return null;
}

export const listSchedules = () => schedules.get().map((s) => ({ ...s, nextRunAt: nextRun(s) }));

function clean(input, existing) {
  const name = String(input.name ?? '').trim().slice(0, 60);
  if (!name) throw new Error('Enter a name for the schedule');
  const mode = input.mode === 'daily' ? 'daily' : 'interval';
  const everyMinutes = Number.parseInt(input.everyMinutes, 10);
  if (mode === 'interval' && !(everyMinutes >= 5 && everyMinutes <= 10_080)) throw new Error('Run every 5 minutes to 7 days (10080 minutes)');
  if (mode === 'daily' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(input.at ?? ''))) throw new Error('Enter the time as HH:MM, e.g. 02:30');
  const days = Array.isArray(input.days) ? input.days.map(Number).filter((d) => d >= 0 && d <= 6) : [];
  return {
    ...existing,
    name,
    mode,
    everyMinutes: mode === 'interval' ? everyMinutes : null,
    at: mode === 'daily' ? input.at : null,
    days: mode === 'daily' ? [...new Set(days)].sort() : [],
    options: typeof input.options === 'object' && input.options ? input.options : {},
    // Which choice the options came from (built-in or a saved setup), for the page.
    source: String(input.source ?? '').slice(0, 40),
    startEnv: Boolean(input.startEnv),
    enabled: input.enabled !== false,
  };
}

export function saveSchedule(input) {
  const list = schedules.get();
  const at = input.id ? list.findIndex((s) => s.id === input.id) : -1;
  if (input.id && at < 0) throw new Error('Schedule not found');
  const item = clean(input, at >= 0 ? list[at] : { id: newId(), createdAt: new Date().toISOString(), lastRunAt: null, history: [] });
  if (at >= 0) list[at] = item;
  else list.push(item);
  schedules.set(list);
  return { ...item, nextRunAt: nextRun(item) };
}

export function deleteSchedule(id) {
  const list = schedules.get();
  schedules.set(list.filter((s) => s.id !== id));
  return list.length !== schedules.get().length;
}

export function markRun(id, patch) {
  const list = schedules.get();
  const s = list.find((x) => x.id === id);
  if (!s) return;
  Object.assign(s, patch);
  schedules.set(list);
}

/**
 * Checks every 20 s. `run(schedule)` starts the run and resolves when it has started
 * (or throws); `busy()` says whether a run is going.
 */
export function startScheduler({ run, busy, log }) {
  clearInterval(timer);
  let working = false;
  timer = setInterval(async () => {
    if (working || busy()) return;
    const due = schedules
      .get()
      .filter((s) => s.enabled)
      .map((s) => ({ s, next: nextRun(s) }))
      .filter(({ next }) => next && new Date(next) <= new Date())
      .sort((a, b) => new Date(a.next) - new Date(b.next))[0];
    if (!due) return;
    working = true;
    const startedAt = new Date().toISOString();
    try {
      await run(due.s);
      markRun(due.s.id, { lastRunAt: startedAt, lastError: null });
    } catch (e) {
      markRun(due.s.id, { lastRunAt: startedAt, lastError: e.message });
      log?.(`Scheduled run "${due.s.name}" could not start: ${e.message}`);
    } finally {
      working = false;
    }
  }, 20_000);
}
