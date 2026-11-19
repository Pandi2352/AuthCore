import { CircleAlert, Download, FileSpreadsheet, Loader2, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { DateTime } from '@/components/common/DateTime';
import { EmptyState, notifyError, notifySuccess } from '@/components/feedback';
import { Badge, Button, Dialog, DialogBody, DialogContent, IconButton } from '@/components/ui';
import { formatNumber } from '@/lib/format';

import { adminUsersApi } from '../api/admin-users.api';
import type { UserReport } from '../types/admin-user.types';
import { ACTIVITY_LABEL, STATUS_LABEL } from './user-labels';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** "Active · search “skill” · 2 statuses" — what a report was made of. */
function describeFilters(filters: Record<string, unknown>): string {
  const parts: string[] = [];
  const activity = filters.activity;
  if (typeof activity === 'string' && activity in ACTIVITY_LABEL)
    parts.push(ACTIVITY_LABEL[activity as keyof typeof ACTIVITY_LABEL]);
  if (typeof filters.search === 'string') parts.push(`“${filters.search}”`);
  if (Array.isArray(filters.status)) {
    parts.push(
      filters.status.length === 1
        ? (STATUS_LABEL[filters.status[0] as keyof typeof STATUS_LABEL] ?? '1 status')
        : `${filters.status.length} statuses`,
    );
  }
  if (Array.isArray(filters.role)) parts.push(`${filters.role.join(', ').toLowerCase()} role`);
  if (Array.isArray(filters.groupId))
    parts.push(`${filters.groupId.length} group${filters.groupId.length === 1 ? '' : 's'}`);
  return parts.length > 0 ? parts.join(' · ') : 'All users';
}

function ReportRow({ report, onChanged }: { report: UserReport; onChanged: () => void }) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const download = async () => {
    setIsDownloading(true);
    try {
      await adminUsersApi.reports.download(report);
    } catch (err) {
      notifyError(err, 'Could not download the report');
    } finally {
      setIsDownloading(false);
    }
  };

  const remove = async () => {
    setIsDeleting(true);
    try {
      await adminUsersApi.reports.remove(report.id);
      notifySuccess('Report deleted');
      onChanged();
    } catch (err) {
      notifyError(err, 'Could not delete the report');
      setIsDeleting(false);
    }
  };

  return (
    <li className="flex items-start gap-3 rounded-md border border-border p-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-success-soft text-success-soft-foreground">
        {report.status === 'PENDING' ? (
          <Loader2 className="size-5 animate-spin" aria-hidden="true" />
        ) : report.status === 'FAILED' ? (
          <CircleAlert className="size-5 text-danger" aria-hidden="true" />
        ) : (
          <FileSpreadsheet className="size-5" aria-hidden="true" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-medium text-foreground">{report.fileName}</p>
          {report.status === 'PENDING' && (
            <Badge size="sm" tone="info">
              Preparing…
            </Badge>
          )}
          {report.status === 'FAILED' && (
            <Badge size="sm" tone="danger">
              Failed
            </Badge>
          )}
        </div>
        <p className="truncate text-xs text-muted-foreground">{describeFilters(report.filters)}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          <DateTime value={report.createdAt} format="relative" />
          {report.status === 'READY' && report.rowCount !== null && (
            <>
              {' '}
              · {formatNumber(report.rowCount)} {report.rowCount === 1 ? 'user' : 'users'}
              {report.fileSize !== null && ` · ${formatBytes(report.fileSize)}`}
            </>
          )}
          {report.status === 'READY' && (
            <>
              {' '}
              · expires <DateTime value={report.expiresAt} format="relative" />
            </>
          )}
        </p>
        {report.isTruncated && (
          <p className="mt-1 text-xs text-warning">
            Only the first {formatNumber(report.rowCount ?? 0)} users are included — narrow the
            filters for a complete file.
          </p>
        )}
        {report.error && <p className="mt-1 text-xs text-danger">{report.error}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {report.status === 'READY' && (
          <Button
            size="sm"
            variant="outline"
            leftIcon={<Download />}
            isLoading={isDownloading}
            onClick={() => void download()}
          >
            Download
          </Button>
        )}
        <IconButton
          aria-label={`Delete ${report.fileName}`}
          icon={<Trash2 />}
          variant="ghost"
          size="sm"
          isLoading={isDeleting}
          disabled={report.status === 'PENDING'}
          className="text-muted-foreground hover:text-danger"
          onClick={() => void remove()}
        />
      </div>
    </li>
  );
}

/** "View downloads": the reports this admin generated (kept 7 days). */
export function ReportsDialog({
  open,
  onOpenChange,
  reports,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reports: UserReport[] | null;
  onChanged: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Downloads"
        description="Reports you generated. Each file is kept for 7 days and only you can download it."
        size="lg"
      >
        <DialogBody>
          {reports === null ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Loading…
            </p>
          ) : reports.length === 0 ? (
            <EmptyState
              size="compact"
              icon={<FileSpreadsheet />}
              title="No reports yet"
              description="Use “Generate report” to export the users matching your search and filters as a CSV file."
            />
          ) : (
            <ul className="space-y-2" aria-live="polite">
              {reports.map((report) => (
                <ReportRow key={report.id} report={report} onChanged={onChanged} />
              ))}
            </ul>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
