import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { ErrorCode } from '@common/constants/error-codes.constants';
import type { DropdownOptionDto } from '@common/dto/dropdown.dto';
import type { ExistsResponseDto } from '@common/dto/exists.dto';
import { AppException } from '@common/exceptions/app.exception';
import { ValidationException } from '@common/exceptions/validation.exception';
import type { Paginated } from '@common/interfaces/api-response.interface';
import { normalizePagination, paginate } from '@common/utils/pagination.util';
import {
  buildDateRange,
  buildSort,
  containsPattern,
} from '@common/utils/query.util';
import {
  nextSequenceCode,
  toCodeValue,
} from '@common/utils/sequence-code.util';
import { generateUuid } from '@common/utils/uuid.util';
import {
  assertUnique,
  CASE_INSENSITIVE,
  findConflicts,
  type UniqueRule,
} from '@database/utils/unique-check.util';

import {
  CATEGORY_VALUE_PATTERN,
  ROLE_CATEGORIES,
  ROLE_KEY_PREFIX,
  SYSTEM_ROLE_CATEGORY,
} from '../constants/access-control.constants';
import {
  type BulkUpdateRolesDto,
  type BulkUpdateRolesResponseDto,
  type CreateRoleDto,
  type DeletedResponseDto,
  type NextRoleKeyDto,
  ROLE_SORT_FIELDS,
  type RoleCategoryDto,
  type RoleDropdownQueryDto,
  type RoleExistsQueryDto,
  type RoleListItemDto,
  type RoleListQueryDto,
  type RoleResponseDto,
  type RoleStatsDto,
  type UpdateRoleDto,
} from '../dto/role.dto';
import {
  AuditAction,
  AuditEntity,
  MappingType,
  RecordStatus,
} from '../enums/access-control.enum';
import type { Actor } from '../interfaces/actor.interface';
import { AccessMapping } from '../schemas/access-mapping.schema';
import { Permission } from '../schemas/permission.schema';
import { Role } from '../schemas/role.schema';
import { RoleCategory } from '../schemas/role-category.schema';
import { AccessErrors, changedValues } from '../utils/access-errors.util';
import { AccessAuditService } from './access-audit.service';
import { AccessResolverService } from './access-resolver.service';

const ENTITY = 'Role';

@Injectable()
export class RolesService {
  private readonly logger = new Logger(RolesService.name);

  constructor(
    @InjectModel(Role.name) private readonly roleModel: Model<Role>,
    @InjectModel(AccessMapping.name)
    private readonly mappingModel: Model<AccessMapping>,
    @InjectModel(RoleCategory.name)
    private readonly categoryModel: Model<RoleCategory>,
    @InjectModel(Permission.name)
    private readonly permissionModel: Model<Permission>,
    private readonly auditService: AccessAuditService,
    private readonly resolver: AccessResolverService,
  ) {}

  async create(dto: CreateRoleDto, actor: Actor): Promise<RoleResponseDto> {
    await this.assertUniqueFields(dto.roleKey, dto.roleName, dto.category);
    const role = await this.roleModel.create({
      _id: generateUuid(),
      roleKey: dto.roleKey,
      roleName: dto.roleName,
      category: dto.category,
      description: dto.description ?? '',
      // Roles are always in effect (status stays ACTIVE).
      status: RecordStatus.Active,
      createdBy: actor.auth.userId,
      updatedBy: actor.auth.userId,
    });
    await this.auditService.record(actor, [
      {
        entityType: AuditEntity.Role,
        entityId: role._id,
        action: AuditAction.Create,
        after: auditView(role),
      },
    ]);
    this.logger.log({
      message: 'Role created',
      roleId: role._id,
      roleKey: role.roleKey,
      userId: actor.auth.userId,
    });
    return this.get(role._id);
  }

  async list(query: RoleListQueryDto): Promise<Paginated<RoleListItemDto>> {
    const { page, limit, skip } = normalizePagination(query.page, query.limit);
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
    const filter = {
      isDeleted: false,
      ...(search
        ? {
            $or: [
              { roleKey: search },
              { roleName: search },
              { description: search },
            ],
          }
        : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(createdAt ? { createdAt } : {}),
      ...(updatedAt ? { updatedAt } : {}),
    };
    const [roles, total] = await Promise.all([
      this.roleModel
        .find(filter)
        .collation(CASE_INSENSITIVE)
        .sort(
          buildSort(
            query.sortBy,
            query.sortOrder,
            ROLE_SORT_FIELDS,
            'updatedAt',
          ),
        )
        .skip(skip)
        .limit(limit)
        .lean(),
      this.roleModel.countDocuments(filter),
    ]);
    // Permission counts for this page in one query (no request per row).
    const counts = await this.mappingModel.aggregate<{
      _id: string;
      n: number;
    }>([
      {
        $match: {
          type: MappingType.RolePermission,
          roleId: { $in: roles.map((r) => r._id) },
        },
      },
      { $group: { _id: '$roleId', n: { $sum: 1 } } },
    ]);
    const countOf = new Map(counts.map((c) => [c._id, c.n]));
    return paginate(
      roles.map((r) =>
        Object.assign(toListItem(r), {
          permissionCount: countOf.get(r._id) ?? 0,
        }),
      ),
      page,
      limit,
      total,
    );
  }

  /** Active roles for selects: id + name (+ key). */
  async dropdown(query: RoleDropdownQueryDto): Promise<DropdownOptionDto[]> {
    const search = query.search ? containsPattern(query.search) : null;
    const roles = await this.roleModel
      .find(
        {
          isDeleted: false,
          status: RecordStatus.Active,
          ...(query.category ? { category: query.category } : {}),
          ...(search
            ? { $or: [{ roleName: search }, { roleKey: search }] }
            : {}),
        },
        { roleName: 1, roleKey: 1 },
      )
      .collation(CASE_INSENSITIVE)
      .sort({ roleName: 1 })
      .lean();
    return roles.map((r) => ({ id: r._id, label: r.roleName, key: r.roleKey }));
  }

  /** Built-in categories, then the ones admins added (by label). */
  async categories(): Promise<RoleCategoryDto[]> {
    const custom = await this.categoryModel.find().sort({ label: 1 }).lean();
    return [
      ...ROLE_CATEGORIES.map((c) => ({
        value: c.value,
        label: c.label,
        isReserved: c.value === SYSTEM_ROLE_CATEGORY,
        isCustom: false,
      })),
      ...custom.map((c) => ({
        value: c.value,
        label: c.label,
        isReserved: false,
        isCustom: true,
      })),
    ];
  }

  /** Add a category (or return the existing one with the same value). */
  async createCategory(label: string, actor: Actor): Promise<RoleCategoryDto> {
    const value = toCodeValue(label);
    if (!CATEGORY_VALUE_PATTERN.test(value)) {
      throw new ValidationException([
        {
          field: 'label',
          message: 'Use at least two letters or digits, starting with a letter',
        },
      ]);
    }
    const builtIn = ROLE_CATEGORIES.find((c) => c.value === value);
    if (builtIn) {
      return {
        value: builtIn.value,
        label: builtIn.label,
        isReserved: builtIn.value === SYSTEM_ROLE_CATEGORY,
        isCustom: false,
      };
    }
    const existing = await this.categoryModel.findOne({ value }).lean();
    if (existing) {
      return {
        value,
        label: existing.label,
        isReserved: false,
        isCustom: true,
      };
    }
    await this.categoryModel.create({
      _id: generateUuid(),
      value,
      label,
      createdBy: actor.auth.userId,
    });
    this.logger.log({
      message: 'Role category created',
      value,
      userId: actor.auth.userId,
    });
    return { value, label, isReserved: false, isCustom: true };
  }

  /** The next free key in the ROLE-NN series (deleted roles' keys count as used). */
  async nextRoleKey(): Promise<NextRoleKeyDto> {
    const used = await this.roleModel
      .find(
        { roleKey: { $regex: `^${ROLE_KEY_PREFIX}-\\d+$` } },
        { roleKey: 1 },
      )
      .lean();
    return {
      roleKey: nextSequenceCode(
        ROLE_KEY_PREFIX,
        used.map((r) => r.roleKey),
      ),
    };
  }

  /** Counts for the roles page cards. */
  async stats(): Promise<RoleStatsDto> {
    const live = { isDeleted: false };
    const [
      totalRoles,
      rolesGivenToGroups,
      systemRoles,
      totalPermissions,
      inUse,
      withPermissions,
      custom,
    ] = await Promise.all([
      this.roleModel.countDocuments(live),
      this.mappingModel.distinct('roleId', { type: MappingType.GroupRole }),
      this.roleModel.countDocuments({ ...live, isSystem: true }),
      this.permissionModel.countDocuments({
        ...live,
        status: RecordStatus.Active,
      }),
      this.mappingModel.distinct('permissionId', {
        type: MappingType.RolePermission,
      }),
      this.mappingModel.distinct('roleId', {
        type: MappingType.RolePermission,
      }),
      this.categoryModel.countDocuments(),
    ]);
    const liveRoleIds = new Set(
      (await this.roleModel.find(live, { _id: 1 }).lean()).map((r) => r._id),
    );
    const rolesWithPermissions = withPermissions.filter((id) =>
      liveRoleIds.has(id),
    ).length;
    return {
      totalRoles,
      rolesInUse: rolesGivenToGroups.filter((id) => liveRoleIds.has(id)).length,
      systemRoles,
      customRoles: totalRoles - systemRoles,
      totalPermissions,
      permissionsInUse: inUse.length,
      rolesWithoutPermissions: Math.max(0, totalRoles - rolesWithPermissions),
      categories: ROLE_CATEGORIES.length + custom,
    };
  }

  /** Built-in (not SYSTEM) or admin-added category, else 400. */
  private async assertCategory(
    category: string,
    field = 'category',
  ): Promise<void> {
    const isBuiltIn = ROLE_CATEGORIES.some(
      (c) => c.value === category && c.value !== SYSTEM_ROLE_CATEGORY,
    );
    if (isBuiltIn || (await this.categoryModel.exists({ value: category }))) {
      return;
    }
    throw new ValidationException([
      {
        field,
        message: `Unknown category "${category}" — pick one or add it first`,
      },
    ]);
  }

  async get(id: string): Promise<RoleResponseDto> {
    const role = await this.findOrThrow(id);
    const [permissionCount, groupCount] = await Promise.all([
      this.mappingModel.countDocuments({
        type: MappingType.RolePermission,
        roleId: id,
      }),
      this.mappingModel.countDocuments({
        type: MappingType.GroupRole,
        roleId: id,
      }),
    ]);
    return Object.assign(toResponse(role), { permissionCount, groupCount });
  }

  async update(
    id: string,
    dto: UpdateRoleDto,
    actor: Actor,
  ): Promise<RoleResponseDto> {
    const role = await this.findOrThrow(id);
    if (role.isSystem) {
      throw AccessErrors.systemProtected(ENTITY);
    }
    if (dto.version !== undefined && dto.version !== role.version) {
      throw AccessErrors.versionConflict(ENTITY);
    }
    const next = {
      roleKey: dto.roleKey ?? role.roleKey,
      roleName: dto.roleName ?? role.roleName,
      category: dto.category ?? role.category,
      description: dto.description ?? role.description,
    };
    const diff = changedValues(auditView(role), next);
    if (Object.keys(diff.after).length === 0) {
      return this.get(id);
    }
    await this.assertUniqueFields(
      next.roleKey,
      next.roleName,
      next.category,
      id,
    );

    const result = await this.roleModel.updateOne(
      { _id: id, isDeleted: false, version: role.version },
      { $set: { ...next, updatedBy: actor.auth.userId }, $inc: { version: 1 } },
    );
    if (result.modifiedCount === 0) {
      throw AccessErrors.versionConflict(ENTITY);
    }
    await this.auditService.record(actor, [
      {
        entityType: AuditEntity.Role,
        entityId: id,
        action: AuditAction.Update,
        ...diff,
      },
    ]);
    this.logger.log({
      message: 'Role updated',
      roleId: id,
      changedFields: Object.keys(diff.after),
      userId: actor.auth.userId,
    });
    return this.get(id);
  }

  /**
   * Soft delete. Blocked while groups still use the role; the role's own
   * permission assignments are removed with it.
   */
  async remove(id: string, actor: Actor): Promise<DeletedResponseDto> {
    const role = await this.findOrThrow(id);
    if (role.isSystem) {
      throw AccessErrors.systemProtected(ENTITY);
    }
    const groupCount = await this.mappingModel.countDocuments({
      type: MappingType.GroupRole,
      roleId: id,
    });
    if (groupCount > 0) {
      throw AccessErrors.inUse(
        `This role is assigned to ${String(groupCount)} group(s). Remove it from those groups first.`,
        [
          {
            field: 'groups',
            message: `assigned to ${String(groupCount)} group(s)`,
          },
        ],
      );
    }
    const deletedAt = new Date();
    const result = await this.roleModel.updateOne(
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
    const removed = await this.mappingModel.deleteMany({
      type: MappingType.RolePermission,
      roleId: id,
    });
    this.resolver.invalidate();
    await this.auditService.record(actor, [
      {
        entityType: AuditEntity.Role,
        entityId: id,
        action: AuditAction.Delete,
        before: {
          ...auditView(role),
          permissionAssignmentsRemoved: removed.deletedCount,
        },
      },
    ]);
    this.logger.log({
      message: 'Role deleted',
      roleId: id,
      roleKey: role.roleKey,
      userId: actor.auth.userId,
    });
    return { id, deletedAt };
  }

  /** Live form check: which of the given key / name are already taken. */
  async exists(query: RoleExistsQueryDto): Promise<ExistsResponseDto> {
    const rules: UniqueRule[] = [];
    if (query.roleKey) {
      rules.push({
        field: 'roleKey',
        filter: { roleKey: query.roleKey, isDeleted: false },
        message: `Role key ${query.roleKey} already exists`,
      });
    }
    if (query.roleName) {
      rules.push({
        field: 'roleName',
        filter: {
          roleName: query.roleName,
          isDeleted: false,
          ...(query.category ? { category: query.category } : {}),
        },
        message: query.category
          ? `A role named "${query.roleName}" already exists in category ${query.category}`
          : `A role named "${query.roleName}" already exists`,
        isCaseInsensitive: true,
      });
    }
    if (rules.length === 0) {
      throw new ValidationException([
        {
          field: 'roleKey',
          message: 'Send roleKey and / or roleName to check',
        },
      ]);
    }
    const conflicts = await findConflicts(
      this.roleModel,
      rules,
      query.excludeId,
    );
    return { exists: conflicts.length > 0, conflicts };
  }

  async findByKeyOrThrow(roleKey: string): Promise<Role> {
    const role = await this.roleModel
      .findOne({ roleKey: roleKey.trim().toUpperCase(), isDeleted: false })
      .lean();
    if (!role) {
      throw AccessErrors.notFound(ENTITY);
    }
    return role;
  }

  async getByKey(roleKey: string): Promise<RoleResponseDto> {
    return this.get((await this.findByKeyOrThrow(roleKey))._id);
  }

  /**
   * Several updates at once. Every item is checked first (exists, not a
   * system role, version, duplicates against the database and within the
   * batch); if anything fails nothing is written and every problem is listed
   * as `roles.<index>.<field>`.
   */
  async bulkUpdate(
    dto: BulkUpdateRolesDto,
    actor: Actor,
  ): Promise<BulkUpdateRolesResponseDto> {
    const ids = dto.roles.map((item) => item.id);
    const duplicateIds = ids.filter((id, i) => ids.indexOf(id) !== i);
    if (duplicateIds.length > 0) {
      throw new ValidationException(
        duplicateIds.map((id) => ({
          field: 'roles',
          message: `Role ${id} appears more than once`,
        })),
      );
    }
    const roles = await this.roleModel
      .find({ _id: { $in: ids }, isDeleted: false })
      .lean();
    const byId = new Map(roles.map((r) => [r._id, r]));

    const errors: { field: string; message: string }[] = [];
    const plans: {
      role: Role;
      next: Record<string, unknown>;
      diff: ReturnType<typeof changedValues>;
    }[] = [];
    const seenKeys = new Map<string, number>();
    const seenNames = new Map<string, number>();
    for (const [index, item] of dto.roles.entries()) {
      const at = (field: string) => `roles.${String(index)}.${field}`;
      const role = byId.get(item.id);
      if (!role) {
        errors.push({ field: at('id'), message: 'Role not found' });
        continue;
      }
      if (role.isSystem) {
        errors.push({
          field: at('id'),
          message: 'System roles cannot be changed',
        });
        continue;
      }
      if (item.version !== undefined && item.version !== role.version) {
        errors.push({
          field: at('version'),
          message: 'The role was changed by someone else',
        });
        continue;
      }
      const next = {
        roleKey: item.roleKey ?? role.roleKey,
        roleName: item.roleName ?? role.roleName,
        category: item.category ?? role.category,
        description: item.description ?? role.description,
      };
      const nameKey = `${next.category}|${next.roleName.toLowerCase()}`;
      const keyIndex = seenKeys.get(next.roleKey);
      const nameIndex = seenNames.get(nameKey);
      if (keyIndex !== undefined) {
        errors.push({
          field: at('roleKey'),
          message: `Same roleKey as roles.${String(keyIndex)}`,
        });
      }
      if (nameIndex !== undefined) {
        errors.push({
          field: at('roleName'),
          message: `Same name and category as roles.${String(nameIndex)}`,
        });
      }
      seenKeys.set(next.roleKey, index);
      seenNames.set(nameKey, index);
      if (item.category !== undefined) {
        try {
          await this.assertCategory(next.category, at('category'));
        } catch (error) {
          if (error instanceof ValidationException) {
            errors.push({
              field: at('category'),
              message: `Unknown category "${next.category}"`,
            });
          } else {
            throw error;
          }
        }
      }
      const conflicts = await findConflicts(
        this.roleModel,
        this.uniqueRules(next.roleKey, next.roleName, next.category),
        role._id,
      );
      errors.push(
        ...conflicts.map((c) => ({ field: at(c.field), message: c.message })),
      );
      plans.push({ role, next, diff: changedValues(auditView(role), next) });
    }
    if (errors.length > 0) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.BulkOperationFailed,
        'No roles were updated: fix the listed problems and try again',
        errors,
      );
    }

    const unchangedIds: string[] = [];
    for (const { role, next, diff } of plans) {
      if (Object.keys(diff.after).length === 0) {
        unchangedIds.push(role._id);
        continue;
      }
      const result = await this.roleModel.updateOne(
        { _id: role._id, isDeleted: false, version: role.version },
        {
          $set: { ...next, updatedBy: actor.auth.userId },
          $inc: { version: 1 },
        },
      );
      if (result.modifiedCount === 0) {
        throw AccessErrors.versionConflict(ENTITY);
      }
      await this.auditService.record(actor, [
        {
          entityType: AuditEntity.Role,
          entityId: role._id,
          action: AuditAction.Update,
          ...diff,
        },
      ]);
    }
    this.logger.log({
      message: 'Roles updated in bulk',
      updatedCount: plans.length - unchangedIds.length,
      userId: actor.auth.userId,
    });
    const updated = await this.roleModel.find({ _id: { $in: ids } }).lean();
    const order = new Map(ids.map((id, i) => [id, i]));
    return {
      updatedCount: plans.length - unchangedIds.length,
      unchangedIds,
      roles: updated
        .sort((a, b) => (order.get(a._id) ?? 0) - (order.get(b._id) ?? 0))
        .map(toListItem),
    };
  }

  /** Creates the role, or updates the existing one with the same roleKey. */
  async upsertByKey(
    dto: CreateRoleDto,
    actor: Actor,
  ): Promise<{ role: RoleResponseDto; isCreated: boolean }> {
    const existing = await this.roleModel
      .findOne({ roleKey: dto.roleKey, isDeleted: false })
      .lean();
    if (!existing) {
      return { role: await this.create(dto, actor), isCreated: true };
    }
    const update: UpdateRoleDto = {
      roleName: dto.roleName,
      category: dto.category,
      ...(dto.description !== undefined
        ? { description: dto.description }
        : {}),
    };
    return {
      role: await this.update(existing._id, update, actor),
      isCreated: false,
    };
  }

  /** Non-deleted role or 404. */
  async findOrThrow(id: string): Promise<Role> {
    const role = await this.roleModel
      .findOne({ _id: id, isDeleted: false })
      .lean();
    if (!role) {
      throw AccessErrors.notFound(ENTITY);
    }
    return role;
  }

  private async assertUniqueFields(
    roleKey: string,
    roleName: string,
    category: string,
    excludeId?: string,
  ) {
    // Built-in roles keep SYSTEM; everything else needs a known category.
    if (category !== SYSTEM_ROLE_CATEGORY || !excludeId) {
      await this.assertCategory(category);
    }
    return assertUnique(
      this.roleModel,
      this.uniqueRules(roleKey, roleName, category),
      excludeId,
    );
  }

  private uniqueRules(
    roleKey: string,
    roleName: string,
    category: string,
  ): UniqueRule[] {
    return [
      {
        field: 'roleKey',
        filter: { roleKey, isDeleted: false },
        message: `Role key ${roleKey} already exists`,
      },
      {
        field: 'roleName',
        filter: { roleName, category, isDeleted: false },
        message: `A role named "${roleName}" already exists in category ${category}`,
        isCaseInsensitive: true,
      },
    ];
  }
}

function auditView(role: Role): Record<string, unknown> {
  return {
    roleKey: role.roleKey,
    roleName: role.roleName,
    category: role.category,
    description: role.description,
  };
}

function toListItem(role: Role): RoleListItemDto {
  return {
    id: role._id,
    roleKey: role.roleKey,
    roleName: role.roleName,
    category: role.category,
    description: role.description,
    isSystem: role.isSystem,
    updatedAt: role.updatedAt,
  };
}

function toResponse(role: Role): RoleResponseDto {
  return Object.assign(toListItem(role), {
    version: role.version,
    createdBy: role.createdBy,
    updatedBy: role.updatedBy,
    createdAt: role.createdAt,
  });
}
