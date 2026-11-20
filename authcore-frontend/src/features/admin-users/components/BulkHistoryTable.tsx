import { Download, FileSpreadsheet, Loader2 } from 'lucide-react';
import { useCallback } from 'react';

import { DateTime } from '@/components/common/DateTime';
import {
  DataTable,
  TableAction,
  useServerTable,
  type DataTableColumn,
  type TableQuery,
} from '@/components/data-table';
import { Badge, Tooltip } from '@/components/ui';

import { bulkUsersApi } from '../api/bulk-users.api';
import type { BulkJob, BulkUserType } from '../types/bulk-users.types';
import { downloadResults, JOB_STATUS } from './bulk-job-meta';

type Row = BulkJob & { rowNumber: number };

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
    // File name, who uploaded it under it.
    id: 'fileName',
    header: 'File',
    width: 340,
    wrap: true,
    mobile: 'title',
    cell: (r) => (
      <span className="flex min-w-0 items-start gap-2">
        <FileSpreadsheet className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
        <span className="min-w-0">
          <span className="block font-medium break-all text-foreground">{r.fileName}</span>
          <span className="block text-xs break-all text-primary">
            {r.uploadedByEmail ?? 'Unknown user'}
          </span>
        </span>
      </span>
    ),
  },
  {
    id: 'status',
    header: 'Status',
    width: 150,
    fit: true,
    cell: (r) => {
      const meta = JOB_STATUS[r.status];
      const badge = (
        <Badge size="sm" tone={meta.tone}>
          {r.status === 'PROCESSING' && (
            <Loader2 className="size-3 animate-spin" aria-hidden="true" />
          )}
          {meta.label}
        </Badge>
      );
      return r.message ? (
        <Tooltip content={r.message}>
          <span>{badge}</span>
        </Tooltip>
      ) : (
        badge
      );
    },
  },
  {
    id: 'counts',
    header: 'Rows / done',
    width: 120,
    fit: true,
    cell: (r) => (
      <span className="text-foreground tabular-nums">
        {r.totalCount} / {r.status === 'INVALID_TEMPLATE' ? 0 : r.processedCount}
      </span>
    ),
  },
  {
    id: 'successCount',
    header: 'Succeeded',
    width: 104,
    fit: true,
    cell: (r) => (
      <Badge size="sm" tone={r.successCount ? 'success' : 'neutral'} className="tabular-nums">
        {r.successCount}
      </Badge>
    ),
  },
  {
    id: 'errorCount',
    header: 'Failed',
    width: 90,
    fit: true,
    cell: (r) => (
      <Badge size="sm" tone={r.errorCount ? 'danger' : 'neutral'} className="tabular-nums">
        {r.errorCount}
      </Badge>
    ),
  },
  {
    id: 'startedAt',
    header: 'Started on',
    width: 200,
    fit: true,
    cell: (r) => <DateTime value={r.startedAt} format="full" />,
  },
  {
    id: 'finishedAt',
    header: 'Finished on',
    width: 200,
    fit: true,
    cell: (r) =>
      r.finishedAt ? (
        <DateTime value={r.finishedAt} format="full" />
      ) : (
        <span className="text-muted-foreground">N/A</span>
      ),
  },
];

/** Uploaded files of one operation, newest first; each row's results download as CSV. */
export function BulkHistoryTable({
  type,
  reloadKey,
  onRefresh,
}: {
  type: BulkUserType;
  /** Bumped from outside (a new upload / a job finished). */
  reloadKey: number;
  onRefresh: () => void;
}) {
  const fetchPage = useCallback(
    (query: TableQuery, signal: AbortSignal) => bulkUsersApi.jobs(type, query, signal),
    [type],
  );
  return (
    <HistoryTable
      key={`${type}-${reloadKey}`}
      type={type}
      fetchPage={fetchPage}
      onRefresh={onRefresh}
    />
  );
}

function HistoryTable({
  type,
  fetchPage,
  onRefresh,
}: {
  type: BulkUserType;
  fetchPage: (query: TableQuery, signal: AbortSignal) => ReturnType<typeof bulkUsersApi.jobs>;
  onRefresh: () => void;
}) {
  const table = useServerTable<Row>({
    fetchPage,
    getRowId: (r) => r.id,
    defaultPageSize: 10,
    itemsLabel: 'files',
  });
  const renderActions = (r: Row) => (
    <span className="flex justify-end">
      <TableAction
        tone="success"
        icon={<Download />}
        tooltip="Download results"
        label={`Download the results of ${r.fileName}`}
        disabledReason={
          r.status === 'INVALID_TEMPLATE'
            ? (r.message ?? 'The file was rejected')
            : r.status === 'PROCESSING'
              ? 'Still running'
              : undefined
        }
        onClick={() => void downloadResults(type, r)}
      />
    </span>
  );
  return (
    <DataTable
      table={table}
      columns={COLUMNS}
      rowActions={renderActions}
      actionsWidth={80}
      layoutKey={`bulk-users-${type}`}
      viewOptions={false}
      // Refresh also reloads the count cards.
      onRefresh={onRefresh}
      itemName={{ singular: 'file', plural: 'files' }}
      rowLabel={(r) => r.fileName}
      searchPlaceholder="Search by file name or uploader email"
      emptyState={{
        icon: <FileSpreadsheet />,
        title: 'No files uploaded yet',
        description: 'Files you upload on the Upload tab appear here with their results.',
      }}
    />
  );
}
