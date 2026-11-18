import type { StorageProviderDefinition } from './storage-provider.types';

/**
 * The server's own folder (STORAGE_LOCAL_DIR, default ./uploads). Built in: always present,
 * the fallback when nothing else is active. Its folder comes from the environment only — a
 * filesystem path is never accepted from the API.
 */
export function localProvider(directory: string): StorageProviderDefinition {
  return {
    id: 'LOCAL',
    label: 'Local folder',
    description:
      'Files stay on this server (uploads folder). Fine for development and single-server setups.',
    isBuiltIn: true,
    fields: [],
    toDriverConfig: () => ({ kind: 'local', directory }),
    // Served through the API (GET /files/public/:id).
    publicUrl: () => null,
  };
}
