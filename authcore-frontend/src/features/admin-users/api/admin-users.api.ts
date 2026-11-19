import type { TablePage, TableQuery } from '@/components/data-table';
import { apiClient, downloadFile } from '@/lib/api';

import type {
  AdminUser,
  AdminUserDetails,
  SettableStatus,
  UserReport,
  UserStats,
} from '../types/admin-user.types';

/** Table column id → API sort field (GET /admin/users sortBy). */
const SORT_FIELD: Record<string, string> = {
  name: 'firstName',
  email: 'email',
  status: 'status',
  lastLoginAt: 'lastLoginAt',
  createdAt: 'createdAt',
};

/** Table filters → API filters (shared by the list and "Generate report"). */
export function toApiFilters(query: Pick<TableQuery, 'search' | 'filters' | 'sort'>) {
  const list = (id: string) => {
    const values = query.filters[id];
    return values && values.length > 0 ? values.join(',') : undefined;
  };
  const sort = query.sort[0];
  return {
    search: query.search.trim() || undefined,
    status: list('status'),
    role: list('role'),
    groupId: list('group'),
    // One activity at a time (the cards); the last picked wins.
    activity: query.filters.activity?.at(-1),
    sortBy: sort ? (SORT_FIELD[sort.id] ?? 'createdAt') : 'createdAt',
    sortOrder: sort ? (sort.desc ? 'desc' : 'asc') : 'desc',
  } as const;
}

/** Users administration (USER_READ to view; USER_UPDATE to change). */
export const adminUsersApi = {
  list: async (query: TableQuery, signal: AbortSignal): Promise<TablePage<AdminUser>> => {
    const page = await apiClient.getPage<Omit<AdminUser, 'rowNumber'>>('/admin/users', {
      signal,
      query: { ...toApiFilters(query), page: query.page, limit: query.pageSize },
    });
    const first = (query.page - 1) * query.pageSize;
    return {
      items: page.items.map((user, index) => ({ ...user, rowNumber: first + index + 1 })),
      total: page.meta.totalItems,
    };
  },

  stats: (signal?: AbortSignal) => apiClient.get<UserStats>('/admin/users/stats', { signal }),

  get: (id: string, signal?: AbortSignal) =>
    apiClient.get<AdminUserDetails>(`/admin/users/${encodeURIComponent(id)}`, { signal }),

  update: (
    id: string,
    body: {
      firstName?: string;
      lastName?: string | null;
      username?: string | null;
      email?: string;
      isEmailVerified?: boolean;
    },
  ) => apiClient.patch<AdminUserDetails>(`/admin/users/${encodeURIComponent(id)}`, body),

  /** Custom variable values (null clears one). */
  updateAttributes: (id: string, attributes: Record<string, unknown>) =>
    apiClient.patch<AdminUserDetails>(`/admin/users/${encodeURIComponent(id)}/attributes`, {
      attributes,
    }),

  setStatus: (
    id: string,
    body: { status: SettableStatus; reason?: string; notifyUser?: boolean },
  ) => apiClient.patch<AdminUserDetails>(`/admin/users/${encodeURIComponent(id)}/status`, body),

  /** Change user role: ADMIN (super admin) vs USER. */
  setRole: (id: string, role: 'ADMIN' | 'USER') =>
    apiClient.patch<AdminUserDetails>(`/admin/users/${encodeURIComponent(id)}/role`, { role }),

  /** Effective access resolution for this user. */
  effectiveAccess: (id: string, signal?: AbortSignal) =>
    apiClient.get<{
      userId: string;
      isAdmin: boolean;
      groups: Array<{ id: string; groupId: string; groupName: string }>;
      roles: Array<{ id: string; roleKey: string; roleName: string }>;
      permissions: string[];
    }>(`/access-mappings/users/${encodeURIComponent(id)}/effective-access`, { signal }),

  /** Groups for the filter (needs GROUP_READ). */
  groups: (signal?: AbortSignal) =>
    apiClient.get<Array<{ id: string; label: string }>>('/groups/dropdown', { signal }),

  /** Group mappings for a user (needs ACCESS_READ). */
  userGroupMappings: (userId: string, signal?: AbortSignal) =>
    apiClient.getPage<{
      id: string;
      isExpired: boolean;
      group?: { id: string; groupName: string } | null;
    }>('/access-mappings', {
      signal,
      query: {
        page: 1,
        limit: 50,
        type: 'GROUP_USER',
        userId,
      },
    }),

  /** Assign a user to a group (needs ACCESS_MANAGE). */
  assignUserToGroup: (userId: string, groupId: string) =>
    apiClient.post<{ count: number }>('/access-mappings/group-users', {
      groupId,
      userIds: [userId],
    }),

  /** Remove an access mapping (needs ACCESS_MANAGE). */
  removeGroupMapping: (mappingId: string) =>
    apiClient.delete<{ count: number }>(`/access-mappings/${encodeURIComponent(mappingId)}`),

  reports: {
    /** The users matching these filters, as a CSV built in the background. */
    create: (filters: ReturnType<typeof toApiFilters>) =>
      apiClient.post<UserReport>('/admin/users/reports', undefined, { query: filters }),
    list: (signal?: AbortSignal) => apiClient.get<UserReport[]>('/admin/users/reports', { signal }),
    download: (report: UserReport) =>
      downloadFile(`/admin/users/reports/${encodeURIComponent(report.id)}/download`, {
        fallbackFilename: report.fileName,
      }),
    remove: (id: string) =>
      apiClient.delete<{ id: string }>(`/admin/users/reports/${encodeURIComponent(id)}`),
  },
};
