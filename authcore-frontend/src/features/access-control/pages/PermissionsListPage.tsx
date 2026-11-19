import { Pencil, Plus, ShieldCheck, Tag, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

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

import { permissionsApi } from '../api/permissions.api';
import { PermissionEditorSheet } from '../components/PermissionEditorSheet';
import type { Permission, PermissionListItem } from '../types/access-control.types';

function buildPermissionColumns(): DataTableColumn<PermissionListItem>[] {
  return [
    {
      id: 'rowNumber',
      header: '#',
      numeric: true,
      width: 60,
      mobile: 'hidden',
      cell: (p) => <span className="text-muted-foreground tabular-nums">{p.rowNumber}</span>,
    },
    {
      id: 'permissionName',
      header: 'Permission',
      sortable: true,
      width: 260,
      mobile: 'title',
      cell: (p) => (
        <div className="flex flex-col">
          <span className="font-semibold text-foreground">{p.permissionName}</span>
          <code className="text-2xs text-muted-foreground">{p.permissionKey}</code>
        </div>
      ),
    },
    {
      id: 'metadata',
      header: 'Tags & action',
      width: 200,
      cell: (p) => (
        <div className="flex flex-wrap gap-1">
          {p.metadata && p.metadata.length > 0 ? (
            p.metadata.slice(0, 3).map((m) => (
              <span
                key={`${m.key}:${m.value}:${m.action}`}
                className="text-2xs inline-flex items-center gap-1 rounded-md border border-border bg-muted/60 px-1.5 py-0.5 font-mono text-muted-foreground"
              >
                <Tag className="size-2.5" />
                {m.value}:{m.action}
              </span>
            ))
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      sortable: true,
      width: 110,
      cell: (p) => (
        <Badge size="sm" tone={p.status === 'ACTIVE' ? 'success' : 'neutral'}>
          {p.status}
        </Badge>
      ),
    },
    {
      id: 'updatedAt',
      header: 'Updated',
      sortable: true,
      width: 140,
      mobile: 'subtitle',
      cell: (p) => <DateTime value={p.updatedAt} format="relative" />,
    },
  ];
}

const permissionColumns = buildPermissionColumns();

export function PermissionsListPage() {
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission('PERMISSION_CREATE');
  const canUpdate = hasPermission('PERMISSION_UPDATE');
  const canDelete = hasPermission('PERMISSION_DELETE');

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingPerm, setEditingPerm] = useState<Permission | null>(null);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingPerm, setDeletingPerm] = useState<Permission | null>(null);

  const [actions, setActions] = useState<Array<{ value: string; label: string }>>([]);

  useEffect(() => {
    const controller = new AbortController();
    void permissionsApi
      .actions(controller.signal)
      .then(setActions)
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const filters = useMemo<DataTableFilter[]>(
    () => [
      {
        id: 'action',
        label: 'Action',
        options: actions.map((a) => ({ value: a.value, label: a.label })),
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
    [actions],
  );

  const table = useServerTable<PermissionListItem>({
    fetchPage: permissionsApi.list,
    getRowId: (p) => p.id,
    filters,
    defaultPageSize: 10,
    defaultSort: [{ id: 'updatedAt', desc: true }],
    itemsLabel: 'permissions',
  });

  const handleDelete = async () => {
    if (!deletingPerm) return;
    try {
      await permissionsApi.remove(deletingPerm.id);
      notifySuccess(`Permission "${deletingPerm.permissionName}" deleted`);
      setDeleteConfirmOpen(false);
      setDeletingPerm(null);
      table.refresh();
    } catch (err) {
      notifyError(err, 'Could not delete permission');
    }
  };

  const renderRowActions = (p: PermissionListItem) => (
    <div className="flex items-center justify-end gap-1">
      {canUpdate && (
        <IconButton
          aria-label={`Edit ${p.permissionName}`}
          icon={<Pencil />}
          variant="ghost"
          size="sm"
          className="size-7! pointer-coarse:size-11!"
          onClick={() => {
            setEditingPerm(p);
            setEditorOpen(true);
          }}
        />
      )}
      {canDelete && (
        <IconButton
          aria-label={`Delete ${p.permissionName}`}
          icon={<Trash2 />}
          variant="ghost"
          size="sm"
          className="text-destructive hover:bg-destructive/10 size-7! pointer-coarse:size-11!"
          onClick={() => {
            setDeletingPerm(p);
            setDeleteConfirmOpen(true);
          }}
        />
      )}
    </div>
  );

  return (
    <PageContainer>
      <PageHeader
        title="Permissions"
        description="Individual action tokens and capabilities that can be assigned to custom roles."
        actions={
          canCreate && (
            <Button
              size="sm"
              leftIcon={<Plus />}
              onClick={() => {
                setEditingPerm(null);
                setEditorOpen(true);
              }}
            >
              Create permission
            </Button>
          )
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex items-center gap-3 rounded-md border border-border bg-surface p-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <ShieldCheck className="size-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total permissions</p>
            <p className="text-xl font-bold text-foreground">{table.total}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-md border border-border bg-surface p-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-info/10 text-info">
            <Tag className="size-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Action types</p>
            <p className="text-xl font-bold text-foreground">{actions.length}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-md border border-border bg-surface p-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-success/10 text-success">
            <ShieldCheck className="size-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Guard enforcement</p>
            <p className="text-sm font-semibold text-foreground">Strict NestJS Casbin/RBAC</p>
          </div>
        </div>
      </div>

      <DataTable
        table={table}
        columns={permissionColumns}
        rowActions={renderRowActions}
        layoutKey="admin-permissions"
        itemName={{ singular: 'permission', plural: 'permissions' }}
        rowLabel={(p) => p.permissionName}
        searchPlaceholder="Search permissions by key, name, or metadata..."
        emptyState={{
          icon: <ShieldCheck />,
          title: 'No permissions found',
          description: 'Create a new permission to define granular operations.',
        }}
      />

      <PermissionEditorSheet
        open={editorOpen}
        permission={editingPerm}
        onOpenChange={setEditorOpen}
        onSaved={table.refresh}
      />

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title={`Delete permission ${deletingPerm?.permissionName}?`}
        description="This will permanently delete the permission token and remove it from any assigned roles. This action cannot be undone."
        confirmText="Delete permission"
        destructive
        onConfirm={handleDelete}
      />
    </PageContainer>
  );
}
