import type { TablePage, TableQuery } from '@/components/data-table';
import { apiClient } from '@/lib/api';

import type { ActivityEntry, ActivityStats } from '../types/activity.types';

const BASE = '/admin/activity';
const HOUR = 60 * 60 * 1000;
/** Period filter value → start time. */
const PERIOD_MS: Record<string, number> = {
  '24h': 24 * HOUR,
  '7d': 7 * 24 * HOUR,
  '30d': 30 * 24 * HOUR,
};

/** Everyone's account activity (USER_READ). Newest first. */
export const activityApi = {
  list: async (
    query: TableQuery,
    signal?: AbortSignal,
  ): Promise<TablePage<ActivityEntry & { rowNumber: number }>> => {
    const period = query.filters.period?.at(-1);
    const result = query.filters.result?.at(-1);
    const page = await apiClient.getPage<ActivityEntry>(BASE, {
      signal,
      query: {
        page: query.page,
        limit: query.pageSize,
        // Who: name or email.
        search: query.search.trim() || undefined,
        events: query.filters.event?.join(',') || undefined,
        isSuccess: result === 'success' ? true : result === 'failed' ? false : undefined,
        from:
          period && PERIOD_MS[period]
            ? new Date(Date.now() - PERIOD_MS[period]).toISOString()
            : undefined,
      },
    });
    const first = (query.page - 1) * query.pageSize;
    return {
      items: page.items.map((item, i) => ({ ...item, rowNumber: first + i + 1 })),
      total: page.meta.totalItems,
    };
  },

  stats: (signal?: AbortSignal) => apiClient.get<ActivityStats>(`${BASE}/stats`, { signal }),

  eventTypes: (signal?: AbortSignal) =>
    apiClient.get<Array<{ value: string; label: string; isLoginEvent: boolean }>>(
      `${BASE}/event-types`,
      { signal },
    ),
};
