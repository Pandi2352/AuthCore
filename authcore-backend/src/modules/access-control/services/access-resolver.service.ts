import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { accessControlConfig } from '@config/configuration';
import { UserRole } from '@modules/users/enums/user-role.enum';

import { ACCESS_CACHE_TTL_MS } from '../constants/access-control.constants';
import { MappingType, RecordStatus } from '../enums/access-control.enum';
import type { Actor } from '../interfaces/actor.interface';
import { AccessMapping } from '../schemas/access-mapping.schema';
import { Group } from '../schemas/group.schema';
import { Permission } from '../schemas/permission.schema';
import { Role } from '../schemas/role.schema';
import { AccessErrors } from '../utils/access-errors.util';

const ACTIVE = { isDeleted: false, status: RecordStatus.Active };

export interface ResolvedAccess {
  groups: Group[];
  roles: Role[];
  permissions: Permission[];
}

/**
 * Resolves User → Groups → Roles → Permissions. Only active, non-deleted
 * groups / roles / permissions count; duplicates through several groups or
 * roles collapse. With ACCESS_INHERIT_PARENT_GROUPS, a member of a sub-group
 * also gets the roles of its (active) parent groups.
 *
 * Permission keys per user are cached for ACCESS_CACHE_TTL_MS; every change
 * on this instance clears the cache, other instances catch up within the TTL.
 */
@Injectable()
export class AccessResolverService {
  private readonly cache = new Map<
    string,
    { keys: Set<string>; loadedAt: number }
  >();

  constructor(
    @InjectModel(AccessMapping.name)
    private readonly mappingModel: Model<AccessMapping>,
    @InjectModel(Group.name) private readonly groupModel: Model<Group>,
    @InjectModel(Role.name) private readonly roleModel: Model<Role>,
    @InjectModel(Permission.name)
    private readonly permissionModel: Model<Permission>,
    @Inject(accessControlConfig.KEY)
    private readonly config: ConfigType<typeof accessControlConfig>,
  ) {}

  invalidate(): void {
    this.cache.clear();
  }

  async getPermissionKeys(userId: string): Promise<Set<string>> {
    const cached = this.cache.get(userId);
    if (cached && Date.now() - cached.loadedAt < ACCESS_CACHE_TTL_MS) {
      return cached.keys;
    }
    const { permissions } = await this.resolve(userId);
    const keys = new Set(permissions.map((p) => p.permissionKey));
    this.cache.set(userId, { keys, loadedAt: Date.now() });
    return keys;
  }

  async resolve(userId: string): Promise<ResolvedAccess> {
    const memberships = await this.mappingModel
      .find(
        { type: MappingType.GroupUser, userId, ...notExpired() },
        { groupId: 1 },
      )
      .lean();
    const groups = await this.activeGroupsWithInherited(
      memberships.map((m) => m.groupId ?? ''),
    );
    const roles = await this.activeRolesOfGroups(groups.map((g) => g._id));
    const permissions = await this.activePermissionsOfRoles(
      roles.map((r) => r._id),
    );
    return { groups, roles, permissions };
  }

  /** Permission keys a set of groups grants to its members. */
  async permissionKeysOfGroups(groupIds: string[]): Promise<Set<string>> {
    const groups = await this.activeGroupsWithInherited(groupIds);
    const roles = await this.activeRolesOfGroups(groups.map((g) => g._id));
    return this.permissionKeysOfRoles(roles.map((r) => r._id));
  }

  async permissionKeysOfRoles(roleIds: string[]): Promise<Set<string>> {
    const permissions = await this.activePermissionsOfRoles(roleIds);
    return new Set(permissions.map((p) => p.permissionKey));
  }

  /**
   * Anti privilege escalation: a non-ADMIN may only grant permissions they
   * hold themselves. 403 listing the missing keys.
   */
  async assertCanGrant(actor: Actor, keys: Iterable<string>): Promise<void> {
    if (actor.auth.role === (UserRole.Admin as string)) {
      return;
    }
    const held = await this.getPermissionKeys(actor.auth.userId);
    const missing = [...new Set(keys)].filter((key) => !held.has(key)).sort();
    if (missing.length > 0) {
      throw AccessErrors.forbidden(
        'You can only grant permissions you have yourself',
        missing.map((key) => ({
          field: 'permissions',
          message: `You do not have ${key}`,
        })),
      );
    }
  }

  private async activeGroupsWithInherited(
    groupIds: string[],
  ): Promise<Group[]> {
    if (groupIds.length === 0) {
      return [];
    }
    const direct = await this.groupModel
      .find({ _id: { $in: groupIds }, ...ACTIVE })
      .lean();
    if (!this.config.inheritParentGroups) {
      return direct;
    }
    const known = new Set(direct.map((g) => g._id));
    const ancestorIds = [
      ...new Set(direct.flatMap((g) => g.ancestorIds)),
    ].filter((id) => !known.has(id));
    const ancestors = ancestorIds.length
      ? await this.groupModel
          .find({ _id: { $in: ancestorIds }, ...ACTIVE })
          .lean()
      : [];
    return [...direct, ...ancestors];
  }

  private async activeRolesOfGroups(groupIds: string[]): Promise<Role[]> {
    if (groupIds.length === 0) {
      return [];
    }
    const links = await this.mappingModel
      .find(
        {
          type: MappingType.GroupRole,
          groupId: { $in: groupIds },
          ...notExpired(),
        },
        { roleId: 1 },
      )
      .lean();
    const roleIds = [...new Set(links.map((l) => l.roleId ?? ''))];
    return roleIds.length
      ? this.roleModel
          .find({ _id: { $in: roleIds }, ...ACTIVE })
          .sort({ roleName: 1 })
          .lean()
      : [];
  }

  private async activePermissionsOfRoles(
    roleIds: string[],
  ): Promise<Permission[]> {
    if (roleIds.length === 0) {
      return [];
    }
    const links = await this.mappingModel
      .find(
        {
          type: MappingType.RolePermission,
          roleId: { $in: roleIds },
          ...notExpired(),
        },
        { permissionId: 1 },
      )
      .lean();
    const permissionIds = [...new Set(links.map((l) => l.permissionId ?? ''))];
    return permissionIds.length
      ? this.permissionModel
          .find({ _id: { $in: permissionIds }, ...ACTIVE })
          .sort({ permissionKey: 1 })
          .lean()
      : [];
  }
}

/** Links without an end date, or whose end date is still ahead. */
export function notExpired(): { $or: Record<string, unknown>[] } {
  return { $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] };
}
