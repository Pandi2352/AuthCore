import type { OrganizationAppearance } from '@/app/theme';
import { apiClient } from '@/lib/api';

/** The application look as stored by the API. */
export interface AppearanceLook {
  mode: string | null;
  preset: string | null;
  appearance: Record<string, string>;
  /** 0 = never saved (built-in defaults). */
  version: number;
  updatedAt: string | null;
}

/** API answer → what the theme engine applies (null = never saved). */
export const toOrganization = (look: AppearanceLook): OrganizationAppearance | null =>
  look.version > 0
    ? {
        ...(look.mode ? { mode: look.mode } : {}),
        ...(look.preset ? { preset: look.preset } : {}),
        appearance: look.appearance,
      }
    : null;

/** The application look: read by every page, saved by the super admin. */
export const appearanceApi = {
  getPublic: (signal?: AbortSignal) =>
    apiClient.get<AppearanceLook>('/settings/appearance/public', { signal, auth: false }),

  /** APPEARANCE_SETTINGS_MANAGE (super admin). */
  update: (body: { mode: string; preset: string; appearance: Record<string, string> }) =>
    apiClient.put<AppearanceLook>('/settings/appearance', body),
};
