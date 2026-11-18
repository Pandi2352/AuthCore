import type { BrandingAssets } from '@/lib/branding';

/** Image slots (backend path segment). */
export type BrandAssetSlot = 'logo' | 'logo-mark' | 'auth-logo' | 'favicon';

/** Response field per slot. */
export type BrandAssetField = keyof BrandingAssets;

export const SLOT_FIELD: Record<BrandAssetSlot, BrandAssetField> = {
  logo: 'logo',
  'logo-mark': 'logoMark',
  'auth-logo': 'authLogo',
  favicon: 'favicon',
};

/** GET /settings/business/public */
export interface PublicBusinessSettings {
  siteName: string;
  siteDescription: string;
  assets: BrandingAssets;
  version: number;
  updatedAt: string | null;
}

export interface BrandAsset {
  fileId: string;
  url: string;
  originalName: string;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  uploadedAt: string;
}

/** GET /settings/business (admin) */
export interface BusinessSettings {
  siteName: string;
  siteDescription: string;
  assets: Record<BrandAssetField, BrandAsset | null>;
  /** true until the first save (project defaults). */
  isDefault: boolean;
  version: number;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface UpdateBusinessSettingsRequest {
  siteName?: string;
  siteDescription?: string;
  /** The version being edited: 409 VERSION_CONFLICT if someone saved in between. */
  version?: number;
}

/** Limits (same as the backend DTO). */
export const SITE_NAME_MAX = 60;
export const SITE_DESCRIPTION_MAX = 300;
/** UPLOAD_AVATAR_MAX_SIZE_MB on the backend (checked again there). */
export const BRAND_IMAGE_MAX_BYTES = 2 * 1024 * 1024;
export const BRAND_IMAGE_TYPES = ['image/png', 'image/webp', 'image/jpeg'] as const;
