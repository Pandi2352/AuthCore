import { CalendarClock, Clock, Plus, ShieldCheck, Trash2, UserCheck } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

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
import { Badge, Button, IconButton, Tabs, TabsList, TabsTrigger } from '@/components/ui';
import { usePermissions } from '@/features/auth';

import { accessMappingsApi } from '../api/access-mappings.api';
import { AssignModal } from '../components/AssignModal';
import { EditExpiryDialog } from '../components/EditExpiryDialog';
import type {
  AccessMapping,
  AccessMappingListItem,
  MappingType,
} from '../types/access-control.types';

function buildAssignmentColumns(): DataTableColumn<AccessMappingListItem>[] {
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
      id: 'type',
      header: 'Type',
      sortable: true,
      width: 170,
      cell: (r) => {
        if (r.type === 'GROUP_USER') {
          return (
            <Badge size="sm" tone="primary">
              User Membership
            </Badge>
          );
        }
        if (r.type === 'GROUP_ROLE') {
          return (
            <Badge size="sm" tone="info">
              Group Role
            </Badge>
          );
        }
        return (
          <Badge size="sm" tone="neutral">
            Role Permission
          </Badge>
        );
      },
    },
    {
      id: 'assignment',
      header: 'Mapping Details',
      width: 320,
      mobile: 'title',
      cell: (r) => {
        if (r.type === 'GROUP_USER') {
          const userName = r.user
            ? `${r.user.firstName} ${r.user.lastName ?? ''}`.trim() || r.user.email
            : 'Unknown user';
          return (
            <div className="flex flex-col">
              <span className="font-semibold text-foreground">
                {userName} <span className="font-normal text-muted-foreground">in group</span>{' '}
                <span className="font-medium text-primary">{r.group?.groupName ?? '—'}</span>
              </span>
              <span className="text-2xs text-muted-foreground">{r.user?.email}</span>
            </div>
          );
        }
        if (r.type === 'GROUP_ROLE') {
          return (
            <div className="flex flex-col">
              <span className="font-semibold text-foreground">
                {r.group?.groupName ?? '—'}{' '}
                <span className="font-normal text-muted-foreground">holds role</span>{' '}
                <span className="font-medium text-primary">{r.role?.roleName ?? '—'}</span>
              </span>
              <code className="text-2xs text-muted-foreground">{r.role?.roleKey}</code>
            </div>
          );
        }
        return (
          <div className="flex flex-col">
            <span className="font-semibold text-foreground">
              {r.role?.roleName ?? '—'}{' '}
              <span className="font-normal text-muted-foreground">grants</span>{' '}
              <span className="font-medium text-primary">
                {r.permission?.permissionName ?? '—'}
              </span>
            </span>
            <code className="text-2xs text-muted-foreground">{r.permission?.permissionKey}</code>
          </div>
        );
      },
    },
    {
      id: 'expiresAt',
      header: 'Expiry',
      width: 170,
      cell: (r) => {
        if (r.isExpired) {
          return (
            <Badge size="sm" tone="danger">
              Expired
            </Badge>
          );
        }
        if (!r.expiresAt) {
          return (
            <Badge size="sm" tone="neutral">
              Permanent
            </Badge>
          );
        }
        return (
          <div className="flex flex-col">
            <span className="text-xs font-medium text-warning">Temporary</span>
            <span className="text-2xs text-muted-foreground">
              <DateTime value={r.expiresAt} format="datetime" />
            </span>
          </div>
        );
      },
    },
    {
      id: 'assignedAt',
      header: 'Assigned',
      sortable: true,
      width: 140,
      mobile: 'subtitle',
      cell: (r) => <DateTime value={r.assignedAt} format="relative" />,
    },
  ];
}

const assignmentColumns = buildAssignmentColumns();

export function AccessAssignmentsPage() {
  const { hasPermission } = usePermissions();
  const canAssign = hasPermission('ACCESS_MAPPING_ASSIGN');
  const canRevoke = hasPermission('ACCESS_MAPPING_REVOKE');

  const [activeTab, setActiveTab] = useState<string>('ALL');

  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignDefaultType, setAssignDefaultType] = useState<MappingType>('GROUP_USER');

  const [expiryDialogOpen, setExpiryDialogOpen] = useState(false);
  const [selectedMapping, setSelectedMapping] = useState<AccessMapping | null>(null);

  const [revokeConfirmOpen, setRevokeConfirmOpen] = useState(false);
  const [revokingMapping, setRevokingMapping] = useState<AccessMapping | null>(null);

  const fetchMappings = useCallback(
    (query: Parameters<typeof accessMappingsApi.list>[0], signal: AbortSignal) => {
      const type = activeTab === 'ALL' ? undefined : (activeTab as MappingType);
      return accessMappingsApi.list({ ...query, type }, signal);
    },
    [activeTab],
  );

  const filters = useMemo<DataTableFilter[]>(
    () => [
      {
        id: 'type',
        label: 'Type',
        options: [
          { value: 'GROUP_USER', label: 'User Membership' },
          { value: 'GROUP_ROLE', label: 'Group Role' },
          { value: 'ROLE_PERMISSION', label: 'Role Permission' },
        ],
      },
    ],
    [],
  );

  const table = useServerTable<AccessMappingListItem>({
    fetchPage: fetchMappings,
    getRowId: (m) => m.id,
    filters,
    defaultPageSize: 10,
    defaultSort: [{ id: 'assignedAt', desc: true }],
    itemsLabel: 'assignments',
  });

  const handleRevoke = async () => {
    if (!revokingMapping) return;
    try {
      await accessMappingsApi.remove(revokingMapping.id);
      notifySuccess('Assignment revoked');
      setRevokeConfirmOpen(false);
      setRevokingMapping(null);
      table.refresh();
    } catch (err) {
      notifyError(err, 'Could not revoke assignment');
    }
  };

  const openNewAssign = (type: MappingType) => {
    setAssignDefaultType(type);
    setAssignModalOpen(true);
  };

  const renderRowActions = (r: AccessMappingListItem) => (
    <div className="flex items-center justify-end gap-1">
      {canAssign && (
        <IconButton
          aria-label="Edit assignment expiry"
          icon={<CalendarClock />}
          variant="ghost"
          size="sm"
          className="size-7! pointer-coarse:size-11!"
          onClick={() => {
            setSelectedMapping(r);
            setExpiryDialogOpen(true);
          }}
        />
      )}
      {canRevoke && (
        <IconButton
          aria-label="Revoke assignment"
          icon={<Trash2 />}
          variant="ghost"
          size="sm"
          className="text-destructive hover:bg-destructive/10 size-7! pointer-coarse:size-11!"
          onClick={() => {
            setRevokingMapping(r);
            setRevokeConfirmOpen(true);
          }}
        />
      )}
    </div>
  );

  return (
    <PageContainer>
      <PageHeader
        title="Access Assignments"
        description="Audit and govern direct relationships between users, groups, roles, and permissions."
        actions={
          canAssign && (
            <Button size="sm" leftIcon={<Plus />} onClick={() => openNewAssign('GROUP_USER')}>
              New assignment
            </Button>
          )
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex items-center gap-3 rounded-md border border-border bg-surface p-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <UserCheck className="size-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Active assignments</p>
            <p className="text-xl font-bold text-foreground">{table.total}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-md border border-border bg-surface p-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-info/10 text-info">
            <ShieldCheck className="size-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Access control model</p>
            <p className="text-sm font-semibold text-foreground">Relational Graph Mapping</p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-md border border-border bg-surface p-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-warning/10 text-warning">
            <Clock className="size-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Lifecycle enforcement</p>
            <p className="text-sm font-semibold text-foreground">Auto-Expiring Grants</p>
          </div>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(val) => {
          setActiveTab(val);
          setTimeout(() => table.refresh(), 0);
        }}
        variant="pills"
      >
        <TabsList>
          <TabsTrigger value="ALL">All Mappings</TabsTrigger>
          <TabsTrigger value="GROUP_USER">User Memberships</TabsTrigger>
          <TabsTrigger value="GROUP_ROLE">Group Roles</TabsTrigger>
          <TabsTrigger value="ROLE_PERMISSION">Role Permissions</TabsTrigger>
        </TabsList>
      </Tabs>

      <DataTable
        table={table}
        columns={assignmentColumns}
        rowActions={renderRowActions}
        layoutKey="admin-assignments"
        itemName={{ singular: 'assignment', plural: 'assignments' }}
        rowLabel={(r) => r.id}
        searchPlaceholder="Search assignments by user, group, role, or permission..."
        emptyState={{
          icon: <UserCheck />,
          title: 'No access assignments found',
          description:
            'Create an assignment to grant users group memberships, associate roles with groups, or grant permissions to roles.',
        }}
      />

      <AssignModal
        open={assignModalOpen}
        defaultType={assignDefaultType}
        onOpenChange={setAssignModalOpen}
        onAssigned={table.refresh}
      />

      <EditExpiryDialog
        open={expiryDialogOpen}
        mapping={selectedMapping}
        onOpenChange={setExpiryDialogOpen}
        onSaved={table.refresh}
      />

      <ConfirmDialog
        open={revokeConfirmOpen}
        onOpenChange={setRevokeConfirmOpen}
        title="Revoke access assignment?"
        description="This will immediately revoke this assignment. The assigned entity will lose any privileges derived through this relation."
        confirmText="Revoke assignment"
        destructive
        onConfirm={handleRevoke}
      />
    </PageContainer>
  );
}
