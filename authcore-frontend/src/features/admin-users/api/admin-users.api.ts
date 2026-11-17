import type { BulkTarget, TablePage, TableQuery } from '@/components/data-table';

import type { AdminUser, AdminUserStatus } from '../types/admin-user.types';
import { mockDeleteUsers, mockFetchUsers, mockSetStatus } from './users.mock';

/**
 * Users administration API. MOCK for now (users.mock.ts); when the backend list endpoint
 * is wired, map TableQuery → GET /admin/users?page&limit&search&sort&status&role here —
 * pages and the DataTable don't change.
 */
export const adminUsersApi = {
  list: (query: TableQuery, signal: AbortSignal): Promise<TablePage<AdminUser>> =>
    mockFetchUsers(query, signal),
  setStatus: (target: BulkTarget, status: AdminUserStatus) => mockSetStatus(target, status),
  remove: (target: BulkTarget) => mockDeleteUsers(target),
};
