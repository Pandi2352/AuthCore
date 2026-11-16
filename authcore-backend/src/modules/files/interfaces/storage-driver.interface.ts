import type { Readable } from 'node:stream';

/**
 * Where file bytes live. The API only talks to this interface, so the local
 * folder can be swapped for S3 / Azure Blob / GCS by adding a driver
 * (STORAGE_DRIVER) without touching the upload code.
 */
export interface StorageDriver {
  readonly name: string;
  /** Stores the bytes under `key` (a relative path the API generated). */
  put(key: string, data: Buffer): Promise<void>;
  /** Streams the bytes; throws if missing. */
  read(key: string): Promise<Readable>;
  /** Removes the bytes; missing files are not an error. */
  delete(key: string): Promise<void>;
  /** Readiness check: storage reachable and writable. */
  isHealthy(): Promise<boolean>;
}

export const STORAGE_DRIVER = Symbol('STORAGE_DRIVER');
