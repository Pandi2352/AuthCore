import type { OrganizationAppearance } from '@/app/theme';
import { apiClient } from '@/lib/api';

/** Mode, preset and appearance options as stored by the API. */
export interface ThemeValues {
  mode: string | null;
  preset: string | null;
  appearance: Record<string, string>;
}

export interface OrgAppearance extends ThemeValues {
  locked: string[];
  /** 0 = no organization look set. */
  version: number;
  updatedAt: string | null;
}

export interface OrgAppearanceAdmin extends OrgAppearance {
  updatedBy: string | null;
  lockableKeys: string[];
}

export interface MyAppearance {
  syncEnabled: boolean;
  theme: ThemeValues | null;
  updatedAt: string | null;
}

/** API answer → what the theme engine applies (null = no organization look). */
export const toOrganization = (org: OrgAppearance): OrganizationAppearance | null =>
  org.version > 0
    ? {
        ...(org.mode ? { mode: org.mode } : {}),
        ...(org.preset ? { preset: org.preset } : {}),
        appearance: org.appearance,
        locked: org.locked,
      }
    : null;

/** Organization appearance (admin) and the signed-in user's synced appearance. */
export const appearanceApi = {
  getOrgPublic: (signal?: AbortSignal) =>
    apiClient.get<OrgAppearance>('/settings/appearance/public', { signal, auth: false }),

  getOrg: (signal?: AbortSignal) =>
    apiClient.get<OrgAppearanceAdmin>('/settings/appearance', { signal }),

  /** Publish: mode / preset / options for everyone + locked options. */
  updateOrg: (body: ThemeValues & { locked: string[]; version?: number }) =>
    apiClient.put<OrgAppearanceAdmin>('/settings/appearance', body),

  resetOrg: () => apiClient.delete<OrgAppearanceAdmin>('/settings/appearance'),

  getMine: (signal?: AbortSignal) =>
    apiClient.get<MyAppearance>('/users/me/appearance', { signal }),

  updateMine: (body: { syncEnabled: boolean; theme: ThemeValues | null }) =>
    apiClient.put<MyAppearance>('/users/me/appearance', body),
};
