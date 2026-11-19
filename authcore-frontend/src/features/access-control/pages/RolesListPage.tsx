import {
  CircleSlash,
  KeyRound,
  Layers,
  Lock,
  Plus,
  ScanEye,
  Shield,
  ShieldCheck,
  Sparkles,
  SquarePen,
  Tags,
  Trash2,
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

import { rolesApi } from '../api/roles.api';
import { RoleFormDialog } from '../components/RoleFormDialog';
import { RolePermissionsDialog } from '../components/RolePermissionsDialog';
import type { Role, RoleCategory, RoleListItem, RoleStats } from '../types/access-control.types';

const humanize = (value: string) =>
  value.charAt(0) + value.slice(1).toLowerCase().replaceAll('_', ' ');

/** Columns (category labels include admin-added categories). */
function buildRoleColumns(
  categoryLabel: (value: string) => string,
): DataTableColumn<RoleListItem>[] {
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
      // Name on the first line, the key under it.
      id: 'roleName',
      header: 'Role',
      sortable: true,
      // As wide as the longest name / key on the page (at most 320 px, then it wraps).
      width: 320,
      fitText: (r) => [r.roleName, r.roleKey],
      wrap: true,
      mobile: 'title',
      cell: (r) => (
        <span className="block min-w-0">
          <span className="block font-medium text-foreground">{r.roleName}</span>
          <code className="block font-mono text-xs break-all text-primary">{r.roleKey}</code>
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
      id: 'description',
      header: 'Description',
      width: 480,
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
      id: 'permissionCount',
      header: 'Permissions',
      width: 112,
      fit: true,
      cell: (r) => (
        <Badge size="sm" tone={r.permissionCount ? 'primary' : 'neutral'} className="tabular-nums">
          <KeyRound className="size-3" aria-hidden="true" />
          {r.permissionCount ?? 0}
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
const RoleStatCards = memo(function RoleStatCards({ stats: s }: { stats: RoleStats | null }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        tone="primary"
        pattern="rings"
        icon={Shield}
        label="Total roles"
        value={s?.totalRoles ?? null}
        hint="Every role"
      />
      <StatCard
        tone="success"
        pattern="waves"
        icon={UsersRound}
        label="Roles in use"
        value={s?.rolesInUse ?? null}
        hint="Given to at least one group"
      />
      <StatCard
        tone="violet"
        pattern="sparkles"
        icon={Sparkles}
        label="Custom roles"
        value={s?.customRoles ?? null}
        hint="Created by admins"
      />
      <StatCard
        tone="info"
        pattern="grid"
        icon={Lock}
        label="Built-in roles"
        value={s?.systemRoles ?? null}
        hint="Fixed, cannot be changed"
      />
      <StatCard
        tone="cyan"
        pattern="dots"
        icon={KeyRound}
        label="Permissions available"
        value={s?.totalPermissions ?? null}
        hint="That roles can grant"
      />
      <StatCard
        tone="primary"
        pattern="bars"
        icon={ShieldCheck}
        label="Permissions in use"
        value={s?.permissionsInUse ?? null}
        hint="Granted by at least one role"
      />
      <StatCard
        tone="danger"
        pattern="stripes"
        icon={CircleSlash}
        label="Roles without permissions"
        value={s?.rolesWithoutPermissions ?? null}
        hint="Grant nothing yet"
      />
      <StatCard
        tone="warning"
        pattern="bubbles"
        icon={Tags}
        label="Categories"
        value={s?.categories ?? null}
        hint="Built-in and custom"
      />
    </div>
  );
});

/** Administration → Access control → Roles. */
export function RolesListPage() {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission('ROLE_CREATE');
  const canUpdate = hasPermission('ROLE_UPDATE');
  const canDelete = hasPermission('ROLE_DELETE');

  const [form, setForm] = useState<{ open: boolean; role: Role | null }>({
    open: false,
    role: null,
  });
  const [deleting, setDeleting] = useState<Role | null>(null);
  const [permissionsOf, setPermissionsOf] = useState<RoleListItem | null>(null);
  const [categoryState, setCategories] = useState<{ key: number; items: RoleCategory[] } | null>(
    null,
  );
  const categories = useMemo(() => categoryState?.items ?? [], [categoryState]);
  const [stats, setStats] = useState<{ key: number; value: RoleStats } | null>(null);
  const [statsKey, setStatsKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        // Reloaded with the counts (a category may have been added in the role popup).
        setCategories({ key: statsKey, items: await rolesApi.categories(controller.signal) });
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
        const value = await rolesApi.stats(controller.signal);
        setStats({ key: statsKey, value });
      } catch (error) {
        if (!isAbortError(error)) notifyError(error, 'Could not load the role counts');
      }
    };
    void load();
    return () => controller.abort();
  }, [statsKey]);

  const categoryLabel = useCallback(
    (value: string) => categories.find((c) => c.value === value)?.label ?? humanize(value),
    [categories],
  );
  const columns = useMemo(() => buildRoleColumns(categoryLabel), [categoryLabel]);

  const filters = useMemo<DataTableFilter[]>(
    () => [
      {
        id: 'category',
        label: 'Category',
        options: categories.map((c) => ({ value: c.value, label: c.label })),
      },
    ],
    [categories],
  );

  const table = useServerTable<RoleListItem>({
    fetchPage: rolesApi.list,
    getRowId: (r) => r.id,
    filters,
    defaultPageSize: 10,
    defaultSort: [{ id: 'updatedAt', desc: true }],
    itemsLabel: 'roles',
  });
  const { refresh } = table;
  const refreshAll = useCallback(() => {
    refresh();
    setStatsKey((n) => n + 1);
  }, [refresh]);

  const renderRowActions = (r: RoleListItem) => (
    <div className="flex items-center justify-end gap-1.5">
      <TableAction
        tone="success"
        icon={<KeyRound />}
        tooltip="Permissions"
        label={`Permissions of ${r.roleName}`}
        onClick={() => setPermissionsOf(r)}
      />
      <TableAction
        tone="info"
        icon={<ScanEye />}
        tooltip="View"
        label={`View ${r.roleName}`}
        onClick={() => void navigate(paths.admin.roleDetail(r.id))}
      />
      {canUpdate && (
        <TableAction
          tone="primary"
          icon={<SquarePen />}
          tooltip="Edit"
          label={`Edit ${r.roleName}`}
          disabledReason={r.isSystem ? 'Built-in roles cannot be edited' : undefined}
          onClick={() => setForm({ open: true, role: r })}
        />
      )}
      {canDelete && (
        <TableAction
          tone="danger"
          icon={<Trash2 />}
          tooltip="Delete"
          label={`Delete ${r.roleName}`}
          disabledReason={r.isSystem ? 'Built-in roles cannot be deleted' : undefined}
          onClick={() => setDeleting(r)}
        />
      )}
    </div>
  );

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await rolesApi.remove(deleting.id);
      notifySuccess(`Role “${deleting.roleName}” deleted`);
      setDeleting(null);
      refreshAll();
    } catch (err) {
      notifyError(err, 'Could not delete the role');
      throw err;
    }
  };

  const s = stats?.value ?? null;

  return (
    <PageContainer>
      <PageHeader
        title="Roles"
        description="Create a role, then use the key icon to choose its permissions. Give roles to groups under Groups."
        actions={
          canCreate && (
            <Button
              size="toolbar"
              leftIcon={<Plus />}
              onClick={() => setForm({ open: true, role: null })}
            >
              Create role
            </Button>
          )
        }
      />

      {/* Memoized: paging / sorting the table does not redraw the cards. */}
      <RoleStatCards stats={s} />

      <DataTable
        table={table}
        columns={columns}
        rowActions={renderRowActions}
        actionsWidth={160}
        layoutKey="admin-roles:v5"
        viewOptions={false}
        // Refresh also reloads the count cards (and categories).
        onRefresh={() => setStatsKey((n) => n + 1)}
        itemName={{ singular: 'role', plural: 'roles' }}
        rowLabel={(r) => r.roleName}
        onRowOpen={(r) => void navigate(paths.admin.roleDetail(r.id))}
        searchPlaceholder="Search roles by name, key or description"
        emptyState={{
          icon: <Layers />,
          title: 'No roles yet',
          description: 'Create a role, then choose the permissions it grants.',
        }}
      />

      <RoleFormDialog
        open={form.open}
        role={form.role}
        onOpenChange={(open) => setForm((f) => ({ ...f, open }))}
        onSaved={(saved, created) => {
          refreshAll();
          // A new role grants nothing yet: go straight to choosing its permissions.
          if (created) setPermissionsOf({ ...saved, permissionCount: 0 });
        }}
      />

      <RolePermissionsDialog
        role={permissionsOf}
        onClose={() => setPermissionsOf(null)}
        onSaved={refreshAll}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete role ${deleting?.roleName ?? ''}?`}
        description="The role is removed and taken away from every group that has it. This cannot be undone."
        confirmText="Delete role"
        destructive
        onConfirm={handleDelete}
      />
    </PageContainer>
  );
}
