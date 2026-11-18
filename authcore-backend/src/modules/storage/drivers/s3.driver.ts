import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

import type { S3DriverConfig } from '../providers/storage-provider.types';
import {
  type PutOptions,
  SAFE_KEY,
  type StorageDriver,
  type StoredObject,
} from './storage-driver.interface';

/** Folders the API writes to: orphan cleanup never looks anywhere else in the bucket. */
export const OWN_FOLDERS = new Set([
  'avatar',
  'document',
  'upload',
  'brand-logo',
  'brand-logo-mark',
  'brand-auth-logo',
  'brand-favicon',
]);

const REQUEST_TIMEOUT_MS = 20_000;

/**
 * Any S3-compatible bucket (AWS S3, Backblaze B2, Tigris, Supabase, R2, Spaces, MinIO …).
 * The provider definitions only differ in endpoint / region / addressing style.
 */
export class S3StorageDriver implements StorageDriver {
  readonly name = 's3';
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly prefix: string;

  constructor(config: S3DriverConfig) {
    this.bucket = config.bucket;
    this.prefix = config.prefix ? `${config.prefix}/` : '';
    this.client = new S3Client({
      region: config.region || 'us-east-1',
      ...(config.endpoint ? { endpoint: config.endpoint } : {}),
      forcePathStyle: config.forcePathStyle,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      // Newer SDKs add CRC checksums that several S3-compatible services reject.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
      maxAttempts: 2,
    });
  }

  objectKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  async put(
    key: string,
    data: Buffer,
    options: PutOptions = {},
  ): Promise<void> {
    this.assertKey(key);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: this.objectKey(key),
        Body: data,
        ContentLength: data.length,
        ContentType: options.contentType ?? 'application/octet-stream',
        // Uploaded content never changes (new upload = new key).
        CacheControl: 'public, max-age=31536000, immutable',
      }),
      { abortSignal: AbortSignal.timeout(REQUEST_TIMEOUT_MS * 3) },
    );
  }

  async read(key: string): Promise<Readable> {
    this.assertKey(key);
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: this.objectKey(key) }),
    );
    if (!result.Body) {
      throw new Error('Empty object body');
    }
    return result.Body instanceof Readable
      ? result.Body
      : Readable.from(await result.Body.transformToByteArray());
  }

  async delete(key: string): Promise<void> {
    this.assertKey(key);
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: this.objectKey(key),
      }),
      { abortSignal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) },
    );
  }

  async *list(): AsyncIterable<StoredObject> {
    let token: string | undefined;
    do {
      const page = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: this.prefix || undefined,
          ContinuationToken: token,
        }),
        { abortSignal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) },
      );
      for (const item of page.Contents ?? []) {
        if (!item.Key) {
          continue;
        }
        const key = item.Key.slice(this.prefix.length);
        const folder = key.split('/')[0] ?? '';
        // Only our own keys in our own folders: a shared bucket's other files are never touched.
        if (!SAFE_KEY.test(key) || !OWN_FOLDERS.has(folder)) {
          continue;
        }
        yield {
          key,
          modifiedAt: item.LastModified ?? new Date(),
          isTemp: false,
        };
      }
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);
  }

  /** Writes, reads back and deletes a tiny probe object. */
  async isHealthy(): Promise<boolean> {
    try {
      await this.probe();
      return true;
    } catch {
      return false;
    }
  }

  /** Like isHealthy, but throws the provider's error (shown on the settings page). */
  async probe(): Promise<void> {
    const key = `upload/probe/${randomUUID()}.txt`;
    await this.put(key, Buffer.from('storage connection test'), {
      contentType: 'text/plain',
    });
    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: this.objectKey(key),
        }),
        { abortSignal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) },
      );
    } finally {
      await this.delete(key);
    }
  }

  destroy(): void {
    this.client.destroy();
  }

  private assertKey(key: string): void {
    if (!SAFE_KEY.test(key)) {
      throw new Error('Invalid storage key');
    }
  }
}
