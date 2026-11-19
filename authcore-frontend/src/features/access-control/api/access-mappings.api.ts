import type { TablePage, TableQuery } from '@/components/data-table';
import { apiClient } from '@/lib/api';

import type {
  AccessMapping,
  AccessMappingListItem,
  AssignResult,
  EffectiveAccess,
  MappingType,
  RemoveResult,
} from '../types/access-control.types';

const BASE = '/access-mappings';
const byId = (id: string) => `${BASE}/${encodeURIComponent(id)}`;

export const accessMappingsApi = {
  list: async (
    query: TableQuery & {
      type?: MappingType;
      userId?: string;
      groupId?: string;
      roleId?: string;
      permissionId?: string;
    },
    signal?: AbortSignal,
  ): Promise<TablePage<AccessMappingListItem>> => {
    const page = await apiClient.getPage<AccessMapping>(BASE, {
      signal,
      query: {
        page: query.page,
        limit: query.pageSize,
        search: query.search.trim() || undefined,
        type: query.type || query.filters.type?.at(-1),
        userId: query.userId || query.filters.userId?.at(-1),
        groupId: query.groupId || query.filters.groupId?.at(-1),
        roleId: query.roleId || query.filters.roleId?.at(-1),
        permissionId: query.permissionId || query.filters.permissionId?.at(-1),
      },
    });

    const first = (query.page - 1) * query.pageSize;
    return {
      items: page.items.map((item, index) => ({ ...item, rowNumber: first + index + 1 })),
      total: page.meta.totalItems,
    };
  },

  assignGroupUsers: (body: { groupId: string; userIds: string[]; expiresAt?: string | null }) =>
    apiClient.post<AssignResult>(`${BASE}/group-users`, body),

  removeGroupUsers: (body: { groupId: string; userIds: string[] }) =>
    apiClient.post<RemoveResult>(`${BASE}/group-users/remove`, body),

  assignGroupRoles: (body: { groupId: string; roleIds: string[]; expiresAt?: string | null }) =>
    apiClient.post<AssignResult>(`${BASE}/group-roles`, body),

  removeGroupRoles: (body: { groupId: string; roleIds: string[] }) =>
    apiClient.post<RemoveResult>(`${BASE}/group-roles/remove`, body),

  assignRolePermissions: (body: {
    roleId: string;
    permissionIds: string[];
    expiresAt?: string | null;
  }) => apiClient.post<AssignResult>(`${BASE}/role-permissions`, body),

  removeRolePermissions: (body: { roleId: string; permissionIds: string[] }) =>
    apiClient.post<RemoveResult>(`${BASE}/role-permissions/remove`, body),

  /** All of a group's members (GROUP_USER) or roles (GROUP_ROLE), every page. */
  groupMappings: async (
    groupId: string,
    type: 'GROUP_USER' | 'GROUP_ROLE',
    signal?: AbortSignal,
  ): Promise<AccessMapping[]> => {
    const items: AccessMapping[] = [];
    for (let page = 1; page <= 50; page += 1) {
      // Pages depend on each other (stop at the last one), so they load one by one.
      // oxlint-disable-next-line no-await-in-loop
      const result = await apiClient.getPage<AccessMapping>(BASE, {
        signal,
        query: { page, limit: 100, type, groupId },
      });
      items.push(...result.items);
      if (!result.meta.hasNextPage) break;
    }
    return items;
  },

  /** Ids of the permissions a role grants directly (all pages). */
  rolePermissionIds: async (roleId: string, signal?: AbortSignal): Promise<string[]> => {
    const ids: string[] = [];
    for (let page = 1; page <= 50; page += 1) {
      // Pages depend on each other (stop at the last one), so they load one by one.
      // oxlint-disable-next-line no-await-in-loop
      const result = await apiClient.getPage<AccessMapping>(BASE, {
        signal,
        query: { page, limit: 100, type: 'ROLE_PERMISSION', roleId },
      });
      for (const m of result.items) if (m.permission) ids.push(m.permission.id);
      if (!result.meta.hasNextPage) break;
    }
    return ids;
  },

  effectiveAccess: (userId: string, signal?: AbortSignal) =>
    apiClient.get<EffectiveAccess>(`${BASE}/users/${encodeURIComponent(userId)}/effective-access`, {
      signal,
    }),

  myAccess: (signal?: AbortSignal) =>
    apiClient.get<EffectiveAccess>('/access-control/me', { signal }),

  setExpiry: (id: string, expiresAt: string | null) =>
    apiClient.patch<AccessMapping>(byId(id), { expiresAt }),

  remove: (id: string) => apiClient.delete<RemoveResult>(byId(id)),
};
