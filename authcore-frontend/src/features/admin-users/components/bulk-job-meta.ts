import { notifyError } from '@/components/feedback';

import { bulkUsersApi } from '../api/bulk-users.api';
import type { BulkJob, BulkJobStatus, BulkUserType } from '../types/bulk-users.types';

export const JOB_STATUS: Record<
  BulkJobStatus,
  { label: string; tone: 'info' | 'success' | 'danger' | 'warning' }
> = {
  PROCESSING: { label: 'Processing', tone: 'info' },
  DONE: { label: 'Done', tone: 'success' },
  INVALID_TEMPLATE: { label: 'Invalid template', tone: 'danger' },
  FAILED: { label: 'Stopped', tone: 'warning' },
};

/** Download a job's results (each row + result + reason). */
export async function downloadResults(type: BulkUserType, job: Pick<BulkJob, 'id'>) {
  try {
    await bulkUsersApi.result(type, job.id);
  } catch (err) {
    notifyError(err, 'Could not download the results');
  }
}
