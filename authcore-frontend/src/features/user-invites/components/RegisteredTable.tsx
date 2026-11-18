import { BadgeCheck, CircleDashed } from 'lucide-react';

import { DateTime } from '@/components/common/DateTime';
import { Badge } from '@/components/ui';

import type { RegisteredUser } from '../types/invite.types';
import { DataTable, PersonCell } from './InvitesTable';

const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  ACTIVE: 'success',
  PENDING_VERIFICATION: 'warning',
  PENDING_APPROVAL: 'warning',
  SUSPENDED: 'danger',
  REJECTED: 'danger',
  BANNED: 'danger',
};

const humanize = (value: string) =>
  value.charAt(0) + value.slice(1).toLowerCase().replaceAll('_', ' ');

/** People who created their account themselves (sign-up page). */
export function RegisteredTable({ users }: { users: RegisteredUser[] }) {
  return (
    <DataTable
      head={
        <>
          <th scope="col">Person</th>
          <th scope="col" className="hidden md:table-cell">
            Username
          </th>
          <th scope="col" className="hidden sm:table-cell">
            Email
          </th>
          <th scope="col">Status</th>
          <th scope="col" className="hidden sm:table-cell">
            Joined
          </th>
          <th scope="col" className="hidden lg:table-cell">
            Last sign-in
          </th>
        </>
      }
    >
      {users.map((user) => (
        <tr key={user.id}>
          <td className="max-w-72">
            <PersonCell person={user} />
          </td>
          <td className="hidden font-mono text-xs text-muted-foreground md:table-cell">
            {user.username ?? '—'}
          </td>
          <td className="hidden sm:table-cell">
            {user.isEmailVerified ? (
              <span className="inline-flex items-center gap-1 text-xs text-success">
                <BadgeCheck className="size-3.5" aria-hidden="true" /> Verified
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <CircleDashed className="size-3.5" aria-hidden="true" /> Not verified
              </span>
            )}
          </td>
          <td>
            <Badge size="sm" tone={STATUS_TONE[user.status] ?? 'neutral'}>
              {humanize(user.status)}
            </Badge>
          </td>
          <td className="hidden whitespace-nowrap text-muted-foreground sm:table-cell">
            <DateTime value={user.createdAt} format="relative" />
          </td>
          <td className="hidden whitespace-nowrap text-muted-foreground lg:table-cell">
            {user.lastLoginAt ? <DateTime value={user.lastLoginAt} format="relative" /> : 'Never'}
          </td>
        </tr>
      ))}
    </DataTable>
  );
}
