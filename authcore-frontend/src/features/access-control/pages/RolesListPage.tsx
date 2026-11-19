import { Eye, KeyRound, Lock, Pencil, Plus, Shield, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { DateTime } from '@/components/common/DateTime';
import {
  DataTable,
  useServerTable,
  type DataTableColumn,
  type DataTableFilter,
} from '@/components/data-table';
import { notifyError, notifySuccess } from '@/components/feedback';
import { PageContainer, PageHeader } from '@/components/page';
import { Badge, Button, IconButton } from '@/components/ui';
import { usePermissions } from '@/features/auth';

import { rolesApi } from '../api/roles.api';
import { RoleDetailSheet } from '../components/RoleDetailSheet';
import { RoleEditorSheet } from '../components/RoleEditorSheet';
import type { Role, RoleListItem } from '../types/access-control.types';

function buildRoleColumns(): DataTableColumn<RoleListItem>[] {
  return [
    {
      id: 'rowNumber',
      header: '#',
      numeric: true,
      width: 60,
      mobile: 'hidden',
      cell: (r) => <span className="text-muted-foreground tabular-nums">{r.rowNumber}</span>,
    },
    {
      id: 'roleName',
      header: 'Role',
      sortable: true,
      width: 260,
      mobile: 'title',
      cell: (r) => (
        <div className="flex flex-col">
          <span className="font-semibold text-foreground">{r.roleName}</span>
          <code className="text-2xs text-muted-foreground">{r.roleKey}</code>
        </div>
      ),
    },
    {
      id: 'category',
      header: 'Category',
      sortable: true,
      width: 140,
      cell: (r) => (
        <Badge size="sm" tone={r.isSystem ? 'info' : 'primary'}>
          {r.category}
        </Badge>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      sortable: true,
      width: 110,
      cell: (r) => (
        <Badge size="sm" tone={r.status === 'ACTIVE' ? 'success' : 'neutral'}>
          {r.status}
        </Badge>
      ),
    },
    {
      id: 'updatedAt',
      header: 'Updated',
      sortable: true,
      width: 140,
      mobile: 'subtitle',
      cell: (r) => <DateTime value={r.updatedAt} format="relative" />,
    },
  ];
}

const roleColumns = buildRoleColumns();

export function RolesListPage() {
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission('ROLE_CREATE');
  const canUpdate = hasPermission('ROLE_UPDATE');
  const canDelete = hasPermission('ROLE_DELETE');

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRoleId, setDetailRoleId] = useState<string | null>(null);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingRole, setDeletingRole] = useState<Role | null>(null);

  const [categories, setCategories] = useState<Array<{ value: string; label: string }>>([]);

  useEffect(() => {
    const controller = new AbortController();
    void rolesApi
      .categories(controller.signal)
      .then(setCategories)
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const fetchRoles = useCallback(
    (query: Parameters<typeof rolesApi.list>[0], signal: AbortSignal) =>
      rolesApi.list(query, signal),
    [],
  );

  const table = useServerTable<RoleListItem>({
    fetch: fetchRoles,
    initialPageSize: 10,
    initialSort: [{ id: 'updatedAt', desc: true }],
  });

  const renderRowActions = (r: RoleListItem) => (
    <div className="flex items-center justify-end gap-1">
      <IconButton
        aria-label={`View ${r.roleName}`}
        icon={<Eye />}
        variant="ghost"
        size="sm"
        className="size-7! pointer-coarse:size-11!"
        onClick={() => {
          setDetailRoleId(r.id);
          setDetailOpen(true);
        }}
      />
      {canUpdate && !r.isSystem && (
        <IconButton
          aria-label={`Edit ${r.roleName}`}
          icon={<Pencil />}
          variant="ghost"
          size="sm"
          className="size-7! pointer-coarse:size-11!"
          onClick={() => {
            setEditingRole(r);
            setEditorOpen(true);
          }}
        />
      )}
      {canDelete && !r.isSystem && (
        <IconButton
          aria-label={`Delete ${r.roleName}`}
          icon={<Trash2 />}
          variant="ghost"
          size="sm"
          className="text-destructive hover:bg-destructive/10 size-7! pointer-coarse:size-11!"
          onClick={() => {
            setDeletingRole(r);
            setDeleteConfirmOpen(true);
          }}
        />
      )}
    </div>
  );

  const filters = useMemo<DataTableFilter[]>(
    () => [
      {
        id: 'category',
        label: 'Category',
        options: categories.map((c) => ({ value: c.value, label: c.label })),
      },
      {
        id: 'status',
        label: 'Status',
        options: [
          { value: 'ACTIVE', label: 'Active' },
          { value: 'INACTIVE', label: 'Inactive' },
        ],
      },
    ],
    [categories],
  );

  const handleDelete = async () => {
    if (!deletingRole) return;
    try {
      await rolesApi.remove(deletingRole.id);
      notifySuccess(`Role "${deletingRole.roleName}" deleted`);
      setDeleteConfirmOpen(false);
      setDeletingRole(null);
      table.reload();
    } catch (err) {
      notifyError(err, 'Could not delete role');
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Roles"
        description="Define authority levels, functional roles, and permission bundles for users and groups."
        actions={
          canCreate && (
            <Button
              size="sm"
              leftIcon={<Plus />}
              onClick={() => {
                setEditingRole(null);
                setEditorOpen(true);
              }}
            >
              Create role
            </Button>
          )
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex items-center gap-3 rounded-md border border-border bg-surface p-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Shield className="size-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Configured roles</p>
            <p className="text-xl font-bold text-foreground">{table.total}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-md border border-border bg-surface p-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-success/10 text-success">
            <KeyRound className="size-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Role categories</p>
            <p className="text-xl font-bold text-foreground">{categories.length}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-md border border-border bg-surface p-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-info/10 text-info">
            <Lock className="size-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Access model</p>
            <p className="text-sm font-semibold text-foreground">RBAC + Group Inheritance</p>
          </div>
        </div>
      </div>

      <DataTable
        table={table}
        columns={roleColumns}
        rowActions={renderRowActions}
        filters={filters}
        layoutKey="admin-roles"
        itemName={{ singular: 'role', plural: 'roles' }}
        rowLabel={(r) => r.roleName}
        searchPlaceholder="Search roles by key, name, or description..."
        emptyState={{
          icon: <Shield />,
          title: 'No roles found',
          description: 'Create a new role to grant permissions to groups.',
        }}
      />

      <RoleEditorSheet
        open={editorOpen}
        role={editingRole}
        onOpenChange={setEditorOpen}
        onSaved={table.reload}
      />

      <RoleDetailSheet open={detailOpen} roleId={detailRoleId} onOpenChange={setDetailOpen} />

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title={`Delete role ${deletingRole?.roleName}?`}
        description="This will permanently delete the custom role and revoke it from any assigned groups. This action cannot be undone."
        confirmText="Delete role"
        destructive
        onConfirm={handleDelete}
      />
    </PageContainer>
  );
}
