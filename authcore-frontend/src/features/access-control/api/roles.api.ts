import type { TablePage, TableQuery } from '@/components/data-table';
import { apiClient } from '@/lib/api';

import type {
  CreateRoleInput,
  Role,
  RoleCategory,
  RoleListItem,
  RoleSetupInput,
  RoleSetupResult,
  RoleStats,
  UpdateRoleInput,
} from '../types/access-control.types';

const BASE = '/roles';
const byId = (id: string) => `${BASE}/${encodeURIComponent(id)}`;

const SORT_FIELD: Record<string, string> = {
  roleName: 'roleName',
  roleKey: 'roleKey',
  category: 'category',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
};

export const rolesApi = {
  list: async (query: TableQuery, signal?: AbortSignal): Promise<TablePage<RoleListItem>> => {
    const sort = query.sort[0];
    const categoryFilter = query.filters.category?.join(',');

    const page = await apiClient.getPage<Role>(BASE, {
      signal,
      query: {
        page: query.page,
        limit: query.pageSize,
        search: query.search.trim() || undefined,
        category: categoryFilter || undefined,
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

  get: (id: string, signal?: AbortSignal) => apiClient.get<Role>(byId(id), { signal }),

  getByKey: (roleKey: string, signal?: AbortSignal) =>
    apiClient.get<Role>(`${BASE}/key/${encodeURIComponent(roleKey)}`, { signal }),

  dropdown: (query?: { category?: string; search?: string }, signal?: AbortSignal) =>
    apiClient.get<Array<{ id: string; label: string; key: string }>>(`${BASE}/dropdown`, {
      signal,
      query: {
        category: query?.category,
        search: query?.search?.trim() || undefined,
      },
    }),

  /** Built-in categories, then admin-added ones. */
  categories: (signal?: AbortSignal) =>
    apiClient.get<RoleCategory[]>(`${BASE}/categories`, { signal }),

  /** Add a category from its label ("Finance team" → FINANCE_TEAM). */
  createCategory: (label: string) => apiClient.post<RoleCategory>(`${BASE}/categories`, { label }),

  /** Next free key in the ROLE-NN series, e.g. ROLE-07. */
  nextKey: (signal?: AbortSignal) =>
    apiClient.get<{ roleKey: string }>(`${BASE}/next-key`, { signal }),

  stats: (signal?: AbortSignal) => apiClient.get<RoleStats>(`${BASE}/stats`, { signal }),

  exists: (query: { roleKey?: string; roleName?: string; category?: string; excludeId?: string }) =>
    apiClient.get<{ exists: boolean }>(`${BASE}/exists`, { query }),

  create: (input: CreateRoleInput) => apiClient.post<Role>(BASE, input),

  setup: (input: RoleSetupInput) => apiClient.post<RoleSetupResult>(`${BASE}/setup`, input),

  update: (id: string, input: UpdateRoleInput) => apiClient.patch<Role>(byId(id), input),

  remove: (id: string) => apiClient.delete<{ id: string; deletedAt: string }>(byId(id)),

  bulkUpdate: (roles: Array<{ id: string; description?: string; version?: number }>) =>
    apiClient.patch<{ updatedCount: number; unchangedIds: string[]; roles: Role[] }>(
      `${BASE}/bulk`,
      { roles },
    ),
};
