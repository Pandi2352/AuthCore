import { apiClient } from '@/lib/api';

import type {
  StorageConfig,
  StorageProvider,
  StorageProviderId,
  StorageTestResult,
} from '../types/storage.types';

const BASE = '/settings/storage';
const byId = (id: string) => `${BASE}/${encodeURIComponent(id)}`;

/** File storage settings (STORAGE_SETTINGS_READ / STORAGE_SETTINGS_MANAGE). */
export const storageApi = {
  providers: (signal?: AbortSignal) =>
    apiClient.get<StorageProvider[]>(`${BASE}/providers`, { signal }),

  list: (signal?: AbortSignal) => apiClient.get<StorageConfig[]>(BASE, { signal }),

  create: (body: {
    name: string;
    provider: StorageProviderId;
    settings: Record<string, string | boolean>;
    secrets: Record<string, string>;
  }) => apiClient.post<StorageConfig>(BASE, body),

  /** Secrets left empty keep the saved value. */
  update: (
    id: string,
    body: {
      name?: string;
      settings?: Record<string, string | boolean>;
      secrets?: Record<string, string>;
      version?: number;
    },
  ) => apiClient.patch<StorageConfig>(byId(id), body),

  remove: (id: string) => apiClient.delete<{ id: string }>(byId(id)),

  /** Test form values before saving (with `id`, empty secrets use the saved ones). */
  testValues: (body: {
    provider: StorageProviderId;
    settings: Record<string, string | boolean>;
    secrets: Record<string, string>;
    id?: string;
  }) => apiClient.post<StorageTestResult>(`${BASE}/test`, body),

  test: (id: string) => apiClient.post<StorageTestResult>(`${byId(id)}/test`),

  /** Tests first; fails with STORAGE_CONNECTION_FAILED. */
  activate: (id: string) => apiClient.post<StorageConfig>(`${byId(id)}/activate`),
};
