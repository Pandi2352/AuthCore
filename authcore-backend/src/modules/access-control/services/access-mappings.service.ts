import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import type { Paginated } from '@common/interfaces/api-response.interface';
import { normalizePagination, paginate } from '@common/utils/pagination.util';
import { buildDateRange, containsPattern } from '@common/utils/query.util';
import { generateUuid } from '@common/utils/uuid.util';
import { UserRole } from '@modules/users/enums/user-role.enum';
import { UserStatus } from '@modules/users/enums/user-status.enum';
import { UsersService } from '@modules/users/users.service';

import { SYSTEM_ACTOR } from '../constants/access-control.constants';
import type {
  AccessTreeGroupDto,
  AssignResultDto,
  EffectiveAccessDto,
  GroupRolesDto,
  GroupUsersDto,
  MappingListQueryDto,
  MappingResponseDto,
  RemoveResultDto,
  RolePermissionsDto,
} from '../dto/access-mapping.dto';
import {
  AuditAction,
  AuditEntity,
  MappingType,
  RecordStatus,
} from '../enums/access-control.enum';
import type { Actor } from '../interfaces/actor.interface';
import { AccessMapping } from '../schemas/access-mapping.schema';
import { Group } from '../schemas/group.schema';
import { Permission } from '../schemas/permission.schema';
import { Role } from '../schemas/role.schema';
import { AccessErrors } from '../utils/access-errors.util';
import { AccessAuditService } from './access-audit.service';
import { AccessResolverService } from './access-resolver.service';

/** Users in these states can't be added to groups (they can't sign in anyway). */
const UNASSIGNABLE_USER_STATUSES: ReadonlySet<UserStatus> = new Set([
  UserStatus.Suspended,
  UserStatus.Banned,
  UserStatus.Rejected,
  UserStatus.Inactive,
]);
const MAX_USER_SEARCH_IDS = 500;

type LinkFields = Pick<
  AccessMapping,
  'groupId' | 'userId' | 'roleId' | 'permissionId'
>;

interface Managed {
  _id: string;
  status: RecordStatus;
}

/**
 * Assignments for User → Group → Role → Permission. Rules:
 * - everything referenced must exist, not be deleted, and be ACTIVE (users:
 *   not suspended / banned / rejected / deactivated);
 * - assigning twice is harmless (reported as alreadyAssigned; unique indexes
 *   also cover concurrent requests);
 * - non-ADMIN actors can only grant permissions they hold, and can't change
 *   their own group membership;
 * - the system role's permissions are fixed.
 */
/** Who default-group assignments are recorded as. */
const SYSTEM_ACTOR_CONTEXT: Actor = {
  auth: {
    userId: SYSTEM_ACTOR,
    sessionId: '',
    tokenId: '',
    role: UserRole.Admin,
  },
  client: { ipAddress: 'system', userAgent: 'system' },
};

@Injectable()
export class AccessMappingsService {
  private readonly logger = new Logger(AccessMappingsService.name);

  constructor(
    @InjectModel(AccessMapping.name)
    private readonly mappingModel: Model<AccessMapping>,
    @InjectModel(Group.name) private readonly groupModel: Model<Group>,
    @InjectModel(Role.name) private readonly roleModel: Model<Role>,
    @InjectModel(Permission.name)
    private readonly permissionModel: Model<Permission>,
    private readonly usersService: UsersService,
    private readonly resolver: AccessResolverService,
    private readonly auditService: AccessAuditService,
  ) {}

  // ----- Users ↔ groups -----------------------------------------------------

  async assignGroupUsers(
    dto: GroupUsersDto,
    actor: Actor,
  ): Promise<AssignResultDto> {
    this.assertNotSelf(actor, dto.userIds);
    await this.activeGroup(dto.groupId);
    await this.assignableUsers(dto.userIds);
    await this.resolver.assertCanGrant(
      actor,
      await this.resolver.permissionKeysOfGroups([dto.groupId]),
    );
    return this.assign(
      MappingType.GroupUser,
      dto.userIds.map((userId) => ({
        groupId: dto.groupId,
        userId,
        roleId: null,
        permissionId: null,
      })),
      (link) => link.userId ?? '',
      actor,
      dto.expiresAt ?? null,
    );
  }

  /**
   * Adds a new user to every active default group (system action: no
   * escalation check, audited as "system"). Never throws: a failure is logged
   * and the account is still created. Returns the joined group ids.
   */
  async assignDefaultGroups(userId: string, source: string): Promise<string[]> {
    try {
      const groups = await this.groupModel
        .find(
          { isDefault: true, isDeleted: false, status: RecordStatus.Active },
          { _id: 1 },
        )
        .lean();
      const joined: string[] = [];
      for (const group of groups) {
        const result = await this.assign(
          MappingType.GroupUser,
          [{ groupId: group._id, userId, roleId: null, permissionId: null }],
          (link) => link.userId ?? '',
          SYSTEM_ACTOR_CONTEXT,
        );
        if (result.assignedCount > 0) {
          joined.push(group._id);
        }
      }
      if (joined.length > 0) {
        this.logger.log({
          message: 'User added to default groups',
          userId,
          source,
          groupIds: joined,
        });
      }
      return joined;
    } catch (error) {
      this.logger.error(
        { message: 'Default groups could not be assigned', userId, source },
        error instanceof Error ? error.stack : undefined,
      );
      return [];
    }
  }

  async removeGroupUsers(
    dto: GroupUsersDto,
    actor: Actor,
  ): Promise<RemoveResultDto> {
    this.assertNotSelf(actor, dto.userIds);
    await this.existingGroup(dto.groupId);
    return this.remove(
      MappingType.GroupUser,
      { groupId: dto.groupId },
      'userId',
      dto.userIds,
      actor,
    );
  }

  // ----- Roles ↔ groups -----------------------------------------------------

  async assignGroupRoles(
    dto: GroupRolesDto,
    actor: Actor,
  ): Promise<AssignResultDto> {
    await this.activeGroup(dto.groupId);
    await this.activeEntities(this.roleModel, dto.roleIds, 'Role', 'roleIds');
    await this.resolver.assertCanGrant(
      actor,
      await this.resolver.permissionKeysOfRoles(dto.roleIds),
    );
    return this.assign(
      MappingType.GroupRole,
      dto.roleIds.map((roleId) => ({
        groupId: dto.groupId,
        roleId,
        userId: null,
        permissionId: null,
      })),
      (link) => link.roleId ?? '',
      actor,
      dto.expiresAt ?? null,
    );
  }

  async removeGroupRoles(
    dto: GroupRolesDto,
    actor: Actor,
  ): Promise<RemoveResultDto> {
    await this.existingGroup(dto.groupId);
    return this.remove(
      MappingType.GroupRole,
      { groupId: dto.groupId },
      'roleId',
      dto.roleIds,
      actor,
    );
  }

  // ----- Permissions ↔ roles ------------------------------------------------

  /**
   * Pre-checks for "role + its groups and permissions in one call": every
   * group active, every permission active, and the caller may grant those
   * permissions. Nothing is written.
   */
  async validateRoleSetup(
    groupIds: string[],
    permissionIds: string[],
    actor: Actor,
  ): Promise<void> {
    for (const groupId of groupIds) {
      await this.activeGroup(groupId);
    }
    if (permissionIds.length > 0) {
      const permissions = await this.activeEntities(
        this.permissionModel,
        permissionIds,
        'Permission',
        'permissionIds',
      );
      await this.resolver.assertCanGrant(
        actor,
        permissions.map((p) => p.permissionKey),
      );
    }
  }

  /** Current group ids and permission ids of a role. */
  async linksOfRole(
    roleId: string,
  ): Promise<{ groupIds: string[]; permissionIds: string[] }> {
    const links = await this.mappingModel
      .find({
        roleId,
        type: { $in: [MappingType.GroupRole, MappingType.RolePermission] },
      })
      .lean();
    return {
      groupIds: links
        .filter((l) => l.type === MappingType.GroupRole)
        .map((l) => l.groupId ?? ''),
      permissionIds: links
        .filter((l) => l.type === MappingType.RolePermission)
        .map((l) => l.permissionId ?? ''),
    };
  }

  async assignRolePermissions(
    dto: RolePermissionsDto,
    actor: Actor,
  ): Promise<AssignResultDto> {
    const role = await this.roleForPermissionChange(dto.roleId);
    if (role.status !== RecordStatus.Active) {
      throw AccessErrors.inactive('The role is inactive', [
        { field: 'roleId', message: 'Role is inactive' },
      ]);
    }
    const permissions = await this.activeEntities(
      this.permissionModel,
      dto.permissionIds,
      'Permission',
      'permissionIds',
    );
    await this.resolver.assertCanGrant(
      actor,
      permissions.map((p) => p.permissionKey),
    );
    return this.assign(
      MappingType.RolePermission,
      dto.permissionIds.map((permissionId) => ({
        roleId: dto.roleId,
        permissionId,
        groupId: null,
        userId: null,
      })),
      (link) => link.permissionId ?? '',
      actor,
      dto.expiresAt ?? null,
    );
  }

  async removeRolePermissions(
    dto: RolePermissionsDto,
    actor: Actor,
  ): Promise<RemoveResultDto> {
    await this.roleForPermissionChange(dto.roleId);
    return this.remove(
      MappingType.RolePermission,
      { roleId: dto.roleId },
      'permissionId',
      dto.permissionIds,
      actor,
    );
  }

  /** Removes one assignment by its mapping id (same rules as the bulk removals). */
  async removeById(id: string, actor: Actor): Promise<RemoveResultDto> {
    const mapping = await this.mappingModel.findById(id).lean();
    if (!mapping) {
      throw AccessErrors.notFound('Access mapping');
    }
    switch (mapping.type) {
      case MappingType.GroupUser:
        return this.removeGroupUsers(
          { groupId: mapping.groupId ?? '', userIds: [mapping.userId ?? ''] },
          actor,
        );
      case MappingType.GroupRole:
        return this.removeGroupRoles(
          { groupId: mapping.groupId ?? '', roleIds: [mapping.roleId ?? ''] },
          actor,
        );
      case MappingType.RolePermission:
        return this.removeRolePermissions(
          {
            roleId: mapping.roleId ?? '',
            permissionIds: [mapping.permissionId ?? ''],
          },
          actor,
        );
    }
  }

  // ----- Listing and effective access ---------------------------------------

  async list(
    query: MappingListQueryDto,
  ): Promise<Paginated<MappingResponseDto>> {
    const { page, limit, skip } = normalizePagination(query.page, query.limit);
    const createdAt = buildDateRange(
      'assigned',
      query.assignedFrom,
      query.assignedTo,
    );
    const searchUserIds = query.search
      ? await this.usersService.findIdsMatching(
          containsPattern(query.search),
          MAX_USER_SEARCH_IDS,
        )
      : null;
    const userFilter = searchUserIds
      ? {
          userId: query.userId
            ? searchUserIds.includes(query.userId)
              ? query.userId
              : '__none__'
            : { $in: searchUserIds },
        }
      : query.userId
        ? { userId: query.userId }
        : {};
    const filter = {
      ...(query.type ? { type: query.type } : {}),
      ...(searchUserIds ? { type: MappingType.GroupUser } : {}),
      ...userFilter,
      ...(query.groupId ? { groupId: query.groupId } : {}),
      ...(query.roleId ? { roleId: query.roleId } : {}),
      ...(query.permissionId ? { permissionId: query.permissionId } : {}),
      ...(createdAt ? { createdAt } : {}),
    };
    const direction = query.sortOrder === 'asc' ? 1 : -1;
    const [mappings, total] = await Promise.all([
      this.mappingModel
        .find(filter)
        .sort({ createdAt: direction, _id: direction })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.mappingModel.countDocuments(filter),
    ]);
    return paginate(await this.hydrate(mappings), page, limit, total);
  }

  async effectiveAccess(userId: string): Promise<EffectiveAccessDto> {
    const [user] = await this.usersService.findManyByIds([userId]);
    if (!user) {
      throw AccessErrors.notFound('User');
    }
    const { groups, roles, permissions } = await this.resolver.resolve(userId);
    return {
      userId,
      isSuperAdmin: user.role === UserRole.Admin,
      groups: groups.map((g) => ({
        id: g._id,
        groupId: g.groupId,
        groupName: g.groupName,
      })),
      roles: roles.map((r) => ({
        id: r._id,
        roleKey: r.roleKey,
        roleName: r.roleName,
      })),
      permissions: permissions.map((p) => ({
        id: p._id,
        permissionKey: p.permissionKey,
        permissionName: p.permissionName,
        metadata: p.metadata.map((m) => ({
          key: m.key,
          value: m.value,
          action: m.action,
        })),
      })),
      permissionKeys: permissions.map((p) => p.permissionKey),
    };
  }

  // ----- Helpers ------------------------------------------------------------

  /**
   * Sets or removes an assignment's end date. Extending (later date or none)
   * follows the assign rules: no self-membership changes, no escalation,
   * system role fixed.
   */
  async setExpiry(
    id: string,
    expiresAt: Date | null,
    actor: Actor,
  ): Promise<MappingResponseDto> {
    const mapping = await this.mappingModel.findById(id).lean();
    if (!mapping) {
      throw AccessErrors.notFound('Access mapping');
    }
    const isExtending =
      expiresAt === null ||
      mapping.expiresAt === null ||
      expiresAt > mapping.expiresAt;
    if (mapping.type === MappingType.GroupUser) {
      this.assertNotSelf(actor, [mapping.userId ?? '']);
      if (isExtending) {
        await this.resolver.assertCanGrant(
          actor,
          await this.resolver.permissionKeysOfGroups([mapping.groupId ?? '']),
        );
      }
    } else if (mapping.type === MappingType.GroupRole) {
      if (isExtending) {
        await this.resolver.assertCanGrant(
          actor,
          await this.resolver.permissionKeysOfRoles([mapping.roleId ?? '']),
        );
      }
    } else {
      await this.roleForPermissionChange(mapping.roleId ?? '');
      if (isExtending) {
        const permission = await this.permissionModel
          .findById(mapping.permissionId)
          .lean();
        await this.resolver.assertCanGrant(
          actor,
          permission ? [permission.permissionKey] : [],
        );
      }
    }
    await this.mappingModel.updateOne({ _id: id }, { $set: { expiresAt } });
    this.resolver.invalidate();
    await this.auditService.record(actor, [
      {
        entityType: AuditEntity.AccessMapping,
        entityId: id,
        action: AuditAction.Update,
        before: { expiresAt: mapping.expiresAt },
        after: { expiresAt },
      },
    ]);
    const updated = await this.mappingModel.findById(id).lean();
    return (
      await this.hydrate(updated ? [updated] : [])
    )[0] as MappingResponseDto;
  }

  /**
   * A user's access as a tree for the admin screen: group memberships → the
   * groups' roles → the roles' permissions, each with its mapping id and end
   * date (expired links included, flagged).
   */
  async userAccessTree(userId: string): Promise<AccessTreeGroupDto[]> {
    const memberships = await this.mappingModel
      .find({ type: MappingType.GroupUser, userId })
      .sort({ createdAt: 1 })
      .lean();
    const groupIds = memberships.map((m) => m.groupId ?? '');
    const roleLinks = groupIds.length
      ? await this.mappingModel
          .find({ type: MappingType.GroupRole, groupId: { $in: groupIds } })
          .lean()
      : [];
    const roleIds = [...new Set(roleLinks.map((l) => l.roleId ?? ''))];
    const permissionLinks = roleIds.length
      ? await this.mappingModel
          .find({ type: MappingType.RolePermission, roleId: { $in: roleIds } })
          .lean()
      : [];
    const [groups, roles, permissions] = await Promise.all([
      this.groupModel
        .find(
          { _id: { $in: groupIds }, isDeleted: false },
          { groupId: 1, groupName: 1 },
        )
        .lean(),
      this.roleModel
        .find(
          { _id: { $in: roleIds }, isDeleted: false },
          { roleKey: 1, roleName: 1 },
        )
        .lean(),
      this.permissionModel
        .find(
          {
            _id: { $in: permissionLinks.map((l) => l.permissionId ?? '') },
            isDeleted: false,
          },
          { permissionKey: 1, permissionName: 1 },
        )
        .lean(),
    ]);
    const groupById = new Map(groups.map((g) => [g._id, g]));
    const roleById = new Map(roles.map((r) => [r._id, r]));
    const permissionById = new Map(permissions.map((p) => [p._id, p]));
    const result: AccessTreeGroupDto[] = [];
    for (const m of memberships) {
      const group = groupById.get(m.groupId ?? '');
      if (!group) {
        continue;
      }
      const groupRoles = [];
      for (const l of roleLinks) {
        const role = roleById.get(l.roleId ?? '');
        if (l.groupId !== group._id || !role) {
          continue;
        }
        const rolePermissions = [];
        for (const p of permissionLinks) {
          const permission = permissionById.get(p.permissionId ?? '');
          if (p.roleId !== role._id || !permission) {
            continue;
          }
          rolePermissions.push({
            mappingId: p._id,
            permission: {
              id: permission._id,
              permissionKey: permission.permissionKey,
              permissionName: permission.permissionName,
            },
            expiresAt: p.expiresAt,
            isExpired: isExpired(p.expiresAt),
          });
        }
        groupRoles.push({
          mappingId: l._id,
          role: {
            id: role._id,
            roleKey: role.roleKey,
            roleName: role.roleName,
          },
          expiresAt: l.expiresAt,
          isExpired: isExpired(l.expiresAt),
          permissions: rolePermissions,
        });
      }
      result.push({
        mappingId: m._id,
        group: {
          id: group._id,
          groupId: group.groupId,
          groupName: group.groupName,
        },
        expiresAt: m.expiresAt,
        isExpired: isExpired(m.expiresAt),
        roles: groupRoles,
      });
    }
    return result;
  }

  /** Re-activates an expired link with a new end date; true when renewed. */
  private async renewExpired(
    type: MappingType,
    link: LinkFields,
    expiresAt: Date | null,
    actor: Actor,
  ): Promise<boolean> {
    const result = await this.mappingModel.updateOne(
      { type, ...link, expiresAt: { $ne: null, $lte: new Date() } },
      { $set: { expiresAt, assignedBy: actor.auth.userId } },
    );
    return result.modifiedCount === 1;
  }

  private async idOfLink(
    type: MappingType,
    link: LinkFields,
  ): Promise<string | null> {
    const found = await this.mappingModel
      .findOne({ type, ...link }, { _id: 1 })
      .lean();
    return found?._id ?? null;
  }

  private async assign(
    type: MappingType,
    links: LinkFields[],
    idOf: (link: LinkFields) => string,
    actor: Actor,
    expiresAt: Date | null = null,
  ): Promise<AssignResultDto> {
    const created: { id: string; link: LinkFields }[] = [];
    const alreadyAssignedIds: string[] = [];
    for (const link of links) {
      const id = generateUuid();
      try {
        // Upsert on the unique pair: a concurrent duplicate becomes a no-op.
        const result = await this.mappingModel.updateOne(
          { type, ...link },
          {
            $setOnInsert: {
              _id: id,
              type,
              ...link,
              assignedBy: actor.auth.userId,
              expiresAt,
            },
          },
          { upsert: true },
        );
        if (result.upsertedCount === 1) {
          created.push({ id, link });
        } else if (await this.renewExpired(type, link, expiresAt, actor)) {
          // An expired link counts as not assigned: assigning renews it.
          created.push({ id: (await this.idOfLink(type, link)) ?? id, link });
        } else {
          alreadyAssignedIds.push(idOf(link));
        }
      } catch (error) {
        if (isDuplicateKey(error)) {
          alreadyAssignedIds.push(idOf(link));
        } else {
          throw error;
        }
      }
    }
    if (created.length > 0) {
      this.resolver.invalidate();
      await this.auditService.record(
        actor,
        created.map(({ id, link }) => ({
          entityType: AuditEntity.AccessMapping,
          entityId: id,
          action: AuditAction.Assign,
          after: { type, ...withoutNulls(link) },
        })),
      );
    }
    this.logger.log({
      message: 'Access assigned',
      type,
      assignedCount: created.length,
      userId: actor.auth.userId,
    });
    return { assignedCount: created.length, alreadyAssignedIds };
  }

  private async remove(
    type: MappingType,
    owner: Partial<LinkFields>,
    field: 'userId' | 'roleId' | 'permissionId',
    ids: string[],
    actor: Actor,
  ): Promise<RemoveResultDto> {
    const existing = await this.mappingModel
      .find({ type, ...owner, [field]: { $in: ids } })
      .lean();
    if (existing.length > 0) {
      await this.mappingModel.deleteMany({
        _id: { $in: existing.map((m) => m._id) },
      });
      this.resolver.invalidate();
      await this.auditService.record(
        actor,
        existing.map((m) => ({
          entityType: AuditEntity.AccessMapping,
          entityId: m._id,
          action: AuditAction.Revoke,
          before: { type, ...withoutNulls(m) },
        })),
      );
    }
    const removed = new Set(existing.map((m) => m[field] ?? ''));
    this.logger.log({
      message: 'Access removed',
      type,
      removedCount: existing.length,
      userId: actor.auth.userId,
    });
    return {
      removedCount: existing.length,
      notAssignedIds: ids.filter((id) => !removed.has(id)),
    };
  }

  private assertNotSelf(actor: Actor, userIds: string[]): void {
    if (
      actor.auth.role !== (UserRole.Admin as string) &&
      userIds.includes(actor.auth.userId)
    ) {
      throw AccessErrors.forbidden(
        'You cannot change your own group membership',
        [{ field: 'userIds', message: 'contains your own user id' }],
      );
    }
  }

  private async existingGroup(groupId: string): Promise<Group> {
    const group = await this.groupModel
      .findOne({ _id: groupId, isDeleted: false })
      .lean();
    if (!group) {
      throw AccessErrors.notFound('Group', [
        { field: 'groupId', message: 'Group not found' },
      ]);
    }
    return group;
  }

  private async activeGroup(groupId: string): Promise<Group> {
    const group = await this.existingGroup(groupId);
    if (group.status !== RecordStatus.Active) {
      throw AccessErrors.inactive('The group is inactive', [
        { field: 'groupId', message: 'Group is inactive' },
      ]);
    }
    return group;
  }

  private async roleForPermissionChange(roleId: string): Promise<Role> {
    const role = await this.roleModel
      .findOne({ _id: roleId, isDeleted: false })
      .lean();
    if (!role) {
      throw AccessErrors.notFound('Role', [
        { field: 'roleId', message: 'Role not found' },
      ]);
    }
    if (role.isSystem) {
      throw AccessErrors.systemProtected('Role');
    }
    return role;
  }

  /** All ids exist (404 listing the missing ones) and are ACTIVE (400 listing the inactive ones). */
  private async activeEntities<T extends Managed>(
    model: Model<T>,
    ids: string[],
    entity: string,
    field: string,
  ): Promise<T[]> {
    const found = (await model
      .find({ _id: { $in: ids }, isDeleted: false })
      .lean()) as T[];
    const byId = new Map(found.map((e) => [e._id, e]));
    const missing = ids.filter((id) => !byId.has(id));
    if (missing.length > 0) {
      throw AccessErrors.notFound(
        missing.length === 1
          ? entity
          : `${String(missing.length)} ${entity.toLowerCase()}s`,
        missing.map((id) => ({ field, message: `${entity} ${id} not found` })),
      );
    }
    const inactive = found.filter((e) => e.status !== RecordStatus.Active);
    if (inactive.length > 0) {
      throw AccessErrors.inactive(
        `Inactive ${entity.toLowerCase()}s cannot be assigned`,
        inactive.map((e) => ({
          field,
          message: `${entity} ${e._id} is inactive`,
        })),
      );
    }
    return found;
  }

  private async assignableUsers(userIds: string[]): Promise<void> {
    const users = await this.usersService.findManyByIds(userIds);
    const byId = new Map(users.map((u) => [u.id, u]));
    const missing = userIds.filter((id) => !byId.has(id));
    if (missing.length > 0) {
      throw AccessErrors.notFound(
        missing.length === 1 ? 'User' : `${String(missing.length)} users`,
        missing.map((id) => ({
          field: 'userIds',
          message: `User ${id} not found`,
        })),
      );
    }
    const blocked = users.filter((u) =>
      UNASSIGNABLE_USER_STATUSES.has(u.status),
    );
    if (blocked.length > 0) {
      throw AccessErrors.inactive(
        'Suspended, banned, rejected or deactivated users cannot be added to groups',
        blocked.map((u) => ({
          field: 'userIds',
          message: `User ${u.id} is ${u.status}`,
        })),
      );
    }
  }

  /** Replaces ids with { id, key, name } references in one query per collection. */
  private async hydrate(
    mappings: AccessMapping[],
  ): Promise<MappingResponseDto[]> {
    const ids = (field: keyof LinkFields) => [
      ...new Set(
        mappings.map((m) => m[field]).filter((v): v is string => v !== null),
      ),
    ];
    const [users, groups, roles, permissions] = await Promise.all([
      this.usersService.findManyByIds(ids('userId')),
      this.groupModel
        .find({ _id: { $in: ids('groupId') } }, { groupId: 1, groupName: 1 })
        .lean(),
      this.roleModel
        .find({ _id: { $in: ids('roleId') } }, { roleKey: 1, roleName: 1 })
        .lean(),
      this.permissionModel
        .find(
          { _id: { $in: ids('permissionId') } },
          { permissionKey: 1, permissionName: 1 },
        )
        .lean(),
    ]);
    const userById = new Map(users.map((u) => [u.id, u]));
    const groupById = new Map(groups.map((g) => [g._id, g]));
    const roleById = new Map(roles.map((r) => [r._id, r]));
    const permissionById = new Map(permissions.map((p) => [p._id, p]));
    return mappings.map((m) => {
      const user = m.userId ? userById.get(m.userId) : undefined;
      const group = m.groupId ? groupById.get(m.groupId) : undefined;
      const role = m.roleId ? roleById.get(m.roleId) : undefined;
      const permission = m.permissionId
        ? permissionById.get(m.permissionId)
        : undefined;
      return {
        id: m._id,
        type: m.type,
        user: user
          ? {
              id: user.id,
              email: user.email,
              firstName: user.firstName,
              lastName: user.lastName,
            }
          : null,
        group: group
          ? {
              id: group._id,
              groupId: group.groupId,
              groupName: group.groupName,
            }
          : null,
        role: role
          ? { id: role._id, roleKey: role.roleKey, roleName: role.roleName }
          : null,
        permission: permission
          ? {
              id: permission._id,
              permissionKey: permission.permissionKey,
              permissionName: permission.permissionName,
            }
          : null,
        assignedBy: m.assignedBy,
        assignedAt: m.createdAt,
        expiresAt: m.expiresAt,
        isExpired: isExpired(m.expiresAt),
      };
    });
  }
}

function withoutNulls(link: LinkFields): Record<string, string> {
  return Object.fromEntries(
    (['groupId', 'userId', 'roleId', 'permissionId'] as const)
      .filter((key) => link[key] !== null)
      .map((key) => [key, link[key] ?? '']),
  );
}

function isExpired(expiresAt: Date | null): boolean {
  return expiresAt !== null && expiresAt <= new Date();
}

function isDuplicateKey(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === 11000
  );
}
