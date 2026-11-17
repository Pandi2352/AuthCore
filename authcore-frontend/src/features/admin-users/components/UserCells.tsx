import { StatusBadge } from '@/components/common/StatusBadge';
import { Avatar, Badge } from '@/components/ui';
import { formatDateTime, formatNumber, formatRelative } from '@/lib/format';

import type { AdminUser } from '../types/admin-user.types';
import { fullName, ROLE_LABEL, STATUS_LABEL } from './user-labels';

export function UserNameCell({ user }: { user: AdminUser }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <Avatar name={fullName(user)} size="xs" />
      <span className="truncate">{fullName(user)}</span>
    </span>
  );
}

export function RoleCell({ user }: { user: AdminUser }) {
  return (
    <Badge tone={user.role === 'admin' ? 'primary' : 'neutral'} variant="soft">
      {ROLE_LABEL[user.role]}
    </Badge>
  );
}

export function StatusCell({ user }: { user: AdminUser }) {
  return (
    <StatusBadge
      status={user.status}
      label={STATUS_LABEL[user.status]}
      tones={{ invited: 'info', pending: 'warning', suspended: 'danger', active: 'success' }}
    />
  );
}

export function NumberCell({ value }: { value: number }) {
  return <>{formatNumber(value)}</>;
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
