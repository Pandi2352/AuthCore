import {
  CalendarClock,
  FilePen,
  FilePlus2,
  FileX2,
  History,
  Link2,
  Link2Off,
  ScanEye,
  UsersRound,
} from 'lucide-react';
import { memo, useCallback, useEffect, useState } from 'react';

import { DateTime } from '@/components/common/DateTime';
import { StatCard } from '@/components/common/StatCard';
import {
  DataTable,
  TableAction,
  useServerTable,
  type DataTableColumn,
  type DataTableFilter,
} from '@/components/data-table';
import { notifyError } from '@/components/feedback';
import { PageContainer, PageHeader } from '@/components/page';
import { Badge, Button, Dialog, DialogBody, DialogContent, DialogFooter } from '@/components/ui';
import { isAbortError } from '@/lib/api';
import { cn } from '@/lib/utils';

import { accessAuditApi } from '../api/access-audit.api';
import type {
  AuditAction,
  AuditEntityType,
  AuditEntry,
  AuditStats,
} from '../types/access-control.types';

type Row = AuditEntry & { rowNumber: number };

const ENTITY_LABEL: Record<AuditEntityType, string> = {
  ROLE: 'Role',
  PERMISSION: 'Permission',
  GROUP: 'Group',
  ACCESS_MAPPING: 'Assignment',
  USER: 'User',
  INVITE: 'Invite',
  USER_ATTRIBUTE: 'Profile field',
};

const ACTION_META: Record<
  AuditAction,
  { label: string; tone: 'success' | 'warning' | 'danger' | 'info' | 'primary' }
> = {
  CREATE: { label: 'Created', tone: 'success' },
  UPDATE: { label: 'Updated', tone: 'warning' },
  DELETE: { label: 'Deleted', tone: 'danger' },
  ASSIGN: { label: 'Assigned', tone: 'info' },
  REVOKE: { label: 'Revoked', tone: 'primary' },
};

const FILTERS: DataTableFilter[] = [
  {
    id: 'entityType',
    label: 'What',
    options: (Object.keys(ENTITY_LABEL) as AuditEntityType[]).map((value) => ({
      value,
      label: ENTITY_LABEL[value],
    })),
  },
  {
    id: 'action',
    label: 'Action',
    options: (Object.keys(ACTION_META) as AuditAction[]).map((value) => ({
      value,
      label: ACTION_META[value].label,
    })),
  },
];

const whoOf = (r: AuditEntry) =>
  r.changedBy === 'system' ? 'System' : (r.changedByName ?? r.changedByEmail ?? 'Unknown user');

const COLUMNS: DataTableColumn<Row>[] = [
  {
    id: 'rowNumber',
    header: 'S.No',
    width: 64,
    fit: true,
    mobile: 'hidden',
    cell: (r) => <span className="text-muted-foreground tabular-nums">{r.rowNumber}</span>,
  },
  {
    // What changed in words, the kind of item under it.
    id: 'entity',
    header: 'What changed',
    width: 420,
    wrap: true,
    mobile: 'title',
    cell: (r) => (
      <span className="block min-w-0">
        <span className="block font-medium break-words text-foreground">
          {r.entityLabel ?? r.entityId}
        </span>
        <span className="block text-xs text-primary">{ENTITY_LABEL[r.entityType]}</span>
      </span>
    ),
  },
  {
    id: 'action',
    header: 'Action',
    width: 110,
    fit: true,
    cell: (r) => (
      <Badge size="sm" tone={ACTION_META[r.action].tone}>
        {ACTION_META[r.action].label}
      </Badge>
    ),
  },
  {
    id: 'changedBy',
    header: 'Changed by',
    width: 300,
    fitText: (r) => [whoOf(r), r.changedByEmail ?? ''],
    wrap: true,
    cell: (r) => (
      <span className="block min-w-0">
        <span className="block font-medium text-foreground">{whoOf(r)}</span>
        {r.changedByEmail && r.changedByName && (
          <span className="block text-xs break-all text-muted-foreground">{r.changedByEmail}</span>
        )}
      </span>
    ),
  },
  {
    id: 'ipAddress',
    header: 'IP',
    width: 140,
    fit: true,
    cell: (r) =>
      r.ipAddress ? (
        <span className="font-mono text-xs text-primary">{r.ipAddress}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    id: 'createdAt',
    header: 'Date & time',
    width: 200,
    fit: true,
    cell: (r) => <DateTime value={r.createdAt} format="full" />,
  },
];

/** The eight counts; the action ones filter the table (again = show all). */
const AuditStatCards = memo(function AuditStatCards({
  stats: s,
  action,
  onAction,
}: {
  stats: AuditStats | null;
  action: AuditAction | undefined;
  onAction: (action: AuditAction | null) => void;
}) {
  const pick = (value: AuditAction) => () => onAction(action === value ? null : value);
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        tone="primary"
        pattern="rings"
        icon={History}
        label="Total changes"
        value={s?.total ?? null}
        hint="Every recorded change · click to show all"
        selected={action === undefined}
        onClick={() => onAction(null)}
      />
      <StatCard
        tone="cyan"
        pattern="sparkles"
        icon={CalendarClock}
        label="Last 24 hours"
        value={s?.last24Hours ?? null}
        hint="Recent changes"
      />
      <StatCard
        tone="success"
        pattern="waves"
        icon={FilePlus2}
        label="Created"
        value={s?.created ?? null}
        hint="New roles, groups, fields …"
        selected={action === 'CREATE'}
        onClick={pick('CREATE')}
      />
      <StatCard
        tone="warning"
        pattern="dots"
        icon={FilePen}
        label="Updated"
        value={s?.updated ?? null}
        hint="Edits"
        selected={action === 'UPDATE'}
        onClick={pick('UPDATE')}
      />
      <StatCard
        tone="danger"
        pattern="stripes"
        icon={FileX2}
        label="Deleted"
        value={s?.deleted ?? null}
        hint="Removed items"
        selected={action === 'DELETE'}
        onClick={pick('DELETE')}
      />
      <StatCard
        tone="info"
        pattern="bars"
        icon={Link2}
        label="Assigned"
        value={s?.assigned ?? null}
        hint="Access given"
        selected={action === 'ASSIGN'}
        onClick={pick('ASSIGN')}
      />
      <StatCard
        tone="violet"
        pattern="grid"
        icon={Link2Off}
        label="Revoked"
        value={s?.revoked ?? null}
        hint="Access taken away"
        selected={action === 'REVOKE'}
        onClick={pick('REVOKE')}
      />
      <StatCard
        tone="primary"
        pattern="bubbles"
        icon={UsersRound}
        label="People"
        value={s?.people ?? null}
        hint="Who made changes"
      />
    </div>
  );
});

/** A value for the details table. */
const show = (value: unknown): string =>
  value === undefined || value === null || value === ''
    ? '—'
    : typeof value === 'object'
      ? JSON.stringify(value)
      : String(value);

/** One entry: who, when, and every field before → after (changed ones highlighted). */
function AuditDetailsDialog({ entry, onClose }: { entry: AuditEntry | null; onClose: () => void }) {
  const fields = entry
    ? [...new Set([...Object.keys(entry.before ?? {}), ...Object.keys(entry.after ?? {})])].filter(
        (f) => f !== '_id' && f !== '__v',
      )
    : [];
  return (
    <Dialog open={entry !== null} onOpenChange={(open) => !open && onClose()}>
      {entry && (
        <DialogContent
          size="lg"
          title={
            <span className="flex flex-wrap items-center gap-2">
              {entry.entityLabel ?? ENTITY_LABEL[entry.entityType]}
              <Badge size="sm" tone={ACTION_META[entry.action].tone}>
                {ACTION_META[entry.action].label}
              </Badge>
            </span>
          }
          description={
            <>
              {ENTITY_LABEL[entry.entityType]} · {whoOf(entry)} ·{' '}
              <DateTime value={entry.createdAt} format="full" />
              {entry.ipAddress ? ` · IP ${entry.ipAddress}` : ''}
            </>
          }
        >
          <DialogBody className="py-4">
            {fields.length === 0 ? (
              <p className="text-sm text-muted-foreground">No field values were recorded.</p>
            ) : (
              <div className="scrollbar-slim overflow-x-auto rounded-md border border-border">
                <table className="w-full border-collapse text-sm">
                  <caption className="sr-only">Values before and after</caption>
                  <thead>
                    <tr>
                      {['Field', 'Before', 'After'].map((h) => (
                        <th
                          key={h}
                          scope="col"
                          className="border-b border-border bg-muted px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {fields.map((field) => {
                      const before = show(entry.before?.[field]);
                      const after = show(entry.after?.[field]);
                      const changed = entry.before && entry.after && before !== after;
                      return (
                        <tr
                          key={field}
                          className={cn('even:bg-muted/60', changed && 'bg-warning-soft/50!')}
                        >
                          <td className="border-b border-border px-3 py-2 font-mono text-xs text-muted-foreground">
                            {field}
                          </td>
                          <td
                            className={cn(
                              'border-b border-border px-3 py-2 break-all',
                              changed ? 'text-danger line-through' : 'text-foreground',
                            )}
                          >
                            {before}
                          </td>
                          <td
                            className={cn(
                              'border-b border-border px-3 py-2 break-all',
                              changed ? 'font-medium text-success' : 'text-foreground',
                            )}
                          >
                            {after}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
}

/** Administration → Access control → Audit log: who changed what, and when. */
export function AccessAuditLogPage() {
  const [viewing, setViewing] = useState<AuditEntry | null>(null);
  const [stats, setStats] = useState<{ key: number; value: AuditStats } | null>(null);
  const [statsKey, setStatsKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        setStats({ key: statsKey, value: await accessAuditApi.stats(controller.signal) });
      } catch (error) {
        if (!isAbortError(error)) notifyError(error, 'Could not load the audit counts');
      }
    };
    void load();
    return () => controller.abort();
  }, [statsKey]);

  const table = useServerTable<Row>({
    fetchPage: accessAuditApi.list,
    getRowId: (r) => r.id,
    filters: FILTERS,
    defaultPageSize: 15,
    itemsLabel: 'changes',
  });
  const { setFilter } = table;
  const action = table.query.filters.action?.at(-1) as AuditAction | undefined;
  const pickAction = useCallback(
    (next: AuditAction | null) => setFilter('action', next ? [next] : []),
    [setFilter],
  );

  const renderRowActions = (r: Row) => (
    <span className="flex justify-end">
      <TableAction
        tone="info"
        icon={<ScanEye />}
        tooltip="View"
        label={`View the change to ${r.entityLabel ?? r.entityId}`}
        onClick={() => setViewing(r)}
      />
    </span>
  );

  return (
    <PageContainer>
      <PageHeader
        title="Audit log"
        description="Every change to roles, permissions, groups, assignments, users and profile fields: who made it, when, and what changed."
      />

      {/* Memoized: paging / searching the table does not redraw the cards. */}
      <AuditStatCards stats={stats?.value ?? null} action={action} onAction={pickAction} />

      <DataTable
        table={table}
        columns={COLUMNS}
        rowActions={renderRowActions}
        actionsWidth={80}
        layoutKey="admin-access-audit:v2"
        viewOptions={false}
        // Refresh also reloads the count cards.
        onRefresh={() => setStatsKey((n) => n + 1)}
        onRowOpen={setViewing}
        itemName={{ singular: 'change', plural: 'changes' }}
        rowLabel={(r) => r.entityLabel ?? r.entityId}
        searchPlaceholder="Search by who or what changed"
        emptyState={{
          icon: <History />,
          title: 'No changes recorded yet',
          description: 'Changes to roles, groups, permissions and users appear here.',
        }}
      />

      <AuditDetailsDialog entry={viewing} onClose={() => setViewing(null)} />
    </PageContainer>
  );
}
