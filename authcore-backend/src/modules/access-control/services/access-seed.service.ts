import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { generateUuid } from '@common/utils/uuid.util';

import {
  SYSTEM_ACTOR,
  SYSTEM_PERMISSIONS,
  SYSTEM_ROLES,
} from '../constants/access-control.constants';
import { MappingType, RecordStatus } from '../enums/access-control.enum';
import { AccessMapping } from '../schemas/access-mapping.schema';
import { Permission } from '../schemas/permission.schema';
import { Role } from '../schemas/role.schema';
import { AccessResolverService } from './access-resolver.service';

/**
 * Makes sure the system permissions that protect the access-control and
 * password-policy APIs, and the system roles holding them
 * (ACCESS_CONTROL_ADMIN, PASSWORD_POLICY_ADMIN), exist. Idempotent
 * and safe when several instances start at once. Failures are logged; they
 * don't stop the application (ADMIN users can still manage everything).
 */
@Injectable()
export class AccessSeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AccessSeedService.name);

  constructor(
    @InjectModel(Permission.name)
    private readonly permissionModel: Model<Permission>,
    @InjectModel(Role.name) private readonly roleModel: Model<Role>,
    @InjectModel(AccessMapping.name)
    private readonly mappingModel: Model<AccessMapping>,
    private readonly resolver: AccessResolverService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      const permissionIdByKey = new Map<string, string>();
      for (const permission of SYSTEM_PERMISSIONS) {
        const id = await this.upsert(
          this.permissionModel,
          { permissionKey: permission.permissionKey },
          {
            permissionName: permission.permissionName,
            description: permission.description,
            metadata: permission.metadata,
          },
        );
        permissionIdByKey.set(permission.permissionKey, id);
      }
      for (const systemRole of SYSTEM_ROLES) {
        const roleId = await this.upsert(
          this.roleModel,
          { roleKey: systemRole.roleKey },
          {
            roleName: systemRole.roleName,
            category: systemRole.category,
            description: systemRole.description,
          },
        );
        for (const key of systemRole.permissionKeys) {
          const permissionId = permissionIdByKey.get(key);
          if (permissionId) {
            await this.linkPermission(roleId, permissionId);
          }
        }
      }
      this.resolver.invalidate();
    } catch (error) {
      this.logger.error(
        { message: 'Access-control system data could not be seeded' },
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private async linkPermission(
    roleId: string,
    permissionId: string,
  ): Promise<void> {
    await this.mappingModel
      .updateOne(
        { type: MappingType.RolePermission, roleId, permissionId },
        {
          $setOnInsert: {
            _id: generateUuid(),
            type: MappingType.RolePermission,
            roleId,
            permissionId,
            groupId: null,
            userId: null,
            assignedBy: SYSTEM_ACTOR,
          },
        },
        { upsert: true },
      )
      .catch(ignoreDuplicate);
  }

  /** Creates the system record if missing (keeps it active, system-flagged); returns its id. */
  private async upsert<T extends { _id: string }>(
    model: Model<T>,
    key: Record<string, string>,
    fields: Record<string, unknown>,
  ): Promise<string> {
    const filter = { ...key, isDeleted: false };
    await model
      .updateOne(
        filter,
        {
          $set: { ...fields, isSystem: true, status: RecordStatus.Active },
          $setOnInsert: {
            _id: generateUuid(),
            ...key,
            isDeleted: false,
            createdBy: SYSTEM_ACTOR,
            updatedBy: SYSTEM_ACTOR,
            version: 1,
          },
        },
        { upsert: true },
      )
      .catch(ignoreDuplicate);
    const doc = await model.findOne(filter, { _id: 1 }).lean();
    if (!doc) {
      throw new Error(
        `System record ${JSON.stringify(key)} missing after upsert`,
      );
    }
    return (doc as unknown as { _id: string })._id;
  }
}

/** Another instance inserted the same record first: fine. */
function ignoreDuplicate(error: unknown): void {
  if ((error as { code?: unknown }).code !== 11000) {
    throw error;
  }
}
