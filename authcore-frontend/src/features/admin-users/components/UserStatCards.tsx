import { UserCheck, UserMinus, Users, UserX, type LucideIcon } from 'lucide-react';

import { Skeleton } from '@/components/ui';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

import type { UserActivity, UserStats } from '../types/admin-user.types';

interface CardSpec {
  key: 'total' | 'active' | 'dormant' | 'inactive';
  activity: UserActivity | null;
  label: string;
  hint: (days: number) => string;
  icon: LucideIcon;
  /** Solid theme color (token) — readable foreground included. */
  tone: string;
}

const CARDS: CardSpec[] = [
  {
    key: 'total',
    activity: null,
    label: 'Total users',
    hint: () => 'Every account',
    icon: Users,
    tone: 'bg-primary text-primary-foreground',
  },
  {
    key: 'active',
    activity: 'ACTIVE',
    label: 'Active users',
    hint: (days) => `Signed in within ${days} days`,
    icon: UserCheck,
    tone: 'bg-success text-success-foreground',
  },
  {
    key: 'dormant',
    activity: 'DORMANT',
    label: 'Dormant users',
    hint: (days) => `No sign-in for ${days}+ days`,
    icon: UserMinus,
    tone: 'bg-warning text-warning-foreground',
  },
  {
    key: 'inactive',
    activity: 'INACTIVE',
    label: 'Inactive users',
    hint: () => 'Pending, deactivated or suspended',
    icon: UserX,
    tone: 'bg-danger text-danger-foreground',
  },
];

/** The four counts; clicking one filters the table (again = show everyone). */
export function UserStatCards({
  stats,
  selected,
  onSelect,
}: {
  stats: UserStats | null;
  selected: UserActivity | null;
  onSelect: (activity: UserActivity | null) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
      {CARDS.map(({ key, activity, label, hint, icon: Icon, tone }) => {
        const value = stats?.[key] ?? null;
        const isSelected = activity === null ? selected === null : selected === activity;
        const share =
          stats && stats.total > 0 && activity !== null
            ? Math.round(((value ?? 0) / stats.total) * 100)
            : null;
        return (
          <button
            key={key}
            type="button"
            aria-pressed={isSelected}
            aria-label={`${label}: ${value === null ? 'loading' : formatNumber(value)}. ${
              activity === null ? 'Show everyone' : 'Show only these'
            }`}
            onClick={() => onSelect(activity === null || isSelected ? null : activity)}
            className={cn(
              'group relative flex cursor-pointer items-center gap-3 overflow-hidden rounded-md p-4 text-left transition-transform focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:gap-4 sm:p-5',
              'hover:-translate-y-0.5 motion-reduce:hover:translate-y-0',
              tone,
              isSelected
                ? 'ring-2 ring-foreground/70 ring-offset-2 ring-offset-background'
                : 'opacity-95',
            )}
          >
            {/* Soft sheen in the card's own foreground color (no hard-coded white). */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-linear-to-br from-transparent via-transparent to-current opacity-15"
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -right-6 -bottom-8 size-24 rounded-full bg-current opacity-10"
            />
            <span className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-current/15 sm:size-12">
              <Icon className="size-5 sm:size-6" aria-hidden="true" />
            </span>
            <span className="relative min-w-0 flex-1">
              <span className="block truncate text-xs font-medium opacity-90 sm:text-sm">
                {label}
              </span>
              {value === null ? (
                <Skeleton className="mt-1 h-7 w-16 bg-current/20" />
              ) : (
                <span className="block text-2xl leading-tight font-bold tabular-nums sm:text-3xl">
                  {formatNumber(value)}
                </span>
              )}
              <span className="block truncate text-[11px] opacity-85 sm:text-xs">
                {stats ? hint(stats.dormantAfterDays) : ' '}
                {share !== null && ` · ${share}%`}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
