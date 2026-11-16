import { randomUUID } from 'node:crypto';

import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import type { Connection, Model } from 'mongoose';

import { schedulerConfig, storageConfig } from '@config/configuration';

import type { OrphanCleanupResultDto } from '../dto/file.dto';
import {
  STORAGE_DRIVER,
  type StorageDriver,
} from '../interfaces/storage-driver.interface';
import { StoredFile } from '../schemas/stored-file.schema';

const JOB = 'FILE_ORPHAN_CLEANUP';
const LOCK_MS = 30 * 60_000;
const BATCH = 500;
const HOUR_MS = 3_600_000;

/**
 * Removes stored bytes that no `files` record points to (a crash between
 * writing a file and saving its record, a delete whose byte removal failed)
 * and stale temp files from interrupted writes. Files younger than
 * FILES_ORPHAN_GRACE_MINUTES are never touched (uploads in progress).
 * Records whose bytes are missing are only reported (logged).
 * Runs every FILES_ORPHAN_CLEANUP_INTERVAL_HOURS on every instance; a lock in
 * job_locks makes sure one instance at a time does the work.
 */
@Injectable()
export class FileOrphanCleanupService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(FileOrphanCleanupService.name);
  private readonly instanceId = randomUUID();
  private timer: NodeJS.Timeout | null = null;

  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(StoredFile.name) private readonly fileModel: Model<StoredFile>,
    @Inject(STORAGE_DRIVER) private readonly storage: StorageDriver,
    @Inject(storageConfig.KEY)
    private readonly config: ConfigType<typeof storageConfig>,
    @Inject(schedulerConfig.KEY)
    private readonly scheduler: ConfigType<typeof schedulerConfig>,
  ) {}

  onApplicationBootstrap(): void {
    const hours = this.config.orphanCleanupIntervalHours;
    if (!this.scheduler.isEnabled || hours === 0) {
      return;
    }
    this.timer = setInterval(() => {
      void this.run().catch((error: unknown) => {
        this.logger.error(
          { message: 'File orphan cleanup failed' },
          error instanceof Error ? error.stack : undefined,
        );
      });
    }, hours * HOUR_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  async run(now = new Date()): Promise<OrphanCleanupResultDto> {
    const result: OrphanCleanupResultDto = {
      isLocked: false,
      scannedCount: 0,
      orphanCount: 0,
      tempCount: 0,
      missingBytesCount: 0,
    };
    if (!(await this.acquireLock(now))) {
      return Object.assign(result, { isLocked: true });
    }
    try {
      const cutoff = now.getTime() - this.config.orphanGraceMinutes * 60_000;
      const onDisk = new Set<string>();
      let batch: string[] = [];
      for await (const entry of this.storage.list()) {
        result.scannedCount++;
        if (entry.isTemp) {
          if (entry.modifiedAt.getTime() < cutoff) {
            await this.storage.delete(entry.key);
            result.tempCount++;
          }
          continue;
        }
        onDisk.add(entry.key);
        if (entry.modifiedAt.getTime() < cutoff) {
          batch.push(entry.key);
        }
        if (batch.length >= BATCH) {
          result.orphanCount += await this.removeUnreferenced(batch);
          batch = [];
        }
      }
      result.orphanCount += await this.removeUnreferenced(batch);
      result.missingBytesCount = await this.countMissingBytes(onDisk);
      if (
        result.orphanCount + result.tempCount + result.missingBytesCount >
        0
      ) {
        this.logger[result.missingBytesCount > 0 ? 'warn' : 'log'](
          Object.assign({ message: 'File orphan cleanup finished' }, result),
        );
      }
      return result;
    } finally {
      await this.locks().updateOne(
        { _id: JOB, lockedBy: this.instanceId },
        { $set: { lockedUntil: null, lockedBy: null } },
      );
    }
  }

  /** Deletes the keys no record points to; returns how many. */
  private async removeUnreferenced(keys: string[]): Promise<number> {
    if (keys.length === 0) {
      return 0;
    }
    const known = new Set(
      (
        await this.fileModel
          .find({ storageKey: { $in: keys } }, { storageKey: 1 })
          .lean()
      ).map((f) => f.storageKey),
    );
    let removed = 0;
    for (const key of keys) {
      if (!known.has(key)) {
        await this.storage.delete(key);
        removed++;
      }
    }
    return removed;
  }

  /** Records of this storage driver whose bytes are not on disk. */
  private async countMissingBytes(onDisk: Set<string>): Promise<number> {
    let missing = 0;
    const cursor = this.fileModel
      .find({ storageDriver: this.storage.name }, { storageKey: 1 })
      .lean()
      .cursor();
    for await (const file of cursor) {
      if (!onDisk.has(file.storageKey)) {
        missing++;
      }
    }
    return missing;
  }

  private async acquireLock(now: Date): Promise<boolean> {
    try {
      const result = await this.locks().updateOne(
        {
          _id: JOB,
          $or: [{ lockedUntil: null }, { lockedUntil: { $lte: now } }],
        },
        {
          $set: {
            lockedUntil: new Date(now.getTime() + LOCK_MS),
            lockedBy: this.instanceId,
          },
        },
        { upsert: true },
      );
      return result.modifiedCount === 1 || result.upsertedCount === 1;
    } catch (error) {
      if ((error as { code?: unknown }).code === 11000) {
        return false;
      }
      throw error;
    }
  }

  private locks() {
    return this.connection.collection<{
      _id: string;
      lockedUntil: Date | null;
      lockedBy: string | null;
    }>('job_locks');
  }
}
