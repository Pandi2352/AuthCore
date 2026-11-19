import {
  FolderTree,
  Layers,
  ListTree,
  Network,
  Plus,
  ScanEye,
  Shield,
  SquarePen,
  Tags,
  Trash2,
  UserRoundPlus,
  UserRoundX,
  Users,
  UsersRound,
} from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { DateTime } from '@/components/common/DateTime';
import { StatCard } from '@/components/common/StatCard';
import {
  DataTable,
  TableAction,
  useServerTable,
  type DataTableColumn,
  type DataTableFilter,
} from '@/components/data-table';
import { notifyError, notifySuccess } from '@/components/feedback';
import { PageContainer, PageHeader } from '@/components/page';
import { Badge, Button } from '@/components/ui';
import { paths } from '@/config';
import { usePermissions } from '@/features/auth';
import { isAbortError } from '@/lib/api';

import { groupsApi } from '../api/groups.api';
import { GroupAssignDialog } from '../components/GroupAssignDialog';
import { GroupFormDialog } from '../components/GroupFormDialog';
import type {
  Group,
  GroupCategory,
  GroupListItem,
  GroupStats,
} from '../types/access-control.types';

const humanize = (value: string) =>
  value.charAt(0) + value.slice(1).toLowerCase().replaceAll('_', ' ');

/** Columns (category labels include admin-added categories). */
function buildGroupColumns(
  categoryLabel: (value: string) => string,
): DataTableColumn<GroupListItem>[] {
  return [
    {
      id: 'rowNumber',
      header: 'S.No',
      width: 64,
      fit: true,
      mobile: 'hidden',
      cell: (r) => <span className="text-muted-foreground tabular-nums">{r.rowNumber}</span>,
    },
    {
      // Name on the first line, the group ID under it.
      id: 'groupName',
      header: 'Group',
      sortable: true,
      // As wide as the longest name / ID on the page (at most 320 px, then it wraps).
      width: 320,
      fitText: (r) => [r.groupName, r.groupId],
      wrap: true,
      mobile: 'title',
      cell: (r) => (
        <span className="block min-w-0">
          <span className="block font-medium text-foreground">{r.groupName}</span>
          <code className="block font-mono text-xs break-all text-primary">{r.groupId}</code>
        </span>
      ),
    },
    {
      id: 'category',
      header: 'Category',
      sortable: true,
      width: 150,
      fit: true,
      cell: (r) => (
        <Badge size="sm" tone="neutral">
          {categoryLabel(r.category)}
        </Badge>
      ),
    },
    {
      id: 'parent',
      header: 'Parent',
      width: 220,
      fitText: (r) => [r.parentGroupName ?? 'Top level'],
      wrap: true,
      cell: (r) =>
        r.parentGroupName ? (
          <span className="text-foreground">{r.parentGroupName}</span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <Network className="size-3.5" aria-hidden="true" /> Top level
          </span>
        ),
    },
    {
      id: 'description',
      header: 'Description',
      width: 420,
      wrap: true,
      cell: (r) =>
        r.description ? (
          // Two lines at most; the full text on hover.
          <span className="line-clamp-2 text-muted-foreground" title={r.description}>
            {r.description}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: 'roleCount',
      header: 'Roles',
      width: 84,
      fit: true,
      cell: (r) => (
        <Badge size="sm" tone={r.roleCount ? 'success' : 'neutral'} className="tabular-nums">
          <Shield className="size-3" aria-hidden="true" />
          {r.roleCount ?? 0}
        </Badge>
      ),
    },
    {
      id: 'memberCount',
      header: 'Members',
      width: 100,
      fit: true,
      cell: (r) => (
        <Badge size="sm" tone={r.memberCount ? 'warning' : 'neutral'} className="tabular-nums">
          <Users className="size-3" aria-hidden="true" />
          {r.memberCount ?? 0}
        </Badge>
      ),
    },
    {
      id: 'updatedAt',
      header: 'Updated on',
      sortable: true,
      width: 200,
      fit: true,
      cell: (r) => <DateTime value={r.updatedAt} format="full" />,
    },
  ];
}

/** The eight count cards (props change only when the counts are reloaded). */
const GroupStatCards = memo(function GroupStatCards({ stats: s }: { stats: GroupStats | null }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        tone="primary"
        pattern="rings"
        icon={Layers}
        label="Total groups"
        value={s?.totalGroups ?? null}
        hint="Every group"
      />
      <StatCard
        tone="info"
        pattern="grid"
        icon={Network}
        label="Top-level groups"
        value={s?.topLevelGroups ?? null}
        hint="Not inside another group"
      />
      <StatCard
        tone="violet"
        pattern="sparkles"
        icon={ListTree}
        label="Sub-groups"
        value={s?.subGroups ?? null}
        hint="Inside another group"
      />
      <StatCard
        tone="warning"
        pattern="waves"
        icon={UsersRound}
        label="Members"
        value={s?.members ?? null}
        hint="People in at least one group"
      />
      <StatCard
        tone="success"
        pattern="bars"
        icon={Shield}
        label="Groups with roles"
        value={s?.groupsWithRoles ?? null}
        hint="Giving their members access"
      />
      <StatCard
        tone="danger"
        pattern="stripes"
        icon={UserRoundX}
        label="Groups without members"
        value={s?.groupsWithoutMembers ?? null}
        hint="Nobody in them yet"
      />
      <StatCard
        tone="cyan"
        pattern="dots"
        icon={FolderTree}
        label="Default groups"
        value={s?.defaultGroups ?? null}
        hint="New users join them"
      />
      <StatCard
        tone="primary"
        pattern="bubbles"
        icon={Tags}
        label="Categories"
        value={s?.categories ?? null}
        hint="Built-in and custom"
      />
    </div>
  );
});

/** Administration → Access control → Groups. */
export function GroupsListPage() {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission('GROUP_CREATE');
  const canUpdate = hasPermission('GROUP_UPDATE');
  const canDelete = hasPermission('GROUP_DELETE');
  const canAssign =
    hasPermission('ACCESS_MAPPING_ASSIGN') || hasPermission('ACCESS_MAPPING_REVOKE');

  const [form, setForm] = useState<{ open: boolean; group: Group | null }>({
    open: false,
    group: null,
  });
  const [deleting, setDeleting] = useState<Group | null>(null);
  const [assigning, setAssigning] = useState<Group | null>(null);
  const [categoryState, setCategories] = useState<{ key: number; items: GroupCategory[] } | null>(
    null,
  );
  const categories = useMemo(() => categoryState?.items ?? [], [categoryState]);
  const [stats, setStats] = useState<{ key: number; value: GroupStats } | null>(null);
  const [statsKey, setStatsKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        // Reloaded with the counts (a category may have been added in the group popup).
        setCategories({ key: statsKey, items: await groupsApi.categories(controller.signal) });
      } catch {
        // The filter just has no options.
      }
    };
    void load();
    return () => controller.abort();
  }, [statsKey]);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        setStats({ key: statsKey, value: await groupsApi.stats(controller.signal) });
      } catch (error) {
        if (!isAbortError(error)) notifyError(error, 'Could not load the group counts');
      }
    };
    void load();
    return () => controller.abort();
  }, [statsKey]);

  const categoryLabel = useCallback(
    (value: string) => categories.find((c) => c.value === value)?.label ?? humanize(value),
    [categories],
  );
  const columns = useMemo(() => buildGroupColumns(categoryLabel), [categoryLabel]);

  const filters = useMemo<DataTableFilter[]>(
    () => [
      {
        id: 'category',
        label: 'Category',
        options: categories.map((c) => ({ value: c.value, label: c.label })),
      },
      {
        id: 'level',
        label: 'Level',
        options: [
          { value: 'ROOT', label: 'Top-level groups' },
          { value: 'CHILD', label: 'Sub-groups' },
        ],
      },
    ],
    [categories],
  );

  const table = useServerTable<GroupListItem>({
    fetchPage: groupsApi.list,
    getRowId: (g) => g.id,
    filters,
    defaultPageSize: 10,
    defaultSort: [{ id: 'updatedAt', desc: true }],
    itemsLabel: 'groups',
  });
  const { refresh } = table;
  const refreshAll = useCallback(() => {
    refresh();
    setStatsKey((n) => n + 1);
  }, [refresh]);

  const renderRowActions = (r: GroupListItem) => (
    <div className="flex items-center justify-end gap-1.5">
      {canAssign && (
        <TableAction
          tone="warning"
          icon={<UserRoundPlus />}
          tooltip="Assign"
          label={`Assign roles and members to ${r.groupName}`}
          onClick={() => setAssigning(r)}
        />
      )}
      <TableAction
        tone="info"
        icon={<ScanEye />}
        tooltip="View"
        label={`View ${r.groupName}`}
        onClick={() => void navigate(paths.admin.groupDetail(r.id))}
      />
      {canUpdate && (
        <TableAction
          tone="primary"
          icon={<SquarePen />}
          tooltip="Edit"
          label={`Edit ${r.groupName}`}
          onClick={() => setForm({ open: true, group: r })}
        />
      )}
      {canDelete && (
        <TableAction
          tone="danger"
          icon={<Trash2 />}
          tooltip="Delete"
          label={`Delete ${r.groupName}`}
          onClick={() => setDeleting(r)}
        />
      )}
    </div>
  );

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await groupsApi.remove(deleting.id);
      notifySuccess(`Group “${deleting.groupName}” deleted`);
      setDeleting(null);
      refreshAll();
    } catch (err) {
      notifyError(err, 'Could not delete the group');
      throw err;
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Groups"
        description="Put people in groups and give each group roles. Members get every permission of their groups' roles."
        actions={
          canCreate && (
            <Button
              size="toolbar"
              leftIcon={<Plus />}
              onClick={() => setForm({ open: true, group: null })}
            >
              Create group
            </Button>
          )
        }
      />

      {/* Memoized: paging / sorting the table does not redraw the cards. */}
      <GroupStatCards stats={stats?.value ?? null} />

      <DataTable
        table={table}
        columns={columns}
        rowActions={renderRowActions}
        actionsWidth={160}
        layoutKey="admin-groups:v2"
        viewOptions={false}
        // Refresh also reloads the count cards (and categories).
        onRefresh={() => setStatsKey((n) => n + 1)}
        itemName={{ singular: 'group', plural: 'groups' }}
        rowLabel={(g) => g.groupName}
        onRowOpen={(g) => void navigate(paths.admin.groupDetail(g.id))}
        searchPlaceholder="Search groups by name, ID or description"
        emptyState={{
          icon: <Layers />,
          title: 'No groups yet',
          description: 'Create a group, then give it roles and add people.',
        }}
      />

      <GroupFormDialog
        open={form.open}
        group={form.group}
        onOpenChange={(open) => setForm((f) => ({ ...f, open }))}
        onSaved={(saved, created) => {
          refreshAll();
          // A new group is empty: go straight to giving it roles and members.
          if (created) setAssigning(saved);
        }}
      />

      <GroupAssignDialog
        group={assigning}
        onClose={() => setAssigning(null)}
        onChanged={refreshAll}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete group ${deleting?.groupName ?? ''}?`}
        description="A group can only be deleted once it has no members and no sub-groups. This cannot be undone."
        confirmText="Delete group"
        destructive
        onConfirm={handleDelete}
      />
    </PageContainer>
  );
}
