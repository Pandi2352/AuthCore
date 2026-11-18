/** Mirrors backend modules/storage (providers + configs). */
export type StorageProviderId =
  'LOCAL' | 'AWS_S3' | 'BACKBLAZE_B2' | 'TIGRIS' | 'SUPABASE' | 'S3_COMPATIBLE';

export interface StorageField {
  key: string;
  label: string;
  type: 'text' | 'url' | 'secret' | 'boolean';
  required: boolean;
  hint?: string;
  placeholder?: string;
  defaultValue?: string | boolean;
  secret?: boolean;
  pattern?: string;
  /** What to enter when the format is wrong. */
  formatHint?: string;
}

export interface StorageProvider {
  id: StorageProviderId;
  label: string;
  description: string;
  docsUrl?: string;
  isBuiltIn: boolean;
  fields: StorageField[];
}

export interface StorageTestResult {
  isSuccess: boolean;
  message: string;
  durationMs: number;
  testedAt: string;
}

export interface StorageUsage {
  fileCount: number;
  usedBytes: number;
  /** Local: disk size; buckets: the "Storage limit (GB)" setting; null = unknown. */
  capacityBytes: number | null;
  freeBytes: number | null;
  capacitySource: 'disk' | 'limit' | null;
}

export interface StorageConfig {
  id: string;
  name: string;
  provider: StorageProviderId;
  providerLabel: string;
  settings: Record<string, string | boolean>;
  secrets: Record<string, { isSet: boolean; hint: string | null }>;
  isActive: boolean;
  isBuiltIn: boolean;
  lastTest: StorageTestResult | null;
  fileCount: number;
  usage: StorageUsage;
  publicUrlExample: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

/** Values in the add / edit form. */
export interface StorageFormValues {
  name: string;
  settings: Record<string, string | boolean>;
  secrets: Record<string, string>;
}
