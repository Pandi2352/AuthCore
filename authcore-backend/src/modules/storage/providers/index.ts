import { awsS3Provider } from './aws-s3.provider';
import { backblazeB2Provider } from './backblaze-b2.provider';
import { localProvider } from './local.provider';
import { s3CompatibleProvider } from './s3-compatible.provider';
import type {
  StorageProviderDefinition,
  StorageProviderId,
} from './storage-provider.types';
import { supabaseProvider } from './supabase.provider';
import { tigrisProvider } from './tigris.provider';

export * from './storage-provider.types';

/** Display order on the admin page. Register a new provider here and in storageProviders(). */
export const STORAGE_PROVIDER_IDS: readonly StorageProviderId[] = [
  'LOCAL',
  'AWS_S3',
  'BACKBLAZE_B2',
  'TIGRIS',
  'SUPABASE',
  'S3_COMPATIBLE',
];

/** Every provider by id (the local one needs the folder from the environment). */
export function storageProviders(
  localDirectory: string,
): Record<StorageProviderId, StorageProviderDefinition> {
  return {
    LOCAL: localProvider(localDirectory),
    AWS_S3: awsS3Provider,
    BACKBLAZE_B2: backblazeB2Provider,
    TIGRIS: tigrisProvider,
    SUPABASE: supabaseProvider,
    S3_COMPATIBLE: s3CompatibleProvider,
  };
}
