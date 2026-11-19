import {
  BadgeCheck,
  Ban,
  CircleDashed,
  Clock,
  MailCheck,
  RotateCw,
  ScanEye,
  Trash2,
  UserCheck,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { DateTime } from '@/components/common/DateTime';
import {
  DataTable,
  TableAction,
  useServerTable,
  type DataTableColumn,
  type DataTableFilter,
  type TablePage,
  type TableQuery,
} from '@/components/data-table';
import { notifyError, notifySuccess } from '@/components/feedback';
import { Badge } from '@/components/ui';
import { paths } from '@/config';
import { cn } from '@/lib/utils';

import { invitesApi } from '../api/invites.api';
import type { Invite, InviteStatus, RegisteredUser } from '../types/invite.types';
import { personName, STATUS_META } from './invite-labels';

type InviteRow = Invite & { rowNumber: number };
type UserRow = RegisteredUser & { rowNumber: number };
export type OpenStatus = Extract<InviteStatus, 'PENDING' | 'EXPIRED' | 'REVOKED'>;

/** A pending invite past its expiry is expired (the server lists it that way too). */
const statusOf = (invite: Invite): InviteStatus =>
  invite.status === 'PENDING' && new Date(invite.expiresAt).getTime() <= Date.now()
    ? 'EXPIRED'
    : invite.status;

const OPEN_STATUS_LABEL: Record<OpenStatus, string> = {
  PENDING: 'Waiting to accept',
  EXPIRED: 'Expired',
  REVOKED: 'Revoked',
};

const humanize = (value: string) =>
  value.charAt(0) + value.slice(1).toLowerCase().replaceAll('_', ' ');

const USER_STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  ACTIVE: 'success',
  PENDING_VERIFICATION: 'warning',
  PENDING_APPROVAL: 'warning',
  SUSPENDED: 'danger',
  REJECTED: 'danger',
  BANNED: 'danger',
};

// ---------------------------------------------------------------- shared columns

const rowNumberColumn = <T extends { rowNumber: number }>(): DataTableColumn<T> => ({
  id: 'rowNumber',
  header: 'S.No',
  width: 64,
  fit: true,
  mobile: 'hidden',
  cell: (r) => <span className="text-muted-foreground tabular-nums">{r.rowNumber}</span>,
});

/** Name on the first line, the email under it (same as roles / groups / users). */
const personColumn = <
  T extends { email: string; firstName: string | null; lastName: string | null },
>(): DataTableColumn<T> => ({
  id: 'person',
  header: 'Person',
  width: 320,
  fitText: (r) => [personName(r) ?? r.email, r.email],
  wrap: true,
  mobile: 'title',
  cell: (r) => (
    <span className="block min-w-0">
      <span className="block font-medium text-foreground">{personName(r) ?? '—'}</span>
      <span className="block text-xs break-all text-primary">{r.email}</span>
    </span>
  ),
});

const dateColumn = <T,>(
  id: string,
  header: string,
  valueOf: (row: T) => string | null,
  extra?: (row: T) => ReactNode,
): DataTableColumn<T> => ({
  id,
  header,
  width: 200,
  fit: true,
  cell: (r) => {
    const value = valueOf(r);
    return (
      <span className="block">
        {value ? (
          <DateTime value={value} format="full" />
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
        {extra?.(r)}
      </span>
    );
  },
});

// ---------------------------------------------------------------- open invites

function OpenInviteActions({
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
  const status = statusOf(invite);
  const noRights = canManage ? undefined : 'Needs the invite permission';

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

  return (
    <span className="flex items-center justify-end gap-1.5">
      <TableAction
        tone="cyan"
        icon={<RotateCw className={cn(isResending && 'animate-spin')} />}
        tooltip={status === 'EXPIRED' ? 'Reinvite' : 'Resend'}
        label={`${status === 'EXPIRED' ? 'Reinvite' : 'Resend the invite to'} ${invite.email}`}
        disabledReason={
          noRights ?? (status === 'REVOKED' ? 'Revoked invites cannot be resent' : undefined)
        }
        onClick={() => !isResending && void resend()}
      />
      <TableAction
        tone="warning"
        icon={<Ban />}
        tooltip="Revoke"
        label={`Revoke the invite for ${who}`}
        disabledReason={
          noRights ?? (status === 'PENDING' ? undefined : 'Only waiting invites can be revoked')
        }
        onClick={() => setConfirm('revoke')}
      />
      <TableAction
        tone="danger"
        icon={<Trash2 />}
        tooltip="Delete"
        label={`Delete the invite for ${who}`}
        disabledReason={noRights}
        onClick={() => setConfirm('delete')}
      />
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
          status === 'PENDING'
            ? 'The invite is removed and its link stops working.'
            : 'The invite is removed from the list.'
        }
        confirmText="Delete"
        destructive
        onConfirm={remove}
      />
    </span>
  );
}

const openColumns: DataTableColumn<InviteRow>[] = [
  rowNumberColumn<InviteRow>(),
  personColumn<InviteRow>(),
  {
    id: 'invitedBy',
    header: 'Invited by',
    width: 200,
    fitText: (r) => [r.invitedBy?.name ?? '—'],
    cell: (r) => <span className="text-foreground">{r.invitedBy?.name ?? '—'}</span>,
  },
  dateColumn<InviteRow>(
    'lastSentAt',
    'Sent on',
    (r) => r.lastSentAt,
    (r) =>
      r.resendCount > 0 && (
        <span className="block text-xs text-muted-foreground">Resent {r.resendCount}×</span>
      ),
  ),
  {
    id: 'expiresAt',
    header: 'Expires on',
    width: 200,
    fit: true,
    cell: (r) =>
      statusOf(r) === 'REVOKED' && r.revokedAt ? (
        <span className="block text-muted-foreground">
          Revoked <DateTime value={r.revokedAt} format="full" />
        </span>
      ) : (
        <span className={cn('block', statusOf(r) === 'EXPIRED' && 'text-danger')}>
          <DateTime value={r.expiresAt} format="full" />
        </span>
      ),
  },
  {
    id: 'status',
    header: 'Status',
    width: 130,
    cell: (r) => {
      const meta = STATUS_META[statusOf(r)];
      return (
        <Badge size="sm" tone={meta.tone}>
          {meta.label}
        </Badge>
      );
    },
  },
];

/** The table's Status filter picks one status (the last ticked); none = waiting. */
const fetchOpenInvites = (query: TableQuery, signal: AbortSignal) =>
  invitesApi.page(
    query,
    (query.filters.status?.at(-1) as OpenStatus | undefined) ?? 'PENDING',
    signal,
  );

/** Waiting / expired / revoked invites (status filter; waiting by default). */
export function OpenInvitesTable({
  canManage,
  status,
  reloadKey,
  onChanged,
  onRefresh,
}: {
  canManage: boolean;
  /** Status to start with (the cards pick it; the table's Status filter changes it after). */
  status: OpenStatus;
  /** Bumped from outside (e.g. after sending invites) to reload the rows. */
  reloadKey: number;
  onChanged: () => void;
  onRefresh: () => void;
}) {
  const filters: DataTableFilter[] = [
    {
      id: 'status',
      label: 'Status',
      options: (Object.keys(OPEN_STATUS_LABEL) as OpenStatus[]).map((value) => ({
        value,
        label: OPEN_STATUS_LABEL[value],
      })),
    },
  ];
  const renderActions = (r: InviteRow, refresh: () => void) => (
    <OpenInviteActions
      invite={r}
      canManage={canManage}
      onChanged={() => {
        refresh();
        onChanged();
      }}
    />
  );
  return (
    <InviteTable
      key={`${reloadKey}-${status}`}
      fetchPage={fetchOpenInvites}
      filters={filters}
      defaultFilters={{ status: [status] }}
      columns={openColumns}
      itemsLabel="invites"
      searchPlaceholder="Search invites by name or email"
      empty={{
        icon: <Clock />,
        title: `No ${OPEN_STATUS_LABEL[status].toLowerCase()} invites`,
        description:
          status === 'PENDING'
            ? 'Invite people by email; they show up here until they accept.'
            : 'Nothing here right now.',
      }}
      rowActions={renderActions}
      actionsWidth={130}
      onRefresh={onRefresh}
    />
  );
}

// ---------------------------------------------------------------- accepted invites

const fetchAccepted = (query: TableQuery, signal: AbortSignal) =>
  invitesApi.page(query, 'ACCEPTED', signal);

const acceptedColumns: DataTableColumn<InviteRow>[] = [
  rowNumberColumn<InviteRow>(),
  personColumn<InviteRow>(),
  {
    id: 'invitedBy',
    header: 'Invited by',
    width: 220,
    cell: (r) => <span className="text-foreground">{r.invitedBy?.name ?? '—'}</span>,
  },
  dateColumn<InviteRow>('createdAt', 'Invited on', (r) => r.createdAt),
  dateColumn<InviteRow>('acceptedAt', 'Joined on', (r) => r.acceptedAt),
  {
    id: 'groups',
    header: 'Groups',
    width: 90,
    fit: true,
    cell: (r) => (
      <Badge size="sm" tone={r.groupIds.length ? 'warning' : 'neutral'} className="tabular-nums">
        {r.groupIds.length}
      </Badge>
    ),
  },
];

export function AcceptedInvitesTable({
  reloadKey,
  onRefresh,
}: {
  reloadKey: number;
  onRefresh: () => void;
}) {
  const navigate = useNavigate();
  const renderAccepted = (r: InviteRow) => (
    <span className="flex justify-end">
      <TableAction
        tone="info"
        icon={<ScanEye />}
        tooltip="View"
        label={`View ${personName(r) ?? r.email}`}
        disabledReason={r.acceptedUserId ? undefined : 'The account was removed'}
        onClick={() => r.acceptedUserId && void navigate(paths.admin.userDetail(r.acceptedUserId))}
      />
    </span>
  );
  return (
    <InviteTable
      key={reloadKey}
      fetchPage={fetchAccepted}
      columns={acceptedColumns}
      itemsLabel="accepted invites"
      searchPlaceholder="Search by name or email"
      empty={{
        icon: <MailCheck />,
        title: 'No accepted invites yet',
        description: 'People appear here once they open their link and create their account.',
      }}
      rowActions={renderAccepted}
      actionsWidth={80}
      onRefresh={onRefresh}
    />
  );
}

// ---------------------------------------------------------------- self-registered

const registeredColumns: DataTableColumn<UserRow>[] = [
  rowNumberColumn<UserRow>(),
  personColumn<UserRow>(),
  {
    id: 'username',
    header: 'Username',
    width: 180,
    fitText: (r) => [r.username ? `@${r.username}` : '—'],
    cell: (r) => (
      <span className="font-mono text-xs text-muted-foreground">
        {r.username ? `@${r.username}` : '—'}
      </span>
    ),
  },
  {
    id: 'verified',
    header: 'Email',
    width: 130,
    fit: true,
    cell: (r) =>
      r.isEmailVerified ? (
        <span className="inline-flex items-center gap-1 text-xs text-success">
          <BadgeCheck className="size-3.5" aria-hidden="true" /> Verified
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <CircleDashed className="size-3.5" aria-hidden="true" /> Not verified
        </span>
      ),
  },
  {
    id: 'status',
    header: 'Status',
    width: 180,
    cell: (r) => (
      <Badge size="sm" tone={USER_STATUS_TONE[r.status] ?? 'neutral'}>
        {humanize(r.status)}
      </Badge>
    ),
  },
  dateColumn<UserRow>('createdAt', 'Joined on', (r) => r.createdAt),
  dateColumn<UserRow>('lastLoginAt', 'Last sign-in', (r) => r.lastLoginAt),
];

export function RegisteredUsersTable({
  reloadKey,
  onRefresh,
}: {
  reloadKey: number;
  onRefresh: () => void;
}) {
  const navigate = useNavigate();
  const renderRegistered = (r: UserRow) => (
    <span className="flex justify-end">
      <TableAction
        tone="info"
        icon={<ScanEye />}
        tooltip="View"
        label={`View ${personName(r) ?? r.email}`}
        onClick={() => void navigate(paths.admin.userDetail(r.id))}
      />
    </span>
  );
  return (
    <InviteTable
      key={reloadKey}
      fetchPage={invitesApi.registeredPage}
      columns={registeredColumns}
      itemsLabel="sign-ups"
      searchPlaceholder="Search by name, email or username"
      empty={{
        icon: <UserCheck />,
        title: 'No self-registered users',
        description: 'People who sign up on the sign-up page appear here.',
      }}
      onRowOpen={(r) => void navigate(paths.admin.userDetail(r.id))}
      rowActions={renderRegistered}
      actionsWidth={80}
      onRefresh={onRefresh}
    />
  );
}

// ---------------------------------------------------------------- the shared table

function InviteTable<
  T extends { id: string; email: string; firstName: string | null; lastName: string | null },
>({
  fetchPage,
  filters,
  defaultFilters,
  columns,
  itemsLabel,
  searchPlaceholder,
  empty,
  rowActions,
  actionsWidth,
  onRowOpen,
  onRefresh,
}: {
  fetchPage: (query: TableQuery, signal: AbortSignal) => Promise<TablePage<T>>;
  filters?: DataTableFilter[];
  defaultFilters?: Record<string, string[]>;
  columns: DataTableColumn<T>[];
  itemsLabel: string;
  searchPlaceholder: string;
  empty: { icon: ReactNode; title: string; description: string };
  /** `refresh` reloads this table (after a row changed). */
  rowActions: (row: T, refresh: () => void) => ReactNode;
  actionsWidth: number;
  onRowOpen?: (row: T) => void;
  onRefresh: () => void;
}) {
  const table = useServerTable<T>({
    fetchPage,
    getRowId: (r) => r.id,
    filters,
    defaultFilters,
    defaultPageSize: 10,
    itemsLabel,
  });
  return (
    <DataTable
      table={table}
      columns={columns}
      rowActions={(r) => rowActions(r, table.refresh)}
      actionsWidth={actionsWidth}
      layoutKey={`invites:${itemsLabel}`}
      viewOptions={false}
      // Refresh also reloads the page's cards and tab counts.
      onRefresh={onRefresh}
      onRowOpen={onRowOpen}
      itemName={{ singular: itemsLabel.replace(/s$/, ''), plural: itemsLabel }}
      rowLabel={(r) => personName(r) ?? r.email}
      searchPlaceholder={searchPlaceholder}
      emptyState={empty}
    />
  );
}
