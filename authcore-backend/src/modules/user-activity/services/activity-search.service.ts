import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import type { Paginated } from '@common/interfaces/api-response.interface';
import { normalizePagination, paginate } from '@common/utils/pagination.util';
import { buildDateRange, containsPattern } from '@common/utils/query.util';
import { UsersService } from '@modules/users/users.service';

import {
  type ActivityEventTypeDto,
  type AdminActivityDto,
  type AdminActivityQueryDto,
  LOGIN_HISTORY_EVENTS,
} from '../dto/admin-activity.dto';
import { ActivityEvent } from '../enums/user-activity.enum';
import { UserActivity } from '../schemas/user-activity.schema';

/** Users matched by `search` are capped (narrow the text if more match). */
const MAX_SEARCH_USERS = 500;

/** Admin view over everyone's activity: search, filters, login history. */
@Injectable()
export class ActivitySearchService {
  constructor(
    @InjectModel(UserActivity.name)
    private readonly activityModel: Model<UserActivity>,
    private readonly usersService: UsersService,
  ) {}

  /**
   * `onlyEvents` limits the result to those events (login history); explicit
   * `events` must be within it.
   */
  async search(
    query: AdminActivityQueryDto,
    onlyEvents?: readonly ActivityEvent[],
  ): Promise<Paginated<AdminActivityDto>> {
    const { page, limit, skip } = normalizePagination(query.page, query.limit);
    const userIds = query.search
      ? await this.usersService.findIdsMatching(
          containsPattern(query.search),
          MAX_SEARCH_USERS,
        )
      : null;
    if (userIds?.length === 0) {
      return paginate([], page, limit, 0);
    }
    const events = query.events?.length
      ? query.events.filter((e) => !onlyEvents || onlyEvents.includes(e))
      : onlyEvents;
    const occurredAt = buildDateRange('', query.from, query.to);
    const userFilter = query.userId
      ? userIds && !userIds.includes(query.userId)
        ? { userId: '__none__' }
        : { userId: query.userId }
      : userIds
        ? { userId: { $in: userIds } }
        : {};
    const filter = {
      ...userFilter,
      ...(events ? { event: { $in: [...events] } } : {}),
      ...(query.isSuccess !== undefined ? { isSuccess: query.isSuccess } : {}),
      ...(query.ipAddress ? { ipAddress: query.ipAddress } : {}),
      ...(query.deviceType ? { deviceType: query.deviceType } : {}),
      ...(query.browser ? { browser: containsPattern(query.browser) } : {}),
      ...(occurredAt ? { createdAt: occurredAt } : {}),
    };
    const direction = query.sortOrder === 'asc' ? 1 : -1;
    const [items, total] = await Promise.all([
      this.activityModel
        .find(filter)
        .sort({ createdAt: direction, _id: direction })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.activityModel.countDocuments(filter),
    ]);
    const users = new Map(
      (
        await this.usersService.findManyByIds([
          ...new Set(items.map((a) => a.userId)),
        ])
      ).map((u) => [u.id, u]),
    );
    return paginate(
      items.map((a) => {
        const user = users.get(a.userId);
        return {
          id: a._id,
          userId: a.userId,
          user: user
            ? {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
              }
            : null,
          event: a.event,
          verificationType: a.verificationType,
          isSuccess: a.isSuccess,
          occurredAt: a.createdAt,
          deviceType: a.deviceType,
          os: a.os,
          browser: a.browser,
          ipAddress: a.ipAddress,
          sessionId: a.sessionId,
          actorId: a.actorId,
          details: a.details,
        };
      }),
      page,
      limit,
      total,
    );
  }

  eventTypes(): ActivityEventTypeDto[] {
    return Object.values(ActivityEvent).map((value) => ({
      value,
      label: humanize(value),
      isLoginEvent: LOGIN_HISTORY_EVENTS.includes(value),
    }));
  }
}

function humanize(value: string): string {
  const words = value.toLowerCase().split('_').join(' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}
