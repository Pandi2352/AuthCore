import type { TablePage, TableQuery } from '@/components/data-table';
import { apiClient, downloadFile, uploadFile, type UploadProgress } from '@/lib/api';

import type { BulkJob, BulkJobStats, BulkUserType } from '../types/bulk-users.types';

const base = (type: BulkUserType) => `/admin/users/bulk/${type}`;

/** Users → Bulk user operations (create, update, reset password from CSV / Excel). */
export const bulkUsersApi = {
  /** Blank template with every column (custom profile fields included). */
  template: (type: BulkUserType) =>
    downloadFile(`${base(type)}/template`, { fallbackFilename: `bulk-${type}-template.csv` }),

  /** The users matching `filters` (same as the search page) as an editable CSV. */
  export: (type: Exclude<BulkUserType, 'create'>, filters: Record<string, string | undefined>) =>
    downloadFile(`${base(type)}/export`, { query: filters, fallbackFilename: `${type}-users.csv` }),

  upload: (
    type: BulkUserType,
    file: File,
    options: { onProgress?: (p: UploadProgress) => void } = {},
  ) => uploadFile<BulkJob>(`${base(type)}/upload`, file, options),

  job: (type: BulkUserType, id: string, signal?: AbortSignal) =>
    apiClient.get<BulkJob>(`${base(type)}/jobs/${encodeURIComponent(id)}`, { signal }),

  /** History for the table (newest first). */
  jobs: async (
    type: BulkUserType,
    query: TableQuery,
    signal?: AbortSignal,
  ): Promise<TablePage<BulkJob & { rowNumber: number }>> => {
    const page = await apiClient.getPage<BulkJob>(`${base(type)}/jobs`, {
      signal,
      query: {
        page: query.page,
        limit: query.pageSize,
        search: query.search.trim() || undefined,
      },
    });
    const first = (query.page - 1) * query.pageSize;
    return {
      items: page.items.map((job, i) => ({ ...job, rowNumber: first + i + 1 })),
      total: page.meta.totalItems,
    };
  },

  /** Each row with its result and reason. */
  result: (type: BulkUserType, id: string) =>
    downloadFile(`${base(type)}/jobs/${encodeURIComponent(id)}/result`, {
      fallbackFilename: 'bulk-results.csv',
    }),

  stats: (type: BulkUserType, signal?: AbortSignal) =>
    apiClient.get<BulkJobStats>(`${base(type)}/stats`, { signal }),
};
