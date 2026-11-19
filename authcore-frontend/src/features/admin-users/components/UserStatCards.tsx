import {
  BadgeCheck,
  Clock3,
  ShieldCheck,
  Sparkles,
  UserCheck,
  UserMinus,
  Users,
  UserX,
} from 'lucide-react';
import { memo } from 'react';

import { StatCard } from '@/components/common/StatCard';

import type { UserActivity, UserStats } from '../types/admin-user.types';

const share = (part: number, total: number) =>
  total > 0 ? ` · ${Math.round((part / total) * 100)}%` : '';

/**
 * The eight counts (same light cards as roles and groups). The first four filter the table
 * by activity; clicking the selected one again shows everyone.
 */
export const UserStatCards = memo(function UserStatCards({
  stats: s,
  selected,
  onSelect,
}: {
  stats: UserStats | null;
  selected: UserActivity | null;
  onSelect: (activity: UserActivity | null) => void;
}) {
  const days = s?.dormantAfterDays ?? 30;
  const total = s?.total ?? 0;
  const pick = (activity: UserActivity) => () => onSelect(selected === activity ? null : activity);
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        tone="primary"
        pattern="rings"
        icon={Users}
        label="Total users"
        value={s?.total ?? null}
        hint="Every account · click to show all"
        selected={selected === null}
        onClick={() => onSelect(null)}
      />
      <StatCard
        tone="success"
        pattern="waves"
        icon={UserCheck}
        label="Active users"
        value={s?.active ?? null}
        hint={`Signed in within ${days} days${s ? share(s.active, total) : ''}`}
        selected={selected === 'ACTIVE'}
        onClick={pick('ACTIVE')}
      />
      <StatCard
        tone="warning"
        pattern="dots"
        icon={UserMinus}
        label="Dormant users"
        value={s?.dormant ?? null}
        hint={`No sign-in for ${days}+ days${s ? share(s.dormant, total) : ''}`}
        selected={selected === 'DORMANT'}
        onClick={pick('DORMANT')}
      />
      <StatCard
        tone="danger"
        pattern="stripes"
        icon={UserX}
        label="Inactive users"
        value={s?.inactive ?? null}
        hint={`Pending, deactivated or suspended${s ? share(s.inactive, total) : ''}`}
        selected={selected === 'INACTIVE'}
        onClick={pick('INACTIVE')}
      />
      <StatCard
        tone="violet"
        pattern="sparkles"
        icon={ShieldCheck}
        label="Admins"
        value={s?.admins ?? null}
        hint="Full access to everything"
      />
      <StatCard
        tone="cyan"
        pattern="grid"
        icon={BadgeCheck}
        label="Verified emails"
        value={s?.verified ?? null}
        hint={`Email address confirmed${s ? share(s.verified, total) : ''}`}
      />
      <StatCard
        tone="info"
        pattern="bars"
        icon={Clock3}
        label="Never signed in"
        value={s?.neverSignedIn ?? null}
        hint="No sign-in yet"
      />
      <StatCard
        tone="success"
        pattern="bubbles"
        icon={Sparkles}
        label="New users"
        value={s?.newLast30Days ?? null}
        hint="Created in the last 30 days"
      />
    </div>
  );
});
