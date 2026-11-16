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

import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { generateUuid } from '@common/utils/uuid.util';

import type {
  StorageDriver,
  StoredObject,
} from '../interfaces/storage-driver.interface';

/**
 * Keys the API generates: purpose/yyyy/mm/<uuid>.<ext> (no "..", no absolute
 * paths), plus temp leftovers of interrupted writes: <key>.<uuid>.tmp.
 */
const SAFE_KEY =
  /^[a-z0-9-]+(\/[a-z0-9-]+)*\/[a-z0-9-]+\.[a-z0-9]+(\.[0-9a-f-]{36}\.tmp)?$/;
const TEMP_SUFFIX = /\.[0-9a-f-]{36}\.tmp$/;

/**
 * Files in a local folder (STORAGE_LOCAL_DIR, default ./uploads inside the
 * project). Writes go to a temp file first and are renamed into place, so a
 * crash never leaves a half-written file under a real key.
 */
@Injectable()
export class LocalStorageService implements StorageDriver, OnModuleInit {
  readonly name = 'local';
  private readonly logger = new Logger(LocalStorageService.name);
  private readonly root: string;

  constructor(configService: ConfigService) {
    const dir = configService.getOrThrow<string>('storage.localDir');
    this.root = isAbsolute(dir) ? dir : resolve(process.cwd(), dir);
  }

  async onModuleInit(): Promise<void> {
    await mkdir(this.root, { recursive: true });
    this.logger.log({ message: 'Local file storage ready', root: this.root });
  }

  async put(key: string, data: Buffer): Promise<void> {
    const target = this.pathOf(key);
    await mkdir(dirname(target), { recursive: true });
    const temp = `${target}.${generateUuid()}.tmp`;
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
      await access(this.root, constants.W_OK);
      return true;
    } catch {
      return false;
    }
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
