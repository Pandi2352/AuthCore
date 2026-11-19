import { Eye, History, Shield, UserCheck } from 'lucide-react';
import { useMemo, useState } from 'react';

import { DateTime } from '@/components/common/DateTime';
import {
  DataTable,
  useServerTable,
  type DataTableColumn,
  type DataTableFilter,
} from '@/components/data-table';
import { PageContainer, PageHeader } from '@/components/page';
import {
  Badge,
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  IconButton,
} from '@/components/ui';

import { accessAuditApi } from '../api/access-audit.api';
import type { AuditEntry } from '../types/access-control.types';

function buildAuditColumns(): DataTableColumn<AuditEntry & { rowNumber?: number }>[] {
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
      id: 'entity',
      header: 'Entity',
      sortable: true,
      width: 150,
      cell: (r) => {
        const tones: Record<string, 'primary' | 'info' | 'warning' | 'neutral'> = {
          ROLE: 'primary',
          PERMISSION: 'info',
          GROUP: 'warning',
          ACCESS_MAPPING: 'neutral',
        };
        return (
          <Badge size="sm" tone={tones[r.entity] ?? 'neutral'}>
            {r.entity}
          </Badge>
        );
      },
    },
    {
      id: 'action',
      header: 'Action',
      sortable: true,
      width: 120,
      cell: (r) => {
        const tones: Record<string, 'success' | 'info' | 'danger' | 'primary' | 'neutral'> = {
          CREATE: 'success',
          UPDATE: 'info',
          DELETE: 'danger',
          ASSIGN: 'primary',
          REVOKE: 'danger',
        };
        return (
          <Badge size="sm" tone={tones[r.action] ?? 'neutral'}>
            {r.action}
          </Badge>
        );
      },
    },
    {
      id: 'entityId',
      header: 'Resource ID',
      width: 220,
      mobile: 'title',
      cell: (r) => (
        <code className="rounded-md bg-muted/40 px-1.5 py-0.5 font-mono text-xs text-foreground">
          {r.entityId}
        </code>
      ),
    },
    {
      id: 'actor',
      header: 'Actor',
      width: 200,
      cell: (r) => (
        <div className="flex flex-col">
          <span className="text-xs font-medium text-foreground">{r.actorEmail || r.actorId}</span>
          {r.ipAddress && <span className="text-2xs text-muted-foreground">{r.ipAddress}</span>}
        </div>
      ),
    },
    {
      id: 'timestamp',
      header: 'Timestamp',
      sortable: true,
      width: 160,
      mobile: 'subtitle',
      cell: (r) => <DateTime value={r.timestamp} format="datetime" />,
    },
  ];
}

const auditColumns = buildAuditColumns();

export function AccessAuditLogPage() {
  const [selectedLog, setSelectedLog] = useState<AuditEntry | null>(null);
  const [changesDialogOpen, setChangesDialogOpen] = useState(false);

  const filters = useMemo<DataTableFilter[]>(
    () => [
      {
        id: 'entity',
        label: 'Entity',
        options: [
          { value: 'ROLE', label: 'Role' },
          { value: 'PERMISSION', label: 'Permission' },
          { value: 'GROUP', label: 'Group' },
          { value: 'ACCESS_MAPPING', label: 'Access Mapping' },
        ],
      },
      {
        id: 'action',
        label: 'Action',
        options: [
          { value: 'CREATE', label: 'Create' },
          { value: 'UPDATE', label: 'Update' },
          { value: 'DELETE', label: 'Delete' },
          { value: 'ASSIGN', label: 'Assign' },
          { value: 'REVOKE', label: 'Revoke' },
        ],
      },
    ],
    [],
  );

  const table = useServerTable<AuditEntry & { rowNumber?: number }>({
    fetchPage: accessAuditApi.list,
    getRowId: (r) => r.id,
    filters,
    defaultPageSize: 15,
    defaultSort: [{ id: 'timestamp', desc: true }],
    itemsLabel: 'audit entries',
  });

  const renderRowActions = (r: AuditEntry & { rowNumber?: number }) => (
    <IconButton
      aria-label="View audit changes"
      icon={<Eye />}
      variant="ghost"
      size="sm"
      className="size-7! pointer-coarse:size-11!"
      onClick={() => {
        setSelectedLog(r);
        setChangesDialogOpen(true);
      }}
    />
  );

  return (
    <PageContainer>
      <PageHeader
        title="Access Control Audit Log"
        description="Tamper-evident record of all security changes: role definitions, permission policies, and identity access bindings."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex items-center gap-3 rounded-md border border-border bg-surface p-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <History className="size-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total audit events</p>
            <p className="text-xl font-bold text-foreground">{table.total}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-md border border-border bg-surface p-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-info/10 text-info">
            <Shield className="size-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Monitored objects</p>
            <p className="text-sm font-semibold text-foreground">
              Roles · Perms · Groups · Mappings
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-md border border-border bg-surface p-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-success/10 text-success">
            <UserCheck className="size-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Compliance standard</p>
            <p className="text-sm font-semibold text-foreground">SOC2 / ISO 27001 Access Trail</p>
          </div>
        </div>
      </div>

      <DataTable
        table={table}
        columns={auditColumns}
        rowActions={renderRowActions}
        layoutKey="admin-access-audit"
        itemName={{ singular: 'audit entry', plural: 'audit entries' }}
        rowLabel={(r) => r.entityId}
        searchPlaceholder="Search audit log..."
        emptyState={{
          icon: <History />,
          title: 'No audit records',
          description:
            'Security events will be logged here as access control policies and assignments are modified.',
        }}
      />

      <Dialog open={changesDialogOpen} onOpenChange={setChangesDialogOpen}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>Audit Entry Details</DialogTitle>
          </DialogHeader>

          <DialogBody className="space-y-4 py-2">
            {selectedLog && (
              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-2 rounded-md bg-muted/30 p-3">
                  <div>
                    <span className="text-muted-foreground">Action: </span>
                    <span className="font-semibold text-foreground">
                      {selectedLog.action} {selectedLog.entity}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Actor: </span>
                    <span className="font-semibold text-foreground">
                      {selectedLog.actorEmail || selectedLog.actorId}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Target ID: </span>
                    <code className="text-2xs text-foreground">{selectedLog.entityId}</code>
                  </div>
                  <div>
                    <span className="text-muted-foreground">IP: </span>
                    <span className="text-foreground">{selectedLog.ipAddress || '—'}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <h4 className="font-semibold text-foreground">Changes Diff:</h4>
                  <pre className="text-2xs max-h-64 overflow-auto rounded-md border border-border bg-muted/20 p-3 font-mono text-foreground">
                    {JSON.stringify(selectedLog.changes, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </DialogBody>

          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => setChangesDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
