import type { TablePage, TableQuery } from '@/components/data-table';
import { apiClient } from '@/lib/api';

import type {
  CreateGroupInput,
  Group,
  GroupCategory,
  GroupListItem,
  GroupStats,
  GroupTreeNode,
  PermissionMatrix,
  UpdateGroupInput,
} from '../types/access-control.types';

const BASE = '/groups';
const byId = (id: string) => `${BASE}/${encodeURIComponent(id)}`;

const SORT_FIELD: Record<string, string> = {
  groupName: 'groupName',
  groupId: 'groupId',
  category: 'category',
  level: 'level',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
};

export const groupsApi = {
  list: async (query: TableQuery, signal?: AbortSignal): Promise<TablePage<GroupListItem>> => {
    const sort = query.sort[0];
    const categoryFilter = query.filters.category?.join(',');
    const levelFilter = query.filters.level?.at(-1);
    const tagsFilter = query.filters.tags?.join(',');

    const page = await apiClient.getPage<Group>(BASE, {
      signal,
      query: {
        page: query.page,
        limit: query.pageSize,
        search: query.search.trim() || undefined,
        category: categoryFilter || undefined,
        level: levelFilter || undefined,
        tags: tagsFilter || undefined,
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

  get: (id: string, signal?: AbortSignal) => apiClient.get<Group>(byId(id), { signal }),

  getByCode: (code: string, category?: string, signal?: AbortSignal) =>
    apiClient.get<Group>(`${BASE}/code/${encodeURIComponent(code)}`, {
      signal,
      query: { category },
    }),

  dropdown: (
    query?: {
      category?: string;
      rootOnly?: boolean;
      parentGroupId?: string;
      excludeId?: string;
      search?: string;
    },
    signal?: AbortSignal,
  ) =>
    apiClient.get<Array<{ id: string; label: string; key: string; parentId?: string | null }>>(
      `${BASE}/dropdown`,
      {
        signal,
        query: {
          category: query?.category,
          rootOnly: query?.rootOnly,
          parentGroupId: query?.parentGroupId,
          excludeId: query?.excludeId,
          search: query?.search?.trim() || undefined,
        },
      },
    ),

  /** Built-in categories, then admin-added ones. */
  categories: (signal?: AbortSignal) =>
    apiClient.get<GroupCategory[]>(`${BASE}/categories`, { signal }),

  /** Add a category from its label ("Field teams" → FIELD_TEAMS). */
  createCategory: (label: string) => apiClient.post<GroupCategory>(`${BASE}/categories`, { label }),

  /** Next free ID in the GRP-NN series, e.g. GRP-07. */
  nextId: (signal?: AbortSignal) =>
    apiClient.get<{ groupId: string }>(`${BASE}/next-id`, { signal }),

  stats: (signal?: AbortSignal) => apiClient.get<GroupStats>(`${BASE}/stats`, { signal }),

  tree: (query?: { category?: string; rootId?: string; maxDepth?: number }, signal?: AbortSignal) =>
    apiClient.get<GroupTreeNode[]>(`${BASE}/tree`, {
      signal,
      query: {
        category: query?.category,
        rootId: query?.rootId,
        maxDepth: query?.maxDepth,
        withCounts: true,
      },
    }),

  children: (id: string, query?: { recursive?: boolean }, signal?: AbortSignal) =>
    apiClient.get<Group[]>(`${byId(id)}/children`, {
      signal,
      query: { recursive: query?.recursive },
    }),

  permissionMatrix: (id: string, category?: string, signal?: AbortSignal) =>
    apiClient.get<PermissionMatrix>(`${byId(id)}/permission-matrix`, {
      signal,
      query: { category },
    }),

  exists: (query: {
    groupId?: string;
    groupName?: string;
    parentGroupId?: string | null;
    excludeId?: string;
  }) => apiClient.get<{ exists: boolean }>(`${BASE}/exists`, { query }),

  create: (input: CreateGroupInput) => apiClient.post<Group>(BASE, input),

  update: (id: string, input: UpdateGroupInput) => apiClient.patch<Group>(byId(id), input),

  remove: (id: string) => apiClient.delete<{ id: string; deletedAt: string }>(byId(id)),
};
