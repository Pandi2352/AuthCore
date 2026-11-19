import {
  ChevronDown,
  ChevronRight,
  FolderTree,
  Grid3X3,
  Layers,
  Pencil,
  Plus,
  RefreshCw,
  Table as TableIcon,
  Trash2,
  Users,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { DateTime } from '@/components/common/DateTime';
import {
  DataTable,
  useServerTable,
  type DataTableColumn,
  type DataTableFilter,
} from '@/components/data-table';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  notifyError,
  notifySuccess,
} from '@/components/feedback';
import { PageContainer, PageHeader } from '@/components/page';
import {
  Badge,
  Button,
  IconButton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui';
import { usePermissions } from '@/features/auth';

import { groupsApi } from '../api/groups.api';
import { GroupEditorSheet } from '../components/GroupEditorSheet';
import { GroupMatrixSheet } from '../components/GroupMatrixSheet';
import type { Group, GroupListItem, GroupTreeNode } from '../types/access-control.types';

function buildGroupColumns(): DataTableColumn<GroupListItem>[] {
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
      id: 'groupName',
      header: 'Group',
      sortable: true,
      width: 260,
      mobile: 'title',
      cell: (r) => (
        <div className="flex flex-col">
          <span className="font-semibold text-foreground">{r.groupName}</span>
          <code className="text-2xs text-muted-foreground">{r.groupId}</code>
        </div>
      ),
    },
    {
      id: 'category',
      header: 'Category',
      sortable: true,
      width: 140,
      cell: (r) => (
        <Badge size="sm" tone="primary">
          {r.category}
        </Badge>
      ),
    },
    {
      id: 'parent',
      header: 'Parent Group',
      width: 180,
      cell: (r) =>
        r.parentGroup ? (
          <span className="text-sm text-foreground">{r.parentGroup.groupName}</span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      id: 'level',
      header: 'Level',
      sortable: true,
      width: 100,
      cell: (r) => (
        <Badge size="sm" tone={r.level === 'ROOT' ? 'info' : 'neutral'}>
          {r.level}
        </Badge>
      ),
    },
    {
      id: 'stats',
      header: 'Members & Roles',
      width: 160,
      cell: (r) => (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{r.memberCount ?? 0} members</span>
          <span>·</span>
          <span>{r.roleCount ?? 0} roles</span>
        </div>
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

const groupColumns = buildGroupColumns();

export function GroupsListPage() {
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission('GROUP_CREATE');
  const canUpdate = hasPermission('GROUP_UPDATE');
  const canDelete = hasPermission('GROUP_DELETE');

  const [activeTab, setActiveTab] = useState<'table' | 'tree'>('table');

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);

  const [matrixOpen, setMatrixOpen] = useState(false);
  const [matrixGroupId, setMatrixGroupId] = useState<string | null>(null);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingGroup, setDeletingGroup] = useState<Group | null>(null);

  const [categories, setCategories] = useState<Array<{ value: string; label: string }>>([]);
  const [treeResetKey, setTreeResetKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void groupsApi
      .categories(controller.signal)
      .then(setCategories)
      .catch(() => {});
    return () => controller.abort();
  }, []);

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

  const table = useServerTable<GroupListItem>({
    fetchPage: groupsApi.list,
    getRowId: (g) => g.id,
    filters,
    defaultPageSize: 10,
    defaultSort: [{ id: 'updatedAt', desc: true }],
    itemsLabel: 'groups',
  });

  const handleDelete = async () => {
    if (!deletingGroup) return;
    try {
      await groupsApi.remove(deletingGroup.id);
      notifySuccess(`Group "${deletingGroup.groupName}" deleted`);
      setDeleteConfirmOpen(false);
      setDeletingGroup(null);
      table.refresh();
      setTreeResetKey((k) => k + 1);
    } catch (err) {
      notifyError(err, 'Could not delete group');
    }
  };

  const handleSaved = () => {
    table.refresh();
    setTreeResetKey((k) => k + 1);
  };

  const renderRowActions = (r: GroupListItem) => (
    <div className="flex items-center justify-end gap-1">
      <IconButton
        aria-label={`View permission matrix for ${r.groupName}`}
        icon={<Grid3X3 />}
        variant="ghost"
        size="sm"
        className="size-7! pointer-coarse:size-11!"
        onClick={() => {
          setMatrixGroupId(r.id);
          setMatrixOpen(true);
        }}
      />
      {canUpdate && (
        <IconButton
          aria-label={`Edit ${r.groupName}`}
          icon={<Pencil />}
          variant="ghost"
          size="sm"
          className="size-7! pointer-coarse:size-11!"
          onClick={() => {
            setEditingGroup(r);
            setEditorOpen(true);
          }}
        />
      )}
      {canDelete && (
        <IconButton
          aria-label={`Delete ${r.groupName}`}
          icon={<Trash2 />}
          variant="ghost"
          size="sm"
          className="text-destructive hover:bg-destructive/10 size-7! pointer-coarse:size-11!"
          onClick={() => {
            setDeletingGroup(r);
            setDeleteConfirmOpen(true);
          }}
        />
      )}
    </div>
  );

  return (
    <PageContainer>
      <PageHeader
        title="Permission Groups"
        description="Organize users into structural and functional groups with hierarchical role and permission inheritance."
        actions={
          canCreate && (
            <Button
              size="sm"
              leftIcon={<Plus />}
              onClick={() => {
                setEditingGroup(null);
                setEditorOpen(true);
              }}
            >
              Create group
            </Button>
          )
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex items-center gap-3 rounded-md border border-border bg-surface p-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Users className="size-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total groups</p>
            <p className="text-xl font-bold text-foreground">{table.total}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-md border border-border bg-surface p-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-info/10 text-info">
            <FolderTree className="size-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Group categories</p>
            <p className="text-xl font-bold text-foreground">{categories.length}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-md border border-border bg-surface p-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-success/10 text-success">
            <Layers className="size-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Inheritance model</p>
            <p className="text-sm font-semibold text-foreground">Multi-Tier Cascading RBAC</p>
          </div>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as 'table' | 'tree')}
        variant="pills"
      >
        <div className="flex items-center justify-between pb-2">
          <TabsList>
            <TabsTrigger value="table" className="flex items-center gap-2">
              <TableIcon className="size-4" />
              Table View
            </TabsTrigger>
            <TabsTrigger value="tree" className="flex items-center gap-2">
              <FolderTree className="size-4" />
              Hierarchy Tree
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="table">
          <DataTable
            table={table}
            columns={groupColumns}
            rowActions={renderRowActions}
            layoutKey="admin-groups"
            itemName={{ singular: 'group', plural: 'groups' }}
            rowLabel={(g) => g.groupName}
            searchPlaceholder="Search groups by code, name, or description..."
            emptyState={{
              icon: <Users />,
              title: 'No permission groups found',
              description:
                'Create a group to start granting roles and permissions to collections of users.',
            }}
          />
        </TabsContent>

        <TabsContent value="tree">
          {activeTab === 'tree' && (
            <GroupHierarchyTree
              key={treeResetKey}
              canUpdate={canUpdate}
              canDelete={canDelete}
              onViewMatrix={(id) => {
                setMatrixGroupId(id);
                setMatrixOpen(true);
              }}
              onEdit={(node) => {
                setEditingGroup({
                  id: node.id,
                  groupId: node.groupId,
                  groupName: node.groupName,
                  category: node.category,
                  description: '',
                  status: node.status,
                  level: node.level,
                  parentGroupId: null,
                  tags: [],
                  version: 1,
                  createdAt: '',
                  updatedAt: '',
                });
                setEditorOpen(true);
              }}
              onDelete={(node) => {
                setDeletingGroup({
                  id: node.id,
                  groupId: node.groupId,
                  groupName: node.groupName,
                  category: node.category,
                  description: '',
                  status: node.status,
                  level: node.level,
                  parentGroupId: null,
                  tags: [],
                  version: 1,
                  createdAt: '',
                  updatedAt: '',
                });
                setDeleteConfirmOpen(true);
              }}
            />
          )}
        </TabsContent>
      </Tabs>

      <GroupEditorSheet
        open={editorOpen}
        group={editingGroup}
        onOpenChange={setEditorOpen}
        onSaved={handleSaved}
      />

      <GroupMatrixSheet open={matrixOpen} groupId={matrixGroupId} onOpenChange={setMatrixOpen} />

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title={`Delete group ${deletingGroup?.groupName}?`}
        description="This will permanently delete the group. Any nested child groups or assigned users will lose associated group roles and permissions."
        confirmText="Delete group"
        destructive
        onConfirm={handleDelete}
      />
    </PageContainer>
  );
}

function GroupHierarchyTree({
  canUpdate,
  canDelete,
  onViewMatrix,
  onEdit,
  onDelete,
}: {
  canUpdate: boolean;
  canDelete: boolean;
  onViewMatrix: (id: string) => void;
  onEdit: (node: GroupTreeNode) => void;
  onDelete: (node: GroupTreeNode) => void;
}) {
  const [treeData, setTreeData] = useState<GroupTreeNode[]>([]);
  const [isTreeLoading, setIsTreeLoading] = useState(true);
  const [treeError, setTreeError] = useState<unknown | null>(null);

  const fetchTree = useCallback(async (signal?: AbortSignal) => {
    setIsTreeLoading(true);
    setTreeError(null);
    try {
      const data = await groupsApi.tree(undefined, signal);
      setTreeData(data);
    } catch (err) {
      if (!signal?.aborted) {
        setTreeError(err);
      }
    } finally {
      if (!signal?.aborted) {
        setIsTreeLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    const run = async () => {
      try {
        const data = await groupsApi.tree(undefined, controller.signal);
        if (!cancelled) {
          setTreeData(data);
        }
      } catch (err) {
        if (!cancelled && !controller.signal.aborted) {
          setTreeError(err);
        }
      } finally {
        if (!cancelled) {
          setIsTreeLoading(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  return (
    <div className="space-y-3 rounded-md border border-border bg-surface p-4">
      <div className="flex items-center justify-between pb-1">
        <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          Organizational Tree ({treeData.length} root branches)
        </span>
        <IconButton
          aria-label="Refresh tree"
          icon={<RefreshCw className={`size-4 ${isTreeLoading ? 'animate-spin' : ''}`} />}
          variant="outline"
          size="sm"
          onClick={() => void fetchTree()}
        />
      </div>

      {isTreeLoading ? (
        <LoadingState label="Loading hierarchy tree..." />
      ) : treeError ? (
        <ErrorState
          error={treeError}
          title="Failed to load hierarchy"
          onRetry={() => void fetchTree()}
        />
      ) : treeData.length === 0 ? (
        <EmptyState
          icon={<FolderTree />}
          title="No group hierarchy"
          description="Create root and child groups to see your organizational hierarchy here."
        />
      ) : (
        <div className="space-y-2">
          {treeData.map((node) => (
            <TreeNodeItem
              key={node.id}
              node={node}
              canUpdate={canUpdate}
              canDelete={canDelete}
              onViewMatrix={onViewMatrix}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TreeNodeItem({
  node,
  canUpdate,
  canDelete,
  onViewMatrix,
  onEdit,
  onDelete,
  depth = 0,
}: {
  node: GroupTreeNode;
  canUpdate: boolean;
  canDelete: boolean;
  onViewMatrix: (id: string) => void;
  onEdit: (node: GroupTreeNode) => void;
  onDelete: (node: GroupTreeNode) => void;
  depth?: number;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div className="space-y-1">
      <div
        className="flex items-center justify-between rounded-md border border-border/60 bg-surface px-3 py-2 text-sm hover:border-border hover:bg-muted/30"
        style={{ marginLeft: `${depth * 24}px` }}
      >
        <div className="flex min-w-0 items-center gap-2">
          {hasChildren ? (
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
            </button>
          ) : (
            <div className="size-4" />
          )}

          <FolderTree className="size-4 shrink-0 text-primary" />
          <span className="truncate font-semibold text-foreground">{node.groupName}</span>
          <code className="text-2xs text-muted-foreground">{node.groupId}</code>
          <Badge size="sm" tone={node.level === 'ROOT' ? 'info' : 'neutral'}>
            {node.level}
          </Badge>
          <Badge size="sm" tone="primary">
            {node.category}
          </Badge>
          <span className="text-2xs hidden text-muted-foreground sm:inline">
            {node.memberCount ?? 0} members · {node.roleCount ?? 0} roles
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <IconButton
            aria-label={`View matrix for ${node.groupName}`}
            icon={<Grid3X3 />}
            variant="ghost"
            size="sm"
            className="size-7! pointer-coarse:size-11!"
            onClick={() => onViewMatrix(node.id)}
          />
          {canUpdate && (
            <IconButton
              aria-label={`Edit ${node.groupName}`}
              icon={<Pencil />}
              variant="ghost"
              size="sm"
              className="size-7! pointer-coarse:size-11!"
              onClick={() => onEdit(node)}
            />
          )}
          {canDelete && (
            <IconButton
              aria-label={`Delete ${node.groupName}`}
              icon={<Trash2 />}
              variant="ghost"
              size="sm"
              className="text-destructive hover:bg-destructive/10 size-7! pointer-coarse:size-11!"
              onClick={() => onDelete(node)}
            />
          )}
        </div>
      </div>

      {hasChildren && expanded && (
        <div className="space-y-1">
          {node.children.map((child) => (
            <TreeNodeItem
              key={child.id}
              node={child}
              canUpdate={canUpdate}
              canDelete={canDelete}
              onViewMatrix={onViewMatrix}
              onEdit={onEdit}
              onDelete={onDelete}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
