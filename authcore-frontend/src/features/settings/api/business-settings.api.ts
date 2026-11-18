import { apiClient, uploadFile, type UploadProgress } from '@/lib/api';

import type {
  BrandAssetSlot,
  BusinessSettings,
  PublicBusinessSettings,
  UpdateBusinessSettingsRequest,
} from '../types/business-settings.types';

const BASE = '/settings/business';

/** Business settings: site name, description, logos and favicon. */
export const businessSettingsApi = {
  /** No sign-in needed: every page's branding. */
  getPublic: (signal?: AbortSignal) =>
    apiClient.get<PublicBusinessSettings>(`${BASE}/public`, { signal, auth: false }),

  /** Admin view (BUSINESS_SETTINGS_READ). */
  get: (signal?: AbortSignal) => apiClient.get<BusinessSettings>(BASE, { signal }),

  /** BUSINESS_SETTINGS_MANAGE. Send only what changes, plus the version being edited. */
  update: (body: UpdateBusinessSettingsRequest) => apiClient.patch<BusinessSettings>(BASE, body),

  /** Upload or replace an image (validated, scanned and re-encoded by the backend). */
  uploadAsset: (
    slot: BrandAssetSlot,
    file: File,
    options: { onProgress?: (p: UploadProgress) => void; signal?: AbortSignal } = {},
  ) => uploadFile<BusinessSettings>(`${BASE}/assets/${encodeURIComponent(slot)}`, file, options),

  /** Remove an image: the built-in default is used again. */
  removeAsset: (slot: BrandAssetSlot) =>
    apiClient.delete<BusinessSettings>(`${BASE}/assets/${encodeURIComponent(slot)}`),
};
