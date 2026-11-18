/**
 * A storage provider = a form (fields) + how to turn the entered values into a driver
 * configuration + how to build a public URL for a stored key.
 *
 * To add a provider: copy one of the *.provider.ts files, adjust it, and register it in
 * providers/index.ts. Nothing else in the API needs to change (the settings API, the admin
 * page and the upload code are driven by this definition).
 */

export type StorageProviderId =
  'LOCAL' | 'AWS_S3' | 'BACKBLAZE_B2' | 'TIGRIS' | 'SUPABASE' | 'S3_COMPATIBLE';

export interface StorageFieldDefinition {
  /** Key in `settings` (or `secrets` when `secret`). */
  key: string;
  label: string;
  type: 'text' | 'url' | 'secret' | 'boolean';
  required: boolean;
  /** Help text under the field (where to find the value). */
  hint?: string;
  /** Instructional placeholder for the form. */
  placeholder?: string;
  /** Pre-filled value for new configurations. */
  defaultValue?: string | boolean;
  /** Stored encrypted, never returned by the API. */
  secret?: boolean;
  /** Optional regex the value must match (validated on save / test). */
  pattern?: string;
  /** Error text when the pattern doesn't match (what to enter instead). */
  formatHint?: string;
  /**
   * Server-side clean-up after validation (e.g. a pasted endpoint → its region). Not sent
   * to clients.
   */
  normalize?: (value: string) => string;
}

/** Values a user entered: plain settings + decrypted secrets (in memory only). */
export interface StorageValues {
  settings: Record<string, string | boolean | undefined>;
  secrets: Record<string, string | undefined>;
}

/** Everything the S3 driver needs. */
export interface S3DriverConfig {
  kind: 's3';
  bucket: string;
  region: string;
  /** Omit for AWS (the SDK picks the regional endpoint). */
  endpoint?: string;
  forcePathStyle: boolean;
  accessKeyId: string;
  secretAccessKey: string;
  /** Folder inside the bucket, e.g. "app-uploads" (no leading / trailing slash). */
  prefix: string;
}

export interface LocalDriverConfig {
  kind: 'local';
  /** Absolute or relative (to the working directory) folder. */
  directory: string;
}

export type DriverConfig = S3DriverConfig | LocalDriverConfig;

export interface StorageProviderDefinition {
  id: StorageProviderId;
  label: string;
  description: string;
  /** Link to the provider's docs for creating keys / buckets. */
  docsUrl?: string;
  fields: readonly StorageFieldDefinition[];
  /** Built-in: one instance, created automatically, cannot be added / edited / deleted. */
  isBuiltIn?: boolean;
  toDriverConfig(values: StorageValues): DriverConfig;
  /**
   * Direct public URL of an object (public bucket / CDN), or null when objects are only
   * reachable through the API (private bucket, local folder).
   */
  publicUrl(values: StorageValues, objectKey: string): string | null;
}

// ---------------------------------------------------------------- helpers for definitions

export const text = (values: StorageValues, key: string): string => {
  const value = values.settings[key];
  return typeof value === 'string' ? value.trim() : '';
};

export const secret = (values: StorageValues, key: string): string =>
  (values.secrets[key] ?? '').trim();

export const flag = (values: StorageValues, key: string): boolean =>
  values.settings[key] === true || values.settings[key] === 'true';

/** "a/b/" → "a/b"; "" stays "". */
export const cleanPrefix = (value: string): string =>
  value.replace(/^\/+|\/+$/g, '').replace(/\/{2,}/g, '/');

/** Joins a base URL and a key, encoding each path segment. */
export const joinUrl = (base: string, key: string): string =>
  `${base.replace(/\/+$/, '')}/${key.split('/').map(encodeURIComponent).join('/')}`;

/** Shared fields of every S3-style provider. */
export const PREFIX_FIELD: StorageFieldDefinition = {
  key: 'prefix',
  label: 'Folder (optional)',
  type: 'text',
  required: false,
  placeholder: 'Enter a folder inside the bucket, or leave empty',
  hint: 'Files are stored under this folder, e.g. "app-uploads".',
  pattern: '^[A-Za-z0-9._\\-/]*$',
  formatHint: "Use letters, digits, dots, dashes, underscores and '/' only",
};

export const PUBLIC_URL_FIELD = (hint: string): StorageFieldDefinition => ({
  key: 'publicUrl',
  label: 'Public URL (optional)',
  type: 'url',
  required: false,
  placeholder: 'Enter the public base URL or CDN domain',
  hint,
  pattern: '^https?://\\S+$',
  formatHint: 'Use a full address starting with https://',
});

/** Public reads on the bucket: direct URLs only when on (or a public URL is entered). */
export const PUBLIC_ACCESS_FIELD: StorageFieldDefinition = {
  key: 'isPublic',
  label: 'Bucket allows public reads',
  type: 'boolean',
  required: false,
  defaultValue: false,
  hint: 'On: file URLs point straight at the bucket. Off (private bucket): files are served through this API.',
};

/** Optional limit shown as a usage bar (S3-style providers have no capacity API). */
export const QUOTA_FIELD: StorageFieldDefinition = {
  key: 'quotaGb',
  label: 'Storage limit in GB (optional)',
  type: 'text',
  required: false,
  placeholder: 'Enter your plan limit, e.g. 10, or leave empty',
  hint: 'Only used for the usage bar on the settings page.',
  pattern: '^\\d{1,6}(\\.\\d{1,2})?$',
  formatHint: 'Use a number of GB, e.g. 10 or 2.5',
};

/** Direct URL of a key: the entered public URL, else `defaultBase` when the bucket is public. */
export function publicAddress(
  values: StorageValues,
  defaultBase: string,
  key: string,
): string | null {
  const base =
    text(values, 'publicUrl') || (flag(values, 'isPublic') ? defaultBase : '');
  return base ? joinUrl(base, key) : null;
}
