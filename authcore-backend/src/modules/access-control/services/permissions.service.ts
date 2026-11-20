import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import type { DropdownOptionDto } from '@common/dto/dropdown.dto';
import type { ExistsResponseDto } from '@common/dto/exists.dto';
import { ValidationException } from '@common/exceptions/validation.exception';
import type { Paginated } from '@common/interfaces/api-response.interface';
import { paginate } from '@common/utils/pagination.util';
import {
  buildDateRange,
  buildSort,
  containsPattern,
  escapeRegex,
} from '@common/utils/query.util';
import { generateUuid } from '@common/utils/uuid.util';
import {
  assertUnique,
  CASE_INSENSITIVE,
  findConflicts,
  type UniqueRule,
} from '@database/utils/unique-check.util';

import { PERMISSION_ACTIONS } from '../constants/access-control.constants';
import {
  type CreatePermissionDto,
  PERMISSION_SORT_FIELDS,
  type PermissionDropdownQueryDto,
  type PermissionExistsQueryDto,
  type PermissionListItemDto,
  type PermissionListQueryDto,
  type PermissionMetadataDto,
  type PermissionResponseDto,
  type UpdatePermissionDto,
} from '../dto/permission.dto';
import type { DeletedResponseDto } from '../dto/role.dto';
import {
  AuditAction,
  AuditEntity,
  MappingType,
  RecordStatus,
} from '../enums/access-control.enum';
import type { Actor } from '../interfaces/actor.interface';
import { AccessMapping } from '../schemas/access-mapping.schema';
import {
  Permission,
  type PermissionMetadata,
} from '../schemas/permission.schema';
import { AccessErrors, changedValues } from '../utils/access-errors.util';
import { AccessAuditService } from './access-audit.service';
import { AccessResolverService } from './access-resolver.service';

const ENTITY = 'Permission';

@Injectable()
export class PermissionsService {
  private readonly logger = new Logger(PermissionsService.name);

  constructor(
    @InjectModel(Permission.name)
    private readonly permissionModel: Model<Permission>,
    @InjectModel(AccessMapping.name)
    private readonly mappingModel: Model<AccessMapping>,
    private readonly auditService: AccessAuditService,
    private readonly resolver: AccessResolverService,
  ) {}

  async create(
    dto: CreatePermissionDto,
    actor: Actor,
  ): Promise<PermissionResponseDto> {
    const metadata = normalizeMetadata(dto.metadata ?? []);
    await this.assertUniqueFields(dto.permissionKey, dto.permissionName);
    const permission = await this.permissionModel.create({
      _id: generateUuid(),
      permissionKey: dto.permissionKey,
      permissionName: dto.permissionName,
      description: dto.description ?? '',
      metadata,
      status: dto.status ?? RecordStatus.Active,
      createdBy: actor.auth.userId,
      updatedBy: actor.auth.userId,
    });
    await this.auditService.record(actor, [
      {
        entityType: AuditEntity.Permission,
        entityId: permission._id,
        action: AuditAction.Create,
        after: auditView(permission),
      },
    ]);
    this.logger.log({
      message: 'Permission created',
      permissionId: permission._id,
      permissionKey: permission.permissionKey,
      userId: actor.auth.userId,
    });
    return this.get(permission._id);
  }

  async list(
    query: PermissionListQueryDto,
  ): Promise<Paginated<PermissionListItemDto>> {
    const isPaginated = query.page !== undefined || query.limit !== undefined;
    const { page, limit, skip } = isPaginated
      ? {
          page: Math.max(1, Math.floor(query.page ?? 1)),
          limit: Math.max(1, Math.floor(query.limit ?? 100)),
          skip:
            (Math.max(1, Math.floor(query.page ?? 1)) - 1) *
            Math.max(1, Math.floor(query.limit ?? 100)),
        }
      : { page: 1, limit: 0, skip: 0 };
    const createdAt = buildDateRange(
      'created',
      query.createdFrom,
      query.createdTo,
    );
    const updatedAt = buildDateRange(
      'updated',
      query.updatedFrom,
      query.updatedTo,
    );
    const search = query.search ? containsPattern(query.search) : null;
    const metadataMatch = {
      ...(query.metadataKey ? { key: query.metadataKey } : {}),
      ...(query.metadataValue
        ? { value: new RegExp(`^${escapeRegex(query.metadataValue)}$`, 'i') }
        : {}),
      ...(query.action ? { action: query.action } : {}),
    };
    const filter = {
      isDeleted: false,
      ...(search
        ? {
            $or: [
              { permissionKey: search },
              { permissionName: search },
              { description: search },
            ],
          }
        : {}),
      ...(Object.keys(metadataMatch).length
        ? { metadata: { $elemMatch: metadataMatch } }
        : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(createdAt ? { createdAt } : {}),
      ...(updatedAt ? { updatedAt } : {}),
    };
    let cursor = this.permissionModel
      .find(filter)
      .collation(CASE_INSENSITIVE)
      .sort(
        buildSort(
          query.sortBy,
          query.sortOrder,
          PERMISSION_SORT_FIELDS,
          'updatedAt',
        ),
      );

    if (isPaginated && limit > 0) {
      cursor = cursor.skip(skip).limit(limit);
    }

    const [permissions, total] = await Promise.all([
      cursor.lean(),
      this.permissionModel.countDocuments(filter),
    ]);
    return paginate(
      permissions.map(toListItem),
      page,
      isPaginated && limit > 0 ? limit : total || 1,
      total,
    );
  }

  async dropdown(
    query: PermissionDropdownQueryDto,
  ): Promise<DropdownOptionDto[]> {
    const search = query.search ? containsPattern(query.search) : null;
    const metadataMatch = {
      ...(query.action ? { action: query.action } : {}),
      ...(query.module
        ? {
            key: 'module',
            value: new RegExp(`^${escapeRegex(query.module)}$`, 'i'),
          }
        : {}),
    };
    const permissions = await this.permissionModel
      .find(
        {
          isDeleted: false,
          status: RecordStatus.Active,
          ...(search
            ? { $or: [{ permissionName: search }, { permissionKey: search }] }
            : {}),
          ...(Object.keys(metadataMatch).length
            ? { metadata: { $elemMatch: metadataMatch } }
            : {}),
        },
        { permissionName: 1, permissionKey: 1 },
      )
      .collation(CASE_INSENSITIVE)
      .sort({ permissionName: 1 })
      .lean();
    return permissions.map((p) => ({
      id: p._id,
      label: p.permissionName,
      key: p.permissionKey,
    }));
  }

  actions() {
    return PERMISSION_ACTIONS.map((a) => ({ ...a }));
  }

  async get(id: string): Promise<PermissionResponseDto> {
    const permission = await this.findOrThrow(id);
    const roleCount = await this.mappingModel.countDocuments({
      type: MappingType.RolePermission,
      permissionId: id,
    });
    return Object.assign(toResponse(permission), { roleCount });
  }

  async update(
    id: string,
    dto: UpdatePermissionDto,
    actor: Actor,
  ): Promise<PermissionResponseDto> {
    const permission = await this.findOrThrow(id);
    if (permission.isSystem) {
      throw AccessErrors.systemProtected(ENTITY);
    }
    if (dto.version !== undefined && dto.version !== permission.version) {
      throw AccessErrors.versionConflict(ENTITY);
    }
    const next = {
      permissionKey: dto.permissionKey ?? permission.permissionKey,
      permissionName: dto.permissionName ?? permission.permissionName,
      description: dto.description ?? permission.description,
      metadata: dto.metadata
        ? normalizeMetadata(dto.metadata)
        : permission.metadata,
      status: dto.status ?? permission.status,
    };
    const diff = changedValues(auditView(permission), next);
    if (Object.keys(diff.after).length === 0) {
      return this.get(id);
    }
    await this.assertUniqueFields(next.permissionKey, next.permissionName, id);

    const result = await this.permissionModel.updateOne(
      { _id: id, isDeleted: false, version: permission.version },
      { $set: { ...next, updatedBy: actor.auth.userId }, $inc: { version: 1 } },
    );
    if (result.modifiedCount === 0) {
      throw AccessErrors.versionConflict(ENTITY);
    }
    // Key or status changes alter what roles grant.
    if ('status' in diff.after || 'permissionKey' in diff.after) {
      this.resolver.invalidate();
    }
    await this.auditService.record(actor, [
      {
        entityType: AuditEntity.Permission,
        entityId: id,
        action: AuditAction.Update,
        ...diff,
      },
    ]);
    this.logger.log({
      message: 'Permission updated',
      permissionId: id,
      changedFields: Object.keys(diff.after),
      userId: actor.auth.userId,
    });
    return this.get(id);
  }

  /** Soft delete; blocked while any role has the permission. */
  async remove(id: string, actor: Actor): Promise<DeletedResponseDto> {
    const permission = await this.findOrThrow(id);
    if (permission.isSystem) {
      throw AccessErrors.systemProtected(ENTITY);
    }
    const roleCount = await this.mappingModel.countDocuments({
      type: MappingType.RolePermission,
      permissionId: id,
    });
    if (roleCount > 0) {
      throw AccessErrors.inUse(
        `This permission is assigned to ${String(roleCount)} role(s). Remove it from those roles first.`,
        [
          {
            field: 'roles',
            message: `assigned to ${String(roleCount)} role(s)`,
          },
        ],
      );
    }
    const deletedAt = new Date();
    const result = await this.permissionModel.updateOne(
      { _id: id, isDeleted: false },
      {
        $set: {
          isDeleted: true,
          deletedAt,
          deletedBy: actor.auth.userId,
          updatedBy: actor.auth.userId,
        },
        $inc: { version: 1 },
      },
    );
    if (result.modifiedCount === 0) {
      throw AccessErrors.notFound(ENTITY);
    }
    await this.auditService.record(actor, [
      {
        entityType: AuditEntity.Permission,
        entityId: id,
        action: AuditAction.Delete,
        before: auditView(permission),
      },
    ]);
    this.logger.log({
      message: 'Permission deleted',
      permissionId: id,
      permissionKey: permission.permissionKey,
      userId: actor.auth.userId,
    });
    return { id, deletedAt };
  }

  /** Live form check: which of the given key / name are already taken. */
  async exists(query: PermissionExistsQueryDto): Promise<ExistsResponseDto> {
    const rules: UniqueRule[] = [];
    if (query.permissionKey) {
      rules.push({
        field: 'permissionKey',
        filter: { permissionKey: query.permissionKey, isDeleted: false },
        message: `Permission key ${query.permissionKey} already exists`,
      });
    }
    if (query.permissionName) {
      rules.push({
        field: 'permissionName',
        filter: { permissionName: query.permissionName, isDeleted: false },
        message: `A permission named "${query.permissionName}" already exists`,
        isCaseInsensitive: true,
      });
    }
    if (rules.length === 0) {
      throw new ValidationException([
        {
          field: 'permissionKey',
          message: 'Send permissionKey and / or permissionName to check',
        },
      ]);
    }
    const conflicts = await findConflicts(
      this.permissionModel,
      rules,
      query.excludeId,
    );
    return { exists: conflicts.length > 0, conflicts };
  }

  async findOrThrow(id: string): Promise<Permission> {
    const permission = await this.permissionModel
      .findOne({ _id: id, isDeleted: false })
      .lean();
    if (!permission) {
      throw AccessErrors.notFound(ENTITY);
    }
    return permission;
  }

  private assertUniqueFields(
    permissionKey: string,
    permissionName: string,
    excludeId?: string,
  ) {
    return assertUnique(
      this.permissionModel,
      [
        {
          field: 'permissionKey',
          filter: { permissionKey, isDeleted: false },
          message: `Permission key ${permissionKey} already exists`,
        },
        {
          field: 'permissionName',
          filter: { permissionName, isDeleted: false },
          message: `A permission named "${permissionName}" already exists`,
          isCaseInsensitive: true,
        },
      ],
      excludeId,
    );
  }
}

/** Plain objects in input order; duplicate keys (case-insensitive) → 400. */
function normalizeMetadata(
  items: PermissionMetadataDto[],
): PermissionMetadata[] {
  const seen = new Map<string, number>();
  const errors: { field: string; message: string }[] = [];
  items.forEach((item, index) => {
    const key = item.key.toLowerCase();
    const first = seen.get(key);
    if (first !== undefined) {
      errors.push({
        field: `metadata.${String(index)}.key`,
        message: `metadata key "${item.key}" is repeated (also at position ${String(first)})`,
      });
    } else {
      seen.set(key, index);
    }
  });
  if (errors.length > 0) {
    throw new ValidationException(errors);
  }
  return items.map((item) => ({
    key: item.key,
    value: item.value,
    action: item.action,
  }));
}

function auditView(p: Permission): Record<string, unknown> {
  return {
    permissionKey: p.permissionKey,
    permissionName: p.permissionName,
    description: p.description,
    metadata: p.metadata,
    status: p.status,
  };
}

function toListItem(p: Permission): PermissionListItemDto {
  return {
    id: p._id,
    permissionKey: p.permissionKey,
    permissionName: p.permissionName,
    description: p.description,
    metadata: p.metadata.map((m) => ({
      key: m.key,
      value: m.value,
      action: m.action,
    })),
    status: p.status,
    isSystem: p.isSystem,
    updatedAt: p.updatedAt,
  };
}

function toResponse(p: Permission): PermissionResponseDto {
  return Object.assign(toListItem(p), {
    version: p.version,
    createdBy: p.createdBy,
    updatedBy: p.updatedBy,
    createdAt: p.createdAt,
  });
}
