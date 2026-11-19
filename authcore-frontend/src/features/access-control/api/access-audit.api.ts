import type { TablePage, TableQuery } from '@/components/data-table';
import { apiClient } from '@/lib/api';

import type { AuditEntry } from '../types/access-control.types';

const BASE = '/access-control/audit-logs';

export const accessAuditApi = {
  list: async (
    query: TableQuery & { entity?: string; action?: string; actorId?: string },
    signal?: AbortSignal,
  ): Promise<TablePage<AuditEntry & { rowNumber?: number }>> => {
    const entityFilter = query.filters.entity?.at(-1);
    const actionFilter = query.filters.action?.at(-1);

    const page = await apiClient.getPage<AuditEntry>(BASE, {
      signal,
      query: {
        page: query.page,
        limit: query.pageSize,
        entity: query.entity || entityFilter || undefined,
        action: query.action || actionFilter || undefined,
        actorId: query.actorId || undefined,
      },
    });

    const first = (query.page - 1) * query.pageSize;
    return {
      items: page.items.map((item, index) => ({ ...item, rowNumber: first + index + 1 })),
      total: page.meta.totalItems,
    };
  },
};
