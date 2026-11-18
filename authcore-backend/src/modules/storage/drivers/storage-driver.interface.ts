import type { Readable } from 'node:stream';

export interface StoredObject {
  /** Key as the API knows it (without the driver's bucket prefix). */
  key: string;
  modifiedAt: Date;
  /** Leftover of an interrupted write (`<key>.<uuid>.tmp`, local only). */
  isTemp: boolean;
}

export interface PutOptions {
  /** Stored with the object (S3: Content-Type header for direct public URLs). */
  contentType?: string;
}

/**
 * Where file bytes live. Upload code only talks to this interface; local folder and S3-style
 * buckets are interchangeable. Plain classes (no framework): copy drivers/ to another project.
 */
export interface StorageDriver {
  /** Provider family, stored on each file record ("local", "s3"). */
  readonly name: string;
  /** Stores the bytes under `key` (a relative path the API generated). */
  put(key: string, data: Buffer, options?: PutOptions): Promise<void>;
  /** Streams the bytes; throws if missing. */
  read(key: string): Promise<Readable>;
  /** Removes the bytes; missing objects are not an error. */
  delete(key: string): Promise<void>;
  /** Every object the API created (orphan cleanup); foreign objects are skipped. */
  list(): AsyncIterable<StoredObject>;
  /** Storage reachable and writable. */
  isHealthy(): Promise<boolean>;
  /** Full key inside the bucket / folder (with the prefix), for public URLs. */
  objectKey(key: string): string;
}

/**
 * Keys the API generates: <purpose>/yyyy/mm/<uuid>.<ext> — no "..", no absolute paths —
 * plus temp leftovers of interrupted local writes: <key>.<uuid>.tmp.
 */
export const SAFE_KEY =
  /^[a-z0-9-]+(\/[a-z0-9-]+)*\/[a-z0-9-]+\.[a-z0-9]+(\.[0-9a-f-]{36}\.tmp)?$/;
export const TEMP_SUFFIX = /\.[0-9a-f-]{36}\.tmp$/;
