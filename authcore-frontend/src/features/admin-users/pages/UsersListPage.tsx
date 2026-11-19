import {
  BadgeCheck,
  Download,
  FileDown,
  MailPlus,
  RotateCcw,
  UserPlus,
  Users,
  UserX,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { DateTime } from '@/components/common/DateTime';
import {
  DataTable,
  useServerTable,
  type BulkAction,
  type BulkTarget,
  type DataTableColumn,
  type DataTableFilter,
} from '@/components/data-table';
import { notifyError, notifySuccess } from '@/components/feedback';
import { PageContainer, PageHeader } from '@/components/page';
import { Badge, Button } from '@/components/ui';
import { paths } from '@/config';
import { useAuth, usePermissions } from '@/features/auth';
import { isAbortError } from '@/lib/api';

import { adminUsersApi, toApiFilters } from '../api/admin-users.api';
import { EditUserDialog } from '../components/EditUserDialog';
import { ReportsDialog } from '../components/ReportsDialog';
import { ACTIVITY_LABEL, fullName, ROLE_LABEL, STATUS_LABEL } from '../components/user-labels';
import { RoleCell, StatusCell } from '../components/UserCells';
import { UserRowActions } from '../components/UserRowActions';
import { UserStatCards } from '../components/UserStatCards';
import type {
  AdminUser,
  SettableStatus,
  UserActivity,
  UserReport,
  UserStats,
} from '../types/admin-user.types';

const getRowId = (u: AdminUser) => u.id;
const countOf = (n: number) => `${n} ${n === 1 ? 'user' : 'users'}`;
const isActivity = (value: string | undefined): value is UserActivity =>
  value === 'ACTIVE' || value === 'DORMANT' || value === 'INACTIVE';

const SOURCE_LABEL: Record<AdminUser['source'], string> = {
  REGISTRATION: 'Sign-up page',
  INVITE: 'Invite',
  ADMIN: 'Created by admin',
  SYSTEM: 'System',
};

/** Exact date and time, or "Never". */
const FullDate = ({ value }: { value: string | null }) =>
  value ? (
    <DateTime value={value} format="full" />
  ) : (
    <span className="text-muted-foreground">Never</span>
  );

/** Columns, same style as roles and groups (status shows "Dormant" after `dormantDays`). */
function buildColumns(dormantDays: number): DataTableColumn<AdminUser>[] {
  return [
    {
      id: 'rowNumber',
      header: 'S.No',
      width: 64,
      fit: true,
      mobile: 'hidden',
      cell: (u) => <span className="text-muted-foreground tabular-nums">{u.rowNumber}</span>,
    },
    {
      // Name on the first line, the email under it.
      id: 'name',
      header: 'User',
      sortable: true,
      width: 320,
      fitText: (u) => [fullName(u), u.email],
      wrap: true,
      mobile: 'title',
      cell: (u) => (
        <span className="block min-w-0">
          <span className="block font-medium text-foreground">{fullName(u)}</span>
          <span className="flex items-center gap-1 text-xs break-all text-primary">
            {u.email}
            {u.isEmailVerified && (
              <BadgeCheck className="size-3.5 shrink-0 text-success" aria-label="Email verified" />
            )}
          </span>
        </span>
      ),
    },
    {
      id: 'role',
      header: 'Role',
      width: 90,
      fit: true,
      cell: (u) => <RoleCell user={u} />,
    },
    {
      id: 'status',
      header: 'Status',
      sortable: true,
      width: 220,
      cell: (u) => <StatusCell user={u} dormantAfterDays={dormantDays} />,
    },
    {
      id: 'source',
      header: 'Joined via',
      width: 150,
      fit: true,
      cell: (u) => (
        <Badge size="sm" tone="neutral">
          {SOURCE_LABEL[u.source]}
        </Badge>
      ),
    },
    {
      id: 'lastLoginAt',
      header: 'Last sign-in',
      sortable: true,
      width: 200,
      fit: true,
      cell: (u) => <FullDate value={u.lastLoginAt} />,
    },
    {
      id: 'createdAt',
      header: 'Created on',
      sortable: true,
      width: 200,
      fit: true,
      cell: (u) => <FullDate value={u.createdAt} />,
    },
  ];
}

/** Administration → Users → Search users. */
export function UsersListPage() {
  const navigate = useNavigate();
  const { user: me } = useAuth();
  const { hasPermission } = usePermissions();
  const canUpdate = hasPermission('USER_UPDATE');
  const [statsState, setStats] = useState<{ key: number; value: UserStats } | null>(null);
  const stats = statsState?.value ?? null;
  const [statsKey, setStatsKey] = useState(0);
  const [groups, setGroups] = useState<Array<{ id: string; label: string }>>([]);
  const [editing, setEditing] = useState<{ id: string | null; open: boolean }>({
    id: null,
    open: false,
  });
  const [reports, setReports] = useState<{ key: number; items: UserReport[] } | null>(null);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [reportsKey, setReportsKey] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const dormantDays = stats?.dormantAfterDays ?? 30;

  const filters = useMemo<DataTableFilter[]>(
    () => [
      {
        id: 'activity',
        label: 'Activity',
        options: (Object.keys(ACTIVITY_LABEL) as UserActivity[]).map((value) => ({
          value,
          label: ACTIVITY_LABEL[value],
        })),
      },
      {
        id: 'status',
        label: 'Status',
        options: Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label })),
      },
      {
        id: 'role',
        label: 'Role',
        options: Object.entries(ROLE_LABEL).map(([value, label]) => ({ value, label })),
      },
      ...(groups.length > 0
        ? [
            {
              id: 'group',
              label: 'Group',
              options: groups.map((g) => ({ value: g.id, label: g.label })),
            },
          ]
        : []),
    ],
    [groups],
  );

  const table = useServerTable({
    fetchPage: adminUsersApi.list,
    getRowId,
    filters,
    defaultSort: [{ id: 'lastLoginAt', desc: true }],
    defaultPageSize: 25,
    itemsLabel: 'users',
  });
  const { refresh, setFilter } = table;
  const refreshAll = useCallback(() => {
    refresh();
    setStatsKey((n) => n + 1);
  }, [refresh]);

  // Cards (reloaded after every change: statsKey).
  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const value = await adminUsersApi.stats(controller.signal);
        setStats({ key: statsKey, value });
      } catch (error) {
        if (!isAbortError(error)) notifyError(error, 'Could not load the user counts');
      }
    };
    void load();
    return () => controller.abort();
  }, [statsKey]);

  // Group filter options (only with GROUP_READ).
  useEffect(() => {
    if (!hasPermission('GROUP_READ')) return;
    const controller = new AbortController();
    const load = async () => {
      try {
        setGroups(await adminUsersApi.groups(controller.signal));
      } catch {
        // No groups filter.
      }
    };
    void load();
    return () => controller.abort();
  }, [hasPermission]);

  // Reports: loaded on open / after generating; refreshed every 2 s while one is being built.
  const hasPending = reports?.items.some((r) => r.status === 'PENDING') ?? false;
  /** The report the admin just started: a toast tells them when it is done. */
  const watched = useRef<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const items = await adminUsersApi.reports.list(controller.signal);
        setReports({ key: reportsKey, items });
        const report = items.find((r) => r.id === watched.current);
        if (report && report.status !== 'PENDING') {
          watched.current = null;
          if (report.status === 'READY') {
            notifySuccess('Your report is ready', {
              description: `${report.rowCount ?? 0} users · open “View downloads” to save it.`,
            });
          } else {
            notifyError(new Error(report.error ?? 'Unknown error'), 'The report failed');
          }
        }
      } catch (error) {
        if (!isAbortError(error)) setReports((r) => r ?? { key: reportsKey, items: [] });
      }
    };
    void load();
    return () => controller.abort();
  }, [reportsKey]);
  useEffect(() => {
    if (!hasPending) return;
    const timer = window.setInterval(() => setReportsKey((n) => n + 1), 2000);
    return () => window.clearInterval(timer);
  }, [hasPending]);

  const generateReport = async () => {
    setIsGenerating(true);
    try {
      const report = await adminUsersApi.reports.create(toApiFilters(table.query));
      watched.current = report.id;
      setReportsKey((n) => n + 1);
      notifySuccess('Generating the report…', {
        description: `${countOf(table.total)} with the current search and filters. We’ll let you know when it’s ready.`,
      });
    } catch (error) {
      notifyError(error, 'Could not start the report');
    } finally {
      setIsGenerating(false);
    }
  };

  const selectActivity = useCallback(
    (next: UserActivity | null) => setFilter('activity', next ? [next] : []),
    [setFilter],
  );
  const activity = table.query.filters.activity?.at(-1);
  const selectedActivity = isActivity(activity) ? activity : null;

  const bulkStatus = async (target: BulkTarget, status: SettableStatus) => {
    if (target.mode !== 'ids') {
      notifyError(
        new Error('Select the users on this page, or narrow the filters'),
        'Bulk changes work on selected rows',
      );
      return;
    }
    const ids = target.ids.filter((id) => id !== me?.id);
    const results = await Promise.allSettled(
      ids.map((id) => adminUsersApi.setStatus(id, { status })),
    );
    const failed = results.filter((r) => r.status === 'rejected').length;
    const changed = ids.length - failed;
    if (changed > 0)
      notifySuccess(`${countOf(changed)} ${status === 'ACTIVE' ? 'reactivated' : 'suspended'}`);
    if (failed > 0)
      notifyError(
        new Error('Admins can only be changed by admins; the last active admin is protected.'),
        `${countOf(failed)} could not be changed`,
      );
    refreshAll();
  };

  const bulkActions: BulkAction[] = canUpdate
    ? [
        {
          id: 'suspend',
          label: 'Suspend',
          icon: <UserX />,
          confirm: {
            title: `Suspend ${countOf(table.selectedCount)}?`,
            description: 'They are signed out everywhere and cannot sign in until reactivated.',
            confirmText: 'Suspend',
          },
          run: (target) => bulkStatus(target, 'SUSPENDED'),
        },
        {
          id: 'reactivate',
          label: 'Reactivate',
          icon: <RotateCcw />,
          confirm: {
            title: `Reactivate ${countOf(table.selectedCount)}?`,
            description: 'They can sign in again right away.',
            confirmText: 'Reactivate',
          },
          run: (target) => bulkStatus(target, 'ACTIVE'),
        },
      ]
    : [];

  const openEdit = useCallback((u: AdminUser) => setEditing({ id: u.id, open: true }), []);
  const renderRowActions = useCallback(
    (u: AdminUser) => (
      <UserRowActions
        user={u}
        canUpdate={canUpdate}
        isMe={u.id === me?.id}
        onEdit={openEdit}
        onChanged={refreshAll}
      />
    ),
    [canUpdate, openEdit, refreshAll, me?.id],
  );

  const columns = useMemo(() => buildColumns(dormantDays), [dormantDays]);

  const readyCount = reports?.items.filter((r) => r.status === 'READY').length ?? 0;

  return (
    <PageContainer>
      <PageHeader
        title="Search users"
        description="Search every user by name, email or employee ID, filter by activity, status, role and group, then view, edit or change their access."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="toolbar"
              leftIcon={<FileDown />}
              isLoading={isGenerating}
              className="whitespace-nowrap"
              onClick={() => void generateReport()}
            >
              Generate report
            </Button>
            <Button
              variant="outline"
              size="toolbar"
              leftIcon={<Download />}
              className="whitespace-nowrap"
              onClick={() => {
                setReportsOpen(true);
                setReportsKey((n) => n + 1);
              }}
            >
              View downloads
              {hasPending ? (
                <Badge size="sm" tone="info">
                  …
                </Badge>
              ) : readyCount > 0 ? (
                <Badge size="sm" tone="primary" variant="solid">
                  {readyCount}
                </Badge>
              ) : null}
            </Button>
          </div>
        }
      />

      {/* Memoized: paging / sorting the table does not redraw the cards. */}
      <UserStatCards stats={stats} selected={selectedActivity} onSelect={selectActivity} />

      <DataTable
        table={table}
        columns={columns}
        layoutKey={`admin-users:v3:${me?.id ?? 'anonymous'}`}
        viewOptions={false}
        // Refresh also reloads the count cards.
        onRefresh={() => setStatsKey((n) => n + 1)}
        actionsWidth={170}
        itemName={{ singular: 'user', plural: 'users' }}
        rowLabel={fullName}
        onRowOpen={(u) => void navigate(paths.admin.userDetail(u.id))}
        rowActions={renderRowActions}
        bulkActions={bulkActions}
        searchPlaceholder="Search by name, email or employee ID"
        toolbarActions={
          <div className="flex items-center gap-2">
            {hasPermission('USER_INVITE') && (
              <Button variant="outline" size="toolbar" leftIcon={<MailPlus />} asChild>
                <Link to={paths.admin.invites}>Invite</Link>
              </Button>
            )}
            {hasPermission('USER_CREATE') && (
              <Button variant="outline" size="toolbar" leftIcon={<UserPlus />} asChild>
                <Link to={paths.admin.userCreate}>Create user</Link>
              </Button>
            )}
          </div>
        }
        emptyState={{
          icon: <Users />,
          title: 'No users match',
          description: 'Try another search, or clear the filters.',
        }}
      />

      <EditUserDialog
        userId={editing.id}
        open={editing.open}
        onOpenChange={(open) => setEditing((e) => ({ ...e, open }))}
        onSaved={refreshAll}
      />
      <ReportsDialog
        open={reportsOpen}
        onOpenChange={setReportsOpen}
        reports={reports?.items ?? null}
        onChanged={() => setReportsKey((n) => n + 1)}
      />
    </PageContainer>
  );
}
