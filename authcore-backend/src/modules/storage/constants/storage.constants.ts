/** Fixed id of the built-in local-folder storage (always present, the fallback). */
export const LOCAL_STORAGE_CONFIG_ID = '00000000-0000-4000-8000-000000000001';

/** Which storage is active is re-read this often (other instances pick a switch up). */
export const ACTIVE_STORAGE_CACHE_TTL_MS = 15_000;

/** Encryption context for stored credentials (HKDF info). */
export const STORAGE_SECRETS_CONTEXT = 'authcore:storage-credentials:v1';

export const STORAGE_NAME_MAX_LENGTH = 60;
export const STORAGE_SETTING_MAX_LENGTH = 500;

export const STORAGE_WRITE_THROTTLE = { limit: 30, ttl: 60_000 } as const;
/** Connection tests call the provider: keep them rare. */
export const STORAGE_TEST_THROTTLE = { limit: 10, ttl: 60_000 } as const;
/** POST /uploads per user. */
export const UPLOAD_THROTTLE = { limit: 60, ttl: 60_000 } as const;
