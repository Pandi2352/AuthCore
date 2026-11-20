import type { TablePage, TableQuery } from '@/components/data-table';
import { apiClient } from '@/lib/api';

import type { AuditEntry, AuditStats } from '../types/access-control.types';

const BASE = '/access-control/audit-logs';

/** Access-control change history (ACCESS_AUDIT_READ). Newest first. */
export const accessAuditApi = {
  list: async (
    query: TableQuery,
    signal?: AbortSignal,
  ): Promise<TablePage<AuditEntry & { rowNumber: number }>> => {
    const page = await apiClient.getPage<AuditEntry>(BASE, {
      signal,
      query: {
        page: query.page,
        limit: query.pageSize,
        search: query.search.trim() || undefined,
        // One value each (the last ticked).
        entityType: query.filters.entityType?.at(-1),
        action: query.filters.action?.at(-1),
      },
    });
    const first = (query.page - 1) * query.pageSize;
    return {
      items: page.items.map((item, index) => ({ ...item, rowNumber: first + index + 1 })),
      total: page.meta.totalItems,
    };
  },

  stats: (signal?: AbortSignal) => apiClient.get<AuditStats>(`${BASE}/stats`, { signal }),
};
