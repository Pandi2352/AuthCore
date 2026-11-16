import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import type { Paginated } from '@common/interfaces/api-response.interface';
import { normalizePagination, paginate } from '@common/utils/pagination.util';
import { buildDateRange } from '@common/utils/query.util';
import { generateUuid } from '@common/utils/uuid.util';

import { SYSTEM_ACTOR } from '../constants/access-control.constants';
import type { AuditEntryDto, AuditQueryDto } from '../dto/access-mapping.dto';
import { AuditAction, AuditEntity } from '../enums/access-control.enum';
import type { Actor } from '../interfaces/actor.interface';
import { AccessAudit } from '../schemas/access-audit.schema';

export interface AuditInput {
  entityType: AuditEntity;
  entityId: string;
  action: AuditAction;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}

/** History of every access-control change. Settings only: never passwords, hashes or tokens. */
@Injectable()
export class AccessAuditService {
  constructor(
    @InjectModel(AccessAudit.name)
    private readonly auditModel: Model<AccessAudit>,
  ) {}

  async record(actor: Actor | null, entries: AuditInput[]): Promise<void> {
    if (entries.length === 0) {
      return;
    }
    await this.auditModel.insertMany(
      entries.map((entry) => ({
        _id: generateUuid(),
        entityType: entry.entityType,
        entityId: entry.entityId,
        action: entry.action,
        changedBy: actor?.auth.userId ?? SYSTEM_ACTOR,
        before: entry.before ?? null,
        after: entry.after ?? null,
        ipAddress: actor?.client.ipAddress ?? null,
        userAgent: actor?.client.userAgent.slice(0, 512) || null,
      })),
    );
  }

  async list(query: AuditQueryDto): Promise<Paginated<AuditEntryDto>> {
    const { page, limit, skip } = normalizePagination(query.page, query.limit);
    const createdAt = buildDateRange('', query.from, query.to);
    const filter = {
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.entityId ? { entityId: query.entityId } : {}),
      ...(query.action ? { action: query.action } : {}),
      ...(query.changedBy ? { changedBy: query.changedBy } : {}),
      ...(createdAt ? { createdAt } : {}),
    };
    const [entries, total] = await Promise.all([
      this.auditModel
        .find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.auditModel.countDocuments(filter),
    ]);
    return paginate(
      entries.map((e) => ({
        id: e._id,
        entityType: e.entityType,
        entityId: e.entityId,
        action: e.action,
        changedBy: e.changedBy,
        before: e.before,
        after: e.after,
        ipAddress: e.ipAddress,
        createdAt: e.createdAt,
      })),
      page,
      limit,
      total,
    );
  }
}
