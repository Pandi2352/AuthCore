import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import type { Paginated } from '@common/interfaces/api-response.interface';
import type { ClientInfo } from '@common/interfaces/client-info.interface';
import { normalizePagination, paginate } from '@common/utils/pagination.util';
import { generateUuid } from '@common/utils/uuid.util';
import { accountConfig } from '@config/configuration';
import { parseDeviceInfo } from '@modules/sessions/utils/device-info.util';

import type {
  ActivityQueryDto,
  UserActivityDto,
} from './dto/user-activity.dto';
import {
  type ActivityEvent,
  VerificationType,
} from './enums/user-activity.enum';
import { UserActivity } from './schemas/user-activity.schema';

const DAY_MS = 86_400_000;

export interface ActivityInput {
  userId: string;
  event: ActivityEvent;
  client: ClientInfo;
  verificationType?: VerificationType;
  isSuccess?: boolean;
  sessionId?: string | null;
  actorId?: string | null;
  details?: Record<string, unknown> | null;
}

/**
 * Account activity history ("recent user activities"). Recording never
 * fails the request that triggered it: errors are logged and swallowed.
 */
@Injectable()
export class UserActivityService {
  private readonly logger = new Logger(UserActivityService.name);

  constructor(
    @InjectModel(UserActivity.name)
    private readonly activityModel: Model<UserActivity>,
    @Inject(accountConfig.KEY)
    private readonly config: ConfigType<typeof accountConfig>,
  ) {}

  async record(input: ActivityInput): Promise<void> {
    try {
      const device = parseDeviceInfo(input.client.userAgent);
      await this.activityModel.create({
        _id: generateUuid(),
        userId: input.userId,
        event: input.event,
        verificationType: input.verificationType ?? VerificationType.None,
        isSuccess: input.isSuccess ?? true,
        ipAddress: input.client.ipAddress,
        deviceType: device.deviceType,
        browser: device.browser,
        os: device.os,
        deviceName: device.deviceName,
        sessionId: input.sessionId ?? null,
        actorId: input.actorId ?? null,
        details: input.details ?? null,
        expiresAt: new Date(
          Date.now() + this.config.activityRetentionDays * DAY_MS,
        ),
      });
    } catch (error) {
      this.logger.error(
        {
          message: 'User activity could not be recorded',
          userId: input.userId,
          event: input.event,
        },
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  async list(
    userId: string,
    query: ActivityQueryDto,
  ): Promise<Paginated<UserActivityDto>> {
    const { page, limit, skip } = normalizePagination(query.page, query.limit);
    const filter = { userId, ...(query.event ? { event: query.event } : {}) };
    const [items, total] = await Promise.all([
      this.activityModel
        .find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.activityModel.countDocuments(filter),
    ]);
    return paginate(
      items.map((a) => ({
        id: a._id,
        event: a.event,
        verificationType: a.verificationType,
        isSuccess: a.isSuccess,
        occurredAt: a.createdAt,
        deviceType: a.deviceType,
        os: a.os,
        browser: a.browser,
        ipAddress: a.ipAddress,
        actorId: a.actorId,
        details: a.details,
      })),
      page,
      limit,
      total,
    );
  }

  /** Time of the user's latest recorded activity, or null. */
  async lastActivityAt(userId: string): Promise<Date | null> {
    const latest = await this.activityModel
      .findOne({ userId, isSuccess: true }, { createdAt: 1 })
      .sort({ createdAt: -1 })
      .lean();
    return latest?.createdAt ?? null;
  }
}
