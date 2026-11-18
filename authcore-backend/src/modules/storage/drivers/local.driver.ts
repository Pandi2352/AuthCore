import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import {
  access,
  constants,
  mkdir,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import type { Readable } from 'node:stream';

import {
  SAFE_KEY,
  type StorageDriver,
  type StoredObject,
  TEMP_SUFFIX,
} from './storage-driver.interface';

/**
 * Files in a local folder. Writes go to a temp file first and are renamed into place, so a
 * crash never leaves a half-written file under a real key. Keys are validated so nothing can
 * escape the folder.
 */
export class LocalStorageDriver implements StorageDriver {
  readonly name = 'local';
  private readonly root: string;
  private ready: Promise<unknown> | null = null;

  constructor(directory: string) {
    this.root = isAbsolute(directory)
      ? directory
      : resolve(process.cwd(), directory);
  }

  get directory(): string {
    return this.root;
  }

  async put(key: string, data: Buffer): Promise<void> {
    await this.ensureRoot();
    const target = this.pathOf(key);
    await mkdir(dirname(target), { recursive: true });
    const temp = `${target}.${randomUUID()}.tmp`;
    try {
      await writeFile(temp, data, { flag: 'wx', mode: 0o640 });
      await rename(temp, target);
    } catch (error) {
      await rm(temp, { force: true });
      throw error;
    }
  }

  async read(key: string): Promise<Readable> {
    const path = this.pathOf(key);
    await stat(path);
    return createReadStream(path);
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathOf(key), { force: true });
  }

  async *list(): AsyncIterable<StoredObject> {
    await this.ensureRoot();
    const entries = await readdir(this.root, {
      recursive: true,
      withFileTypes: true,
    });
    for (const entry of entries) {
      if (!entry.isFile()) {
        continue;
      }
      const absolute = join(entry.parentPath, entry.name);
      const key = relative(this.root, absolute).split(sep).join('/');
      if (!SAFE_KEY.test(key)) {
        // Not ours (e.g. a README someone put there): never touched.
        continue;
      }
      const info = await stat(absolute);
      yield { key, modifiedAt: info.mtime, isTemp: TEMP_SUFFIX.test(key) };
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      await this.ensureRoot();
      await access(this.root, constants.W_OK);
      return true;
    } catch {
      return false;
    }
  }

  objectKey(key: string): string {
    return key;
  }

  private ensureRoot(): Promise<unknown> {
    this.ready ??= mkdir(this.root, { recursive: true });
    return this.ready;
  }

  /** Absolute path of a key, refusing anything that could leave the root folder. */
  private pathOf(key: string): string {
    if (!SAFE_KEY.test(key)) {
      throw new Error('Invalid storage key');
    }
    const path = resolve(this.root, key);
    if (!path.startsWith(this.root + sep)) {
      throw new Error('Invalid storage key');
    }
    return path;
  }
}
