import { Ban, Copy, Loader2, MoreHorizontal, RotateCw, Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { DateTime } from '@/components/common/DateTime';
import { TableAction } from '@/components/data-table';
import { notifyError, notifySuccess } from '@/components/feedback';
import {
  Badge,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui';
import { cn } from '@/lib/utils';

import { invitesApi } from '../api/invites.api';
import type { Invite } from '../types/invite.types';
import {
  canDelete,
  canResend,
  canRevoke,
  initials,
  personName,
  STATUS_META,
} from './invite-labels';

export function PersonCell({
  person,
}: {
  person: { email: string; firstName: string | null; lastName: string | null };
}) {
  const name = personName(person);
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span
        aria-hidden="true"
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary-soft-foreground"
      >
        {initials(person)}
      </span>
      <div className="min-w-0">
        <p className="truncate font-medium text-foreground">{name ?? person.email}</p>
        {name && <p className="truncate text-xs text-muted-foreground">{person.email}</p>}
      </div>
    </div>
  );
}

export function DataTable({ head, children }: { head: ReactNode; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/60 text-left text-xs font-medium tracking-wide text-muted-foreground uppercase [&_th]:px-3 [&_th]:py-2.5 [&_th]:font-medium sm:[&_th]:px-4">
            {head}
          </tr>
        </thead>
        <tbody className="[&_td]:px-3 [&_td]:py-3 sm:[&_td]:px-4 [&_tr]:border-b [&_tr]:border-border [&_tr]:transition-colors [&_tr:hover]:bg-accent/40 [&_tr:last-child]:border-0 [&_tr:nth-child(even)]:bg-muted/60">
          {children}
        </tbody>
      </table>
    </div>
  );
}

function InviteActions({
  invite,
  canManage,
  onChanged,
}: {
  invite: Invite;
  canManage: boolean;
  onChanged: () => void;
}) {
  const [isResending, setIsResending] = useState(false);
  const [confirm, setConfirm] = useState<'revoke' | 'delete' | null>(null);
  const who = personName(invite) ?? invite.email;

  const resend = async () => {
    setIsResending(true);
    try {
      await invitesApi.resend(invite.id);
      notifySuccess(`Invite sent again to ${invite.email}`, {
        description: 'A new link was emailed; the previous link no longer works.',
      });
      onChanged();
    } catch (err) {
      notifyError(err, 'Could not resend the invite');
    } finally {
      setIsResending(false);
    }
  };

  const revoke = async () => {
    try {
      await invitesApi.revoke(invite.id);
      notifySuccess(`Invite for ${who} revoked`, {
        description: 'The link no longer works. You can send a new invite any time.',
      });
      onChanged();
    } catch (err) {
      notifyError(err, 'Could not revoke the invite');
      throw err;
    }
  };

  const remove = async () => {
    try {
      await invitesApi.remove(invite.id);
      notifySuccess(`Invite for ${who} deleted`);
      onChanged();
    } catch (err) {
      notifyError(err, 'Could not delete the invite');
      throw err;
    }
  };

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(invite.email);
      notifySuccess('Email copied');
    } catch (err) {
      notifyError(err, 'Could not copy');
    }
  };

  return (
    <div className="flex items-center justify-end gap-1.5">
      {canManage && canResend(invite) && (
        <TableAction
          tone="cyan"
          icon={isResending ? <Loader2 className="animate-spin" /> : <RotateCw />}
          label={`${invite.status === 'EXPIRED' ? 'Reinvite' : 'Resend the invite to'} ${invite.email}`}
          disabled={isResending}
          onClick={() => void resend()}
        />
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <TableAction icon={<MoreHorizontal />} label={`Actions for ${who}`} showTooltip={false} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48">
          <DropdownMenuItem icon={<Copy />} onSelect={() => void copyEmail()}>
            Copy email
          </DropdownMenuItem>
          {canManage && canRevoke(invite) && (
            <DropdownMenuItem icon={<Ban />} onSelect={() => setConfirm('revoke')}>
              Revoke invite
            </DropdownMenuItem>
          )}
          {canManage && canDelete(invite) && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem icon={<Trash2 />} destructive onSelect={() => setConfirm('delete')}>
                Delete
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirm === 'revoke'}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={`Revoke the invite for ${who}?`}
        description="The link in their email stops working. The invite stays in the list as revoked; you can reinvite them later."
        confirmText="Revoke"
        destructive
        onConfirm={revoke}
      />
      <ConfirmDialog
        open={confirm === 'delete'}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={`Delete the invite for ${who}?`}
        description={
          invite.status === 'PENDING'
            ? 'The invite is removed and its link stops working.'
            : 'The invite is removed from the list.'
        }
        confirmText="Delete"
        destructive
        onConfirm={remove}
      />
    </div>
  );
}

/** Pending / expired / revoked invites. */
export function OpenInvitesTable({
  invites,
  canManage,
  onChanged,
}: {
  invites: Invite[];
  canManage: boolean;
  onChanged: () => void;
}) {
  return (
    <DataTable
      head={
        <>
          <th scope="col">Person</th>
          <th scope="col" className="hidden md:table-cell">
            Invited by
          </th>
          <th scope="col" className="hidden sm:table-cell">
            Sent
          </th>
          <th scope="col" className="hidden lg:table-cell">
            Expires
          </th>
          <th scope="col">Status</th>
          <th scope="col">
            <span className="sr-only">Actions</span>
          </th>
        </>
      }
    >
      {invites.map((invite) => {
        const status = STATUS_META[invite.status];
        return (
          <tr key={invite.id}>
            <td className="max-w-72">
              <PersonCell person={invite} />
            </td>
            <td className="hidden text-muted-foreground md:table-cell">
              {invite.invitedBy?.name ?? '—'}
            </td>
            <td className="hidden whitespace-nowrap sm:table-cell">
              <DateTime value={invite.lastSentAt} format="relative" />
              {invite.resendCount > 0 && (
                <span className="block text-xs text-muted-foreground">
                  Resent {invite.resendCount}×
                </span>
              )}
            </td>
            <td
              className={cn(
                'hidden whitespace-nowrap lg:table-cell',
                invite.status === 'EXPIRED' ? 'text-danger' : 'text-muted-foreground',
              )}
            >
              {invite.status === 'REVOKED' && invite.revokedAt ? (
                <>
                  Revoked <DateTime value={invite.revokedAt} format="relative" />
                </>
              ) : (
                <DateTime value={invite.expiresAt} format="relative" />
              )}
            </td>
            <td>
              <Badge size="sm" tone={status.tone}>
                {status.label}
              </Badge>
            </td>
            <td>
              <InviteActions invite={invite} canManage={canManage} onChanged={onChanged} />
            </td>
          </tr>
        );
      })}
    </DataTable>
  );
}

/** Accepted invites: who joined, when, through whom. */
export function AcceptedInvitesTable({ invites }: { invites: Invite[] }) {
  return (
    <DataTable
      head={
        <>
          <th scope="col">Person</th>
          <th scope="col" className="hidden md:table-cell">
            Invited by
          </th>
          <th scope="col" className="hidden sm:table-cell">
            Invited
          </th>
          <th scope="col">Joined</th>
          <th scope="col" className="hidden lg:table-cell">
            Groups
          </th>
        </>
      }
    >
      {invites.map((invite) => (
        <tr key={invite.id}>
          <td className="max-w-72">
            <PersonCell person={invite} />
          </td>
          <td className="hidden text-muted-foreground md:table-cell">
            {invite.invitedBy?.name ?? '—'}
          </td>
          <td className="hidden whitespace-nowrap text-muted-foreground sm:table-cell">
            <DateTime value={invite.createdAt} format="relative" />
          </td>
          <td className="whitespace-nowrap">
            {invite.acceptedAt ? <DateTime value={invite.acceptedAt} format="relative" /> : '—'}
          </td>
          <td className="hidden text-muted-foreground lg:table-cell">
            {invite.groupIds.length > 0 ? `${invite.groupIds.length}` : '—'}
          </td>
        </tr>
      ))}
    </DataTable>
  );
}
