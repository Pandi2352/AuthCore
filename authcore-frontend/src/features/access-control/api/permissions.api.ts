import type { TablePage, TableQuery } from '@/components/data-table';
import { apiClient } from '@/lib/api';

import type {
  CreatePermissionInput,
  Permission,
  PermissionListItem,
  UpdatePermissionInput,
} from '../types/access-control.types';

const BASE = '/permissions';
const byId = (id: string) => `${BASE}/${encodeURIComponent(id)}`;

const SORT_FIELD: Record<string, string> = {
  permissionName: 'permissionName',
  permissionKey: 'permissionKey',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
};

export const permissionsApi = {
  list: async (query: TableQuery, signal?: AbortSignal): Promise<TablePage<PermissionListItem>> => {
    const sort = query.sort[0];
    const statusFilter = query.filters.status?.join(',');
    const actionFilter = query.filters.action?.at(-1);
    const moduleFilter = query.filters.module?.at(-1);

    const page = await apiClient.getPage<Permission>(BASE, {
      signal,
      query: {
        page: query.page,
        limit: query.pageSize,
        search: query.search.trim() || undefined,
        status: statusFilter || undefined,
        action: actionFilter || undefined,
        metadataKey: moduleFilter ? 'module' : undefined,
        metadataValue: moduleFilter || undefined,
        sortBy: sort ? (SORT_FIELD[sort.id] ?? 'updatedAt') : 'updatedAt',
        sortOrder: sort ? (sort.desc ? 'desc' : 'asc') : 'desc',
      },
    });

    const first = (query.page - 1) * query.pageSize;
    return {
      items: page.items.map((item, index) => ({ ...item, rowNumber: first + index + 1 })),
      total: page.meta.totalItems,
    };
  },

  get: (id: string, signal?: AbortSignal) => apiClient.get<Permission>(byId(id), { signal }),

  dropdown: (query?: { action?: string; module?: string; search?: string }, signal?: AbortSignal) =>
    apiClient.get<Array<{ id: string; label: string; key: string }>>(`${BASE}/dropdown`, {
      signal,
      query: {
        action: query?.action,
        module: query?.module,
        search: query?.search?.trim() || undefined,
      },
    }),

  actions: (signal?: AbortSignal) =>
    apiClient.get<Array<{ value: string; label: string }>>(`${BASE}/actions`, { signal }),

  exists: (query: { permissionKey?: string; permissionName?: string; excludeId?: string }) =>
    apiClient.get<{ exists: boolean }>(`${BASE}/exists`, { query }),

  create: (input: CreatePermissionInput) => apiClient.post<Permission>(BASE, input),

  update: (id: string, input: UpdatePermissionInput) =>
    apiClient.patch<Permission>(byId(id), input),

  remove: (id: string) => apiClient.delete<{ id: string; deletedAt: string }>(byId(id)),
};
