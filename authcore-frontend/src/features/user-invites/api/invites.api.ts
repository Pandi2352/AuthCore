import type { TablePage, TableQuery } from '@/components/data-table';
import { apiClient } from '@/lib/api';

import type {
  BulkInviteResult,
  GroupOption,
  Invite,
  InviteOptions,
  InvitePerson,
  InviteStats,
  InviteStatus,
  RegisteredUser,
} from '../types/invite.types';

const BASE = '/user-invites';
const byId = (id: string) => `${BASE}/${encodeURIComponent(id)}`;

export interface PageQuery {
  page: number;
  limit: number;
  search?: string;
}

/** A page with a 1-based row number (the S.No column). */
const numbered = <T>(items: T[], query: TableQuery): Array<T & { rowNumber: number }> =>
  items.map((item, i) => ({ ...item, rowNumber: (query.page - 1) * query.pageSize + i + 1 }));

/** Invitations (USER_READ to list, USER_INVITE to send / resend / revoke / delete). */
export const invitesApi = {
  /** Counts for the page cards and tab badges. */
  stats: (signal?: AbortSignal) => apiClient.get<InviteStats>(`${BASE}/stats`, { signal }),

  /** Invites for one table (status comes from the table's status filter or `status`). */
  page: async (
    query: TableQuery,
    status: InviteStatus,
    signal: AbortSignal,
  ): Promise<TablePage<Invite & { rowNumber: number }>> => {
    const result = await apiClient.getPage<Invite>(BASE, {
      signal,
      query: {
        page: query.page,
        limit: query.pageSize,
        search: query.search.trim() || undefined,
        status,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      },
    });
    return { items: numbered(result.items, query), total: result.meta.totalItems };
  },

  /** Self-registered accounts for the table. */
  registeredPage: async (
    query: TableQuery,
    signal: AbortSignal,
  ): Promise<TablePage<RegisteredUser & { rowNumber: number }>> => {
    const result = await apiClient.getPage<RegisteredUser>('/admin/users', {
      signal,
      query: {
        page: query.page,
        limit: query.pageSize,
        search: query.search.trim() || undefined,
        source: 'REGISTRATION',
        sortBy: 'createdAt',
        sortOrder: 'desc',
      },
    });
    return { items: numbered(result.items, query), total: result.meta.totalItems };
  },

  list: (query: PageQuery & { status?: InviteStatus }, signal?: AbortSignal) =>
    apiClient.getPage<Invite>(BASE, {
      signal,
      query: {
        ...query,
        search: query.search || undefined,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      },
    }),

  /** Total for a status (tab badges). */
  count: async (status: InviteStatus, signal?: AbortSignal) =>
    (await apiClient.getPage<Invite>(BASE, { signal, query: { status, page: 1, limit: 1 } })).meta
      .totalItems,

  create: (person: InvitePerson & InviteOptions) => apiClient.post<Invite>(BASE, person),

  /** Up to 100 people; registered / already-invited / repeated emails are skipped and reported. */
  bulk: (invites: InvitePerson[], options: InviteOptions) =>
    apiClient.post<BulkInviteResult>(`${BASE}/bulk`, { invites, ...options }),

  /** Pending or expired: a new link (the old one stops working). 429 during the cooldown. */
  resend: (id: string) => apiClient.post<Invite>(`${byId(id)}/resend`),

  /** Pending only: the link stops working. */
  revoke: (id: string) => apiClient.post<Invite>(`${byId(id)}/revoke`),

  /** Not accepted ones (accepted invites are kept as history). */
  remove: (id: string) => apiClient.delete<{ id: string }>(byId(id)),

  /** People who signed up on their own. */
  registered: (query: PageQuery, signal?: AbortSignal) =>
    apiClient.getPage<RegisteredUser>('/admin/users', {
      signal,
      query: {
        ...query,
        search: query.search || undefined,
        source: 'REGISTRATION',
        sortBy: 'createdAt',
        sortOrder: 'desc',
      },
    }),

  registeredCount: async (signal?: AbortSignal) =>
    (
      await apiClient.getPage<RegisteredUser>('/admin/users', {
        signal,
        query: { source: 'REGISTRATION', page: 1, limit: 1 },
      })
    ).meta.totalItems,

  /** Groups to add the person to (needs GROUP_READ). */
  groups: (signal?: AbortSignal) => apiClient.get<GroupOption[]>('/groups/dropdown', { signal }),
};
