import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import type { Paginated } from '@common/interfaces/api-response.interface';
import type { ClientInfo } from '@common/interfaces/client-info.interface';
import { normalizePagination, paginate } from '@common/utils/pagination.util';

import type { PolicyAuditEntryDto } from '../dto/password-policy.dto';
import { PolicyAuditAction } from '../enums/scheduler.enum';
import { PasswordPolicyAudit } from '../schemas/password-policy-audit.schema';

type Values = Record<string, unknown>;

/** Audit trail of password-policy and scheduler changes (settings only, never secrets). */
@Injectable()
export class PolicyAuditService {
  constructor(
    @InjectModel(PasswordPolicyAudit.name)
    private readonly auditModel: Model<PasswordPolicyAudit>,
  ) {}

  async record(input: {
    target: string;
    changedBy: string;
    oldValues: Values | null;
    newValues: Values;
    version: number | null;
    client: ClientInfo;
  }): Promise<string[]> {
    const changedFields = diffPaths(input.oldValues ?? {}, input.newValues);
    await this.auditModel.create({
      target: input.target,
      action: input.oldValues
        ? PolicyAuditAction.Update
        : PolicyAuditAction.Create,
      changedBy: input.changedBy,
      changedFields,
      oldValues: input.oldValues,
      newValues: input.newValues,
      version: input.version,
      ipAddress: input.client.ipAddress,
      userAgent: input.client.userAgent.slice(0, 512) || null,
    });
    return changedFields;
  }

  async list(
    page: number,
    limit: number,
  ): Promise<Paginated<PolicyAuditEntryDto>> {
    const pagination = normalizePagination(page, limit);
    const [entries, total] = await Promise.all([
      this.auditModel
        .find()
        .sort({ createdAt: -1, _id: -1 })
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean(),
      this.auditModel.countDocuments(),
    ]);
    return paginate(
      entries.map((entry) => ({
        id: entry._id,
        target: entry.target,
        action: entry.action,
        changedBy: entry.changedBy,
        changedFields: entry.changedFields,
        oldValues: entry.oldValues,
        newValues: entry.newValues,
        version: entry.version,
        ipAddress: entry.ipAddress,
        createdAt: entry.createdAt,
      })),
      pagination.page,
      pagination.limit,
      total,
    );
  }
}

/** Dot paths whose values differ, e.g. ["characterLength.minimum"]. */
function diffPaths(before: Values, after: Values, prefix = ''): string[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys].flatMap((key) => {
    const path = prefix ? `${prefix}.${key}` : key;
    const a = before[key];
    const b = after[key];
    if (isPlainObject(a) && isPlainObject(b)) {
      return diffPaths(a, b, path);
    }
    return JSON.stringify(a) === JSON.stringify(b) ? [] : [path];
  });
}

function isPlainObject(value: unknown): value is Values {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
