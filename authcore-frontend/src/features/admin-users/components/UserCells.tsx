import { Badge, Tooltip } from '@/components/ui';

import type { AdminUser } from '../types/admin-user.types';
import { isDormant, ROLE_LABEL, STATUS_LABEL, STATUS_TONE } from './user-labels';

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
