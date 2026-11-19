import { Injectable, Logger } from '@nestjs/common';

import { UserRole } from '@modules/users/enums/user-role.enum';

import { ACCESS_PERMISSIONS } from '../constants/access-control.constants';
import type { RoleSetupDto, RoleSetupResponseDto } from '../dto/role.dto';
import type { Actor } from '../interfaces/actor.interface';
import { AccessErrors } from '../utils/access-errors.util';
import { AccessMappingsService } from './access-mappings.service';
import { AccessResolverService } from './access-resolver.service';
import { RolesService } from './roles.service';

/**
 * "Create or update a role together with its groups and permissions":
 * 1. check everything first (groups / permissions active, caller may grant them,
 *    may revoke when replacing),
 * 2. create the role or update the one with the same roleKey,
 * 3. assign permissions, then groups (so escalation checks see the final role),
 * 4. with replaceAssignments, remove links not in the lists.
 */
@Injectable()
export class RoleSetupService {
  private readonly logger = new Logger(RoleSetupService.name);

  constructor(
    private readonly rolesService: RolesService,
    private readonly mappingsService: AccessMappingsService,
    private readonly resolver: AccessResolverService,
  ) {}

  async setup(dto: RoleSetupDto, actor: Actor): Promise<RoleSetupResponseDto> {
    const groupIds = dto.groupIds ?? [];
    const permissionIds = dto.permissionIds ?? [];
    const shouldReplace = dto.replaceAssignments ?? false;
    if (shouldReplace) {
      await this.assertCanRevoke(actor);
    }
    await this.mappingsService.validateRoleSetup(
      groupIds,
      permissionIds,
      actor,
    );

    const { role, isCreated } = await this.rolesService.upsertByKey(
      {
        roleKey: dto.roleKey,
        roleName: dto.roleName,
        category: dto.category,
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
      },
      actor,
    );

    const current = await this.mappingsService.linksOfRole(role.id);
    let permissionsAssigned = 0;
    let permissionsRemoved = 0;
    let groupsAssigned = 0;
    let groupsRemoved = 0;

    if (permissionIds.length > 0) {
      permissionsAssigned = (
        await this.mappingsService.assignRolePermissions(
          { roleId: role.id, permissionIds },
          actor,
        )
      ).assignedCount;
    }
    if (shouldReplace) {
      const extra = current.permissionIds.filter(
        (id) => !permissionIds.includes(id),
      );
      if (extra.length > 0) {
        permissionsRemoved = (
          await this.mappingsService.removeRolePermissions(
            { roleId: role.id, permissionIds: extra },
            actor,
          )
        ).removedCount;
      }
    }
    for (const groupId of groupIds) {
      groupsAssigned += (
        await this.mappingsService.assignGroupRoles(
          { groupId, roleIds: [role.id] },
          actor,
        )
      ).assignedCount;
    }
    if (shouldReplace) {
      for (const groupId of current.groupIds.filter(
        (id) => !groupIds.includes(id),
      )) {
        groupsRemoved += (
          await this.mappingsService.removeGroupRoles(
            { groupId, roleIds: [role.id] },
            actor,
          )
        ).removedCount;
      }
    }

    this.logger.log({
      message: isCreated ? 'Role set up (created)' : 'Role set up (updated)',
      roleId: role.id,
      groupsAssigned,
      groupsRemoved,
      permissionsAssigned,
      permissionsRemoved,
      userId: actor.auth.userId,
    });
    return {
      role: await this.rolesService.get(role.id),
      isCreated,
      groupsAssigned,
      groupsRemoved,
      permissionsAssigned,
      permissionsRemoved,
    };
  }

  private async assertCanRevoke(actor: Actor): Promise<void> {
    if (actor.auth.role === (UserRole.Admin as string)) {
      return;
    }
    const held = await this.resolver.getPermissionKeys(actor.auth.userId);
    if (!held.has(ACCESS_PERMISSIONS.MappingRevoke)) {
      throw AccessErrors.forbidden(
        'replaceAssignments removes assignments and needs ACCESS_MAPPING_REVOKE',
        [
          {
            field: 'permission',
            message: `requires ${ACCESS_PERMISSIONS.MappingRevoke}`,
          },
        ],
      );
    }
  }
}
