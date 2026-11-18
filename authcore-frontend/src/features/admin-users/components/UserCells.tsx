import { BadgeCheck } from 'lucide-react';

import { Avatar, Badge, Tooltip } from '@/components/ui';
import { formatDateTime, formatRelative } from '@/lib/format';

import type { AdminUser } from '../types/admin-user.types';
import { fullName, isDormant, ROLE_LABEL, STATUS_LABEL, STATUS_TONE } from './user-labels';

export function UserNameCell({ user }: { user: AdminUser }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <Avatar name={fullName(user)} size="xs" />
      <span className="min-w-0">
        <span className="block truncate font-medium text-foreground">{fullName(user)}</span>
        {user.username && (
          <span className="block truncate text-xs text-muted-foreground">@{user.username}</span>
        )}
      </span>
    </span>
  );
}

export function EmailCell({ user }: { user: AdminUser }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <span className="truncate">{user.email}</span>
      {user.isEmailVerified && (
        <Tooltip content="Email verified">
          <span className="shrink-0 text-success">
            <BadgeCheck className="size-3.5" aria-hidden="true" />
            <span className="sr-only">(verified)</span>
          </span>
        </Tooltip>
      )}
    </span>
  );
}

export function RoleCell({ user }: { user: AdminUser }) {
  return (
    <Badge tone={user.role === 'ADMIN' ? 'primary' : 'neutral'} variant="soft">
      {ROLE_LABEL[user.role]}
    </Badge>
  );
}

/** Status, plus "Dormant" for active accounts without a recent sign-in. */
export function StatusCell({
  user,
  dormantAfterDays,
}: {
  user: AdminUser;
  dormantAfterDays: number;
}) {
  const dormant = isDormant(user, dormantAfterDays);
  return (
    <span className="flex flex-wrap items-center gap-1">
      <Badge size="sm" tone={STATUS_TONE[user.status]}>
        {STATUS_LABEL[user.status]}
      </Badge>
      {dormant && (
        <Tooltip
          content={
            user.lastLoginAt
              ? `No sign-in for more than ${dormantAfterDays} days`
              : 'Has never signed in'
          }
        >
          <span>
            <Badge size="sm" tone="warning" variant="outline">
              Dormant
            </Badge>
          </span>
        </Tooltip>
      )}
    </span>
  );
}

/** Relative time ("3 days ago") with the exact date on hover and for screen readers. */
export function DateCell({ value, empty = 'Never' }: { value: string | null; empty?: string }) {
  if (!value) return <span className="text-muted-foreground">{empty}</span>;
  const exact = formatDateTime(value);
  return (
    <time dateTime={value} title={exact}>
      {formatRelative(value)}
      <span className="sr-only"> ({exact})</span>
    </time>
  );
}
