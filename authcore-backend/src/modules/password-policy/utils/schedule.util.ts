import { SchedulerFrequency } from '../enums/scheduler.enum';

export interface ScheduleSettings {
  frequency: SchedulerFrequency;
  /** HH:mm (24h) in `timezone`. */
  executionTime: string;
  timezone: string;
  /** 1 = Monday … 7 = Sunday (WEEKLY). */
  dayOfWeek: number;
  /** 1–28 (MONTHLY). */
  dayOfMonth: number;
}

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  /** 1 = Monday … 7 = Sunday */
  weekday: number;
}

const HOUR_MS = 3_600_000;
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function isValidTimeZone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/**
 * The first execution strictly after `after`, as a UTC instant. Wall-clock
 * times are interpreted in the configured IANA time zone (DST-aware).
 */
export function computeNextExecution(
  after: Date,
  settings: ScheduleSettings,
): Date {
  const [hour = 0, minute = 0] = settings.executionTime.split(':').map(Number);
  const now = zonedParts(after, settings.timezone);
  const at = (year: number, month: number, day: number, h = hour): Date =>
    zonedToUtc(year, month, day, h, minute, settings.timezone);

  switch (settings.frequency) {
    case SchedulerFrequency.Hourly: {
      const candidate = at(now.year, now.month, now.day, now.hour);
      return candidate > after
        ? candidate
        : new Date(candidate.getTime() + HOUR_MS);
    }
    case SchedulerFrequency.Daily: {
      const today = at(now.year, now.month, now.day);
      return today > after ? today : at(now.year, now.month, now.day + 1);
    }
    case SchedulerFrequency.Weekly: {
      const daysAhead = (settings.dayOfWeek - now.weekday + 7) % 7;
      const candidate = at(now.year, now.month, now.day + daysAhead);
      return candidate > after
        ? candidate
        : at(now.year, now.month, now.day + daysAhead + 7);
    }
    case SchedulerFrequency.Monthly: {
      const candidate = at(now.year, now.month, settings.dayOfMonth);
      return candidate > after
        ? candidate
        : at(now.year, now.month + 1, settings.dayOfMonth);
    }
  }
}

function zonedParts(date: Date, timezone: string): ZonedParts {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      weekday: 'short',
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    weekday: WEEKDAYS.indexOf(String(parts.weekday)) + 1,
  };
}

/** Offset of the zone from UTC at an instant, in ms. */
function offsetAt(instant: number, timezone: string): number {
  const p = zonedParts(new Date(instant), timezone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  return asUtc - Math.floor(instant / 60_000) * 60_000;
}

/**
 * UTC instant of a wall-clock time in a zone. Day / month overflow is
 * normalised (day 32 = next month). Re-checks the offset once for DST.
 */
function zonedToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timezone: string,
): Date {
  const wallClock = Date.UTC(year, month - 1, day, hour, minute);
  const firstGuess = wallClock - offsetAt(wallClock, timezone);
  return new Date(wallClock - offsetAt(firstGuess, timezone));
}
