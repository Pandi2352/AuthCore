import { apiClient } from '@/lib/api';

import type {
  CreatePermissionInput,
  Permission,
  PermissionListItem,
  UpdatePermissionInput,
} from '../types/access-control.types';

const BASE = '/permissions';
const byId = (id: string) => `${BASE}/${encodeURIComponent(id)}`;

export const permissionsApi = {
  /** Every permission (all pages), sorted by key — for the role permission picker. */
  all: async (signal?: AbortSignal): Promise<Permission[]> => {
    const items: Permission[] = [];
    for (let page = 1; page <= 50; page += 1) {
      // Pages depend on each other (stop at the last one), so they load one by one.
      // oxlint-disable-next-line no-await-in-loop
      const result = await apiClient.getPage<Permission>(BASE, {
        signal,
        query: { page, limit: 100, sortBy: 'permissionKey', sortOrder: 'asc' },
      });
      items.push(...result.items);
      if (!result.meta.hasNextPage) break;
    }
    return items;
  },

  list: async (
    query?: {
      search?: string;
      status?: string;
      action?: string;
      module?: string;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    },
    signal?: AbortSignal,
  ): Promise<PermissionListItem[]> => {
    const page = await apiClient.getPage<Permission>(BASE, {
      signal,
      query: {
        search: query?.search?.trim() || undefined,
        status: query?.status || undefined,
        action: query?.action || undefined,
        metadataKey: query?.module ? 'module' : undefined,
        metadataValue: query?.module || undefined,
        sortBy: query?.sortBy || 'permissionKey',
        sortOrder: query?.sortOrder || 'asc',
      },
    });

    return page.items;
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
