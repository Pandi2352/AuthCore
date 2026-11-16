import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { UsersModule } from '@modules/users/users.module';

import { AccessControlController } from './controllers/access-control.controller';
import { AccessMappingsController } from './controllers/access-mappings.controller';
import { GroupsController } from './controllers/groups.controller';
import { PermissionsController } from './controllers/permissions.controller';
import { RolesController } from './controllers/roles.controller';
import { AccessAudit, AccessAuditSchema } from './schemas/access-audit.schema';
import {
  AccessMapping,
  AccessMappingSchema,
} from './schemas/access-mapping.schema';
import { Group, GroupSchema } from './schemas/group.schema';
import { Permission, PermissionSchema } from './schemas/permission.schema';
import { Role, RoleSchema } from './schemas/role.schema';
import { AccessAuditService } from './services/access-audit.service';
import { AccessMappingsService } from './services/access-mappings.service';
import { AccessResolverService } from './services/access-resolver.service';
import { AccessSeedService } from './services/access-seed.service';
import { GroupsService } from './services/groups.service';
import { PermissionsService } from './services/permissions.service';
import { RoleSetupService } from './services/role-setup.service';
import { RolesService } from './services/roles.service';

/**
 * Access control (RBAC): User → Group → Role → Permission.
 * Roles, permissions and hierarchical groups (CRUD + dropdowns), the
 * assignments between them, effective-access resolution (used by the global
 * auth guard for @RequirePermissions) and an audit trail.
 */
@Module({
  imports: [
    UsersModule,
    MongooseModule.forFeature([
      { name: Role.name, schema: RoleSchema },
      { name: Permission.name, schema: PermissionSchema },
      { name: Group.name, schema: GroupSchema },
      { name: AccessMapping.name, schema: AccessMappingSchema },
      { name: AccessAudit.name, schema: AccessAuditSchema },
    ]),
  ],
  controllers: [
    RolesController,
    PermissionsController,
    GroupsController,
    AccessMappingsController,
    AccessControlController,
  ],
  providers: [
    AccessAuditService,
    AccessResolverService,
    RolesService,
    PermissionsService,
    GroupsService,
    AccessMappingsService,
    AccessSeedService,
    RoleSetupService,
  ],
  exports: [AccessResolverService, AccessAuditService, AccessMappingsService],
})
export class AccessControlModule {}
