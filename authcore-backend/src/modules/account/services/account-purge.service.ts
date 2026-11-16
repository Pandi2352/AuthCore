import { randomUUID } from 'node:crypto';

import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { InjectConnection } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';

import { accountConfig, schedulerConfig } from '@config/configuration';
import { UsersService } from '@modules/users/users.service';

import { UserDataCleanupService } from './user-data-cleanup.service';

const JOB = 'ACCOUNT_PURGE';
const LOCK_MS = 10 * 60_000;
const BATCH = 100;

export interface PurgeRunResult {
  isLocked: boolean;
  purgedUserIds: string[];
}

/**
 * Permanently deletes accounts whose self-requested deletion date has
 * passed. Runs every ACCOUNT_PURGE_INTERVAL_MINUTES on every instance; a lock
 * document (job_locks) makes sure only one instance purges at a time.
 */
@Injectable()
export class AccountPurgeService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(AccountPurgeService.name);
  private readonly instanceId = randomUUID();
  private timer: NodeJS.Timeout | null = null;

  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly usersService: UsersService,
    private readonly cleanupService: UserDataCleanupService,
    @Inject(accountConfig.KEY)
    private readonly config: ConfigType<typeof accountConfig>,
    @Inject(schedulerConfig.KEY)
    private readonly scheduler: ConfigType<typeof schedulerConfig>,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.scheduler.isEnabled) {
      return;
    }
    this.timer = setInterval(() => {
      void this.run().catch((error: unknown) => {
        this.logger.error(
          { message: 'Account purge failed' },
          error instanceof Error ? error.stack : undefined,
        );
      });
    }, this.config.purgeIntervalMinutes * 60_000);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  async run(now = new Date()): Promise<PurgeRunResult> {
    if (!(await this.acquireLock(now))) {
      return { isLocked: true, purgedUserIds: [] };
    }
    try {
      const due = await this.usersService.findDueForDeletion(now, BATCH);
      for (const userId of due) {
        await this.cleanupService.purge(
          userId,
          'scheduled_self_deletion',
          'system',
        );
      }
      if (due.length > 0) {
        this.logger.log({
          message: 'Scheduled account deletions completed',
          count: due.length,
        });
      }
      return { isLocked: false, purgedUserIds: due };
    } finally {
      await this.locks().updateOne(
        { _id: JOB, lockedBy: this.instanceId },
        { $set: { lockedUntil: null, lockedBy: null } },
      );
    }
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
      // Upsert raced with an existing, locked document.
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
