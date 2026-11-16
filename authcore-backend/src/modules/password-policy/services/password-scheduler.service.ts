import { randomUUID } from 'node:crypto';

import {
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { ErrorCode } from '@common/constants/error-codes.constants';
import { AppException } from '@common/exceptions/app.exception';
import type { AuthContext } from '@common/interfaces/auth-context.interface';
import type { ClientInfo } from '@common/interfaces/client-info.interface';
import { schedulerConfig } from '@config/configuration';

import type {
  SchedulerRunResponseDto,
  SchedulerSettingsDto,
  SchedulersResponseDto,
  SchedulerStateDto,
  UpdateSchedulersDto,
} from '../dto/scheduler.dto';
import {
  SchedulerExecutionStatus,
  SchedulerFrequency,
  SchedulerJob,
} from '../enums/scheduler.enum';
import { SchedulerConfig } from '../schemas/scheduler-config.schema';
import { computeNextExecution, isValidTimeZone } from '../utils/schedule.util';
import { PasswordExpiryNotificationService } from './password-expiry-notification.service';
import { PolicyAuditService } from './policy-audit.service';

const LOCK_MS = 10 * 60_000;
/** A failed run is retried this long after the failure (if the job is still enabled). */
const RETRY_AFTER_MS = 15 * 60_000;

const DEFAULT_SETTINGS: Required<SchedulerSettingsDto> = {
  enabled: false,
  frequency: SchedulerFrequency.Daily,
  executionTime: '09:00',
  timezone: 'UTC',
  dayOfWeek: 1,
  dayOfMonth: 1,
};

/**
 * Runs scheduled password jobs. Every instance polls the job documents; a
 * due job is claimed with an atomic update (lockedUntil / lockedBy), so it
 * runs on exactly one instance even with several replicas. Schedules are
 * read from the database each poll: changes apply without a restart.
 */
@Injectable()
export class PasswordSchedulerService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(PasswordSchedulerService.name);
  private readonly instanceId = randomUUID();
  private timer: NodeJS.Timeout | null = null;
  private readonly jobs: Record<
    SchedulerJob,
    () => Promise<Record<string, number | string>>
  >;

  constructor(
    @InjectModel(SchedulerConfig.name)
    private readonly configModel: Model<SchedulerConfig>,
    private readonly expiryNotificationService: PasswordExpiryNotificationService,
    private readonly policyAuditService: PolicyAuditService,
    @Inject(schedulerConfig.KEY)
    private readonly config: ConfigType<typeof schedulerConfig>,
  ) {
    this.jobs = {
      [SchedulerJob.PasswordExpiryNotification]: () =>
        this.expiryNotificationService.run(),
    };
  }

  onApplicationBootstrap(): void {
    if (!this.config.isEnabled) {
      return;
    }
    // The first poll waits one interval, so short-lived CLI contexts never run jobs.
    this.timer = setInterval(() => {
      void this.runDueJobs();
    }, this.config.pollSeconds * 1000);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  async getAll(): Promise<SchedulersResponseDto> {
    return {
      passwordExpiryNotification: toState(
        await this.findOrDefault(SchedulerJob.PasswordExpiryNotification),
      ),
    };
  }

  async update(
    dto: UpdateSchedulersDto,
    actor: AuthContext,
    client: ClientInfo,
  ): Promise<SchedulersResponseDto> {
    await this.updateJob(
      SchedulerJob.PasswordExpiryNotification,
      dto.passwordExpiryNotification,
      actor,
      client,
    );
    return this.getAll();
  }

  /** Runs a job now (admin), regardless of its schedule or enabled flag. */
  async runNow(
    job: SchedulerJob,
    actor: AuthContext,
  ): Promise<SchedulerRunResponseDto> {
    await this.findOrDefault(job, true);
    const claimed = await this.claim({ job }, new Date());
    if (!claimed) {
      throw new AppException(
        HttpStatus.CONFLICT,
        ErrorCode.Conflict,
        'This job is already running. Try again later.',
      );
    }
    this.logger.log({
      message: 'Scheduled job started manually',
      job,
      userId: actor.userId,
    });
    return this.execute(claimed);
  }

  /** One poll: run every due, enabled job this instance can claim. */
  async runDueJobs(): Promise<void> {
    const now = new Date();
    for (const job of Object.values(SchedulerJob)) {
      const claimed = await this.claim(
        { job, enabled: true, nextExecutionAt: { $lte: now } },
        now,
      ).catch((error: unknown) => {
        this.logger.error(
          { message: 'Scheduler poll failed', job },
          error instanceof Error ? error.stack : undefined,
        );
        return null;
      });
      if (claimed) {
        await this.execute(claimed);
      }
    }
  }

  private async updateJob(
    job: SchedulerJob,
    settings: SchedulerSettingsDto,
    actor: AuthContext,
    client: ClientInfo,
  ): Promise<void> {
    if (!isValidTimeZone(settings.timezone)) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.ValidationFailed,
        'Invalid scheduler configuration',
        [
          {
            field: 'passwordExpiryNotification.timezone',
            message:
              'timezone must be a valid IANA time zone, e.g. Asia/Kolkata',
          },
        ],
      );
    }
    const next: Required<SchedulerSettingsDto> = {
      enabled: settings.enabled,
      frequency: settings.frequency,
      executionTime: settings.executionTime,
      timezone: settings.timezone,
      dayOfWeek: settings.dayOfWeek ?? DEFAULT_SETTINGS.dayOfWeek,
      dayOfMonth: settings.dayOfMonth ?? DEFAULT_SETTINGS.dayOfMonth,
    };
    const previous = await this.configModel
      .findOneAndUpdate(
        { job },
        {
          $set: {
            ...next,
            nextExecutionAt: next.enabled
              ? computeNextExecution(new Date(), next)
              : null,
            updatedBy: actor.userId,
          },
        },
        { upsert: true, new: false },
      )
      .lean();
    const changedFields = await this.policyAuditService.record({
      target: `scheduler:${job}`,
      changedBy: actor.userId,
      oldValues: previous ? settingsOf(previous) : null,
      newValues: next,
      version: null,
      client,
    });
    this.logger.log({
      message: 'Scheduler configuration updated',
      job,
      userId: actor.userId,
      changedFields,
    });
  }

  /** Atomically takes the job's lock if nobody holds it. */
  private async claim(
    filter: Record<string, unknown>,
    now: Date,
  ): Promise<SchedulerConfig | null> {
    return this.configModel
      .findOneAndUpdate(
        {
          ...filter,
          $or: [{ lockedUntil: null }, { lockedUntil: { $lte: now } }],
        },
        {
          $set: {
            lockedUntil: new Date(now.getTime() + LOCK_MS),
            lockedBy: this.instanceId,
            lastExecutionStatus: SchedulerExecutionStatus.Running,
          },
        },
        { new: true },
      )
      .lean();
  }

  private async execute(
    config: SchedulerConfig,
  ): Promise<SchedulerRunResponseDto> {
    const startedAt = new Date();
    let status = SchedulerExecutionStatus.Success;
    let summary: Record<string, number | string>;
    try {
      summary = await this.jobs[config.job]();
    } catch (error) {
      status = SchedulerExecutionStatus.Failed;
      // Internal details go to the log, not to API clients.
      summary = { error: 'Execution failed. See the server logs.' };
      this.logger.error(
        { message: 'Scheduled job failed', job: config.job },
        error instanceof Error ? error.stack : undefined,
      );
    }

    const finishedAt = new Date();
    const nextExecutionAt = !config.enabled
      ? null
      : status === SchedulerExecutionStatus.Failed
        ? new Date(finishedAt.getTime() + RETRY_AFTER_MS)
        : computeNextExecution(finishedAt, config);
    await this.configModel.updateOne(
      { _id: config._id, lockedBy: this.instanceId },
      {
        $set: {
          lastExecutedAt: startedAt,
          lastExecutionStatus: status,
          lastExecutionSummary: summary,
          nextExecutionAt,
          lockedUntil: null,
          lockedBy: null,
        },
      },
    );
    this.logger.log({
      message: 'Scheduled job finished',
      job: config.job,
      status,
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      ...summary,
    });
    return { status, summary };
  }

  private async findOrDefault(
    job: SchedulerJob,
    shouldCreate = false,
  ): Promise<SchedulerConfig> {
    const existing = await this.configModel.findOne({ job }).lean();
    if (existing || !shouldCreate) {
      return (
        existing ??
        ({
          job,
          ...DEFAULT_SETTINGS,
          ...EMPTY_STATE,
        } as unknown as SchedulerConfig)
      );
    }
    await this.configModel.updateOne(
      { job },
      { $setOnInsert: { job, ...DEFAULT_SETTINGS, updatedBy: 'system' } },
      { upsert: true },
    );
    return (await this.configModel.findOne({ job }).lean()) as SchedulerConfig;
  }
}

const EMPTY_STATE = {
  lastExecutedAt: null,
  nextExecutionAt: null,
  lastExecutionStatus: SchedulerExecutionStatus.Never,
  lastExecutionSummary: null,
};

function settingsOf(config: SchedulerConfig): Record<string, unknown> {
  return {
    enabled: config.enabled,
    frequency: config.frequency,
    executionTime: config.executionTime,
    timezone: config.timezone,
    dayOfWeek: config.dayOfWeek,
    dayOfMonth: config.dayOfMonth,
  };
}

function toState(config: SchedulerConfig): SchedulerStateDto {
  return {
    enabled: config.enabled,
    frequency: config.frequency,
    executionTime: config.executionTime,
    timezone: config.timezone,
    dayOfWeek: config.dayOfWeek,
    dayOfMonth: config.dayOfMonth,
    lastExecutedAt: config.lastExecutedAt,
    nextExecutionAt: config.nextExecutionAt,
    lastExecutionStatus: config.lastExecutionStatus,
    lastExecutionSummary: config.lastExecutionSummary,
  };
}
