import { FilePurpose } from '@modules/files/enums/file.enum';

/** The one settings document (one per tenant once multi-tenancy exists). */
export const GLOBAL_SETTINGS_KEY = 'global';

/** Owner id of the branding files in the files module (not a user). */
export const BRANDING_FILE_OWNER = 'business-settings';

/** Reads are cached this long; writes on this instance clear the cache at once. */
export const SETTINGS_CACHE_TTL_MS = 15_000;

export const SETTINGS_WRITE_THROTTLE = { limit: 30, ttl: 60_000 } as const;

export const SITE_NAME_MAX_LENGTH = 60;
export const SITE_DESCRIPTION_MAX_LENGTH = 300;

/** Image slots (URL path segment) → file purpose in the files module. */
export const BRAND_ASSETS = {
  logo: FilePurpose.BrandLogo,
  'logo-mark': FilePurpose.BrandLogoMark,
  'auth-logo': FilePurpose.BrandAuthLogo,
  favicon: FilePurpose.BrandFavicon,
} as const;

export type BrandAssetSlot = keyof typeof BRAND_ASSETS;

export const BRAND_ASSET_SLOTS = Object.keys(BRAND_ASSETS) as BrandAssetSlot[];

/** Response field per slot (camelCase). */
export const BRAND_ASSET_FIELDS = {
  logo: 'logo',
  'logo-mark': 'logoMark',
  'auth-logo': 'authLogo',
  favicon: 'favicon',
} as const satisfies Record<BrandAssetSlot, string>;

export type BrandAssetField = (typeof BRAND_ASSET_FIELDS)[BrandAssetSlot];
