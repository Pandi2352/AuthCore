/** create = new users · update = change existing users · password = reset passwords. */
export type BulkUserType = 'create' | 'update' | 'password';

export type BulkJobStatus = 'PROCESSING' | 'DONE' | 'INVALID_TEMPLATE' | 'FAILED';

/** One uploaded file (GET /admin/users/bulk/:type/jobs). */
export interface BulkJob {
  id: string;
  kind: string;
  fileName: string;
  uploadedBy: string;
  uploadedByEmail: string | null;
  status: BulkJobStatus;
  /** Why the file was rejected or the job stopped. */
  message: string | null;
  totalCount: number;
  successCount: number;
  skippedCount: number;
  errorCount: number;
  /** Rows finished so far. */
  processedCount: number;
  startedAt: string;
  finishedAt: string | null;
}

export interface BulkJobStats {
  jobs: number;
  rows: number;
  succeeded: number;
  failed: number;
  invalidFiles: number;
  lastRunAt: string | null;
}
