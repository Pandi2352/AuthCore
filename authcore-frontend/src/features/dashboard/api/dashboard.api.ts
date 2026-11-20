import { apiClient } from '@/lib/api';

/**
 * The counts the dashboard shows, straight from each area's stats endpoint (the same ones the
 * pages use). Only the parts the signed-in user may read are asked for.
 */
export interface DashboardCounts {
  users: {
    total: number;
    active: number;
    dormant: number;
    inactive: number;
    newLast30Days: number;
  } | null;
  invites: { pending: number; expired: number; accepted: number } | null;
  roles: { totalRoles: number; rolesWithoutPermissions: number; rolesInUse: number } | null;
  groups: { totalGroups: number; groupsWithoutMembers: number; members: number } | null;
  activity: {
    signIns24h: number;
    failedSignIns24h: number;
    activeUsers24h: number;
    lockouts7d: number;
    newDevices7d: number;
  } | null;
  audit: { last24Hours: number; total: number } | null;
}

export type DashboardArea = keyof DashboardCounts;

const ENDPOINT: Record<DashboardArea, string> = {
  users: '/admin/users/stats',
  invites: '/user-invites/stats',
  roles: '/roles/stats',
  groups: '/groups/stats',
  activity: '/admin/activity/stats',
  audit: '/access-control/audit-logs/stats',
};

export const dashboardApi = {
  /** Loads the given areas in parallel; an area that fails comes back as null. */
  counts: async (areas: DashboardArea[], signal?: AbortSignal): Promise<DashboardCounts> => {
    const results = await Promise.allSettled(
      areas.map((area) => apiClient.get<Record<string, number>>(ENDPOINT[area], { signal })),
    );
    const counts: DashboardCounts = {
      users: null,
      invites: null,
      roles: null,
      groups: null,
      activity: null,
      audit: null,
    };
    areas.forEach((area, i) => {
      const result = results[i];
      if (result?.status === 'fulfilled') {
        (counts as unknown as Record<DashboardArea, unknown>)[area] = result.value;
      }
    });
    return counts;
  },
};
