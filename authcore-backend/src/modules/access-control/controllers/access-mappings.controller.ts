import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { API_TAGS } from '@common/constants/api-tags.constants';
import {
  ApiErrorResponses,
  ApiPaginatedResponse,
  ApiStandardErrors,
  ApiWrappedResponse,
} from '@common/decorators/api-response.decorator';
import { RequirePermissions } from '@common/decorators/require-permissions.decorator';
import { ResponseMessage } from '@common/decorators/response-message.decorator';
import type { Paginated } from '@common/interfaces/api-response.interface';
import { ParseIdPipe } from '@common/pipes/parse-id.pipe';

import {
  ACCESS_ADMIN_THROTTLE,
  ACCESS_PERMISSIONS as P,
} from '../constants/access-control.constants';
import { CurrentActor } from '../decorators/current-actor.decorator';
import {
  AssignResultDto,
  EffectiveAccessDto,
  GroupRolesDto,
  GroupUsersDto,
  MappingListQueryDto,
  MappingResponseDto,
  RemoveResultDto,
  RolePermissionsDto,
  SetMappingExpiryDto,
} from '../dto/access-mapping.dto';
import type { Actor } from '../interfaces/actor.interface';
import { AccessMappingsService } from '../services/access-mappings.service';

const WRITE_ERRORS = [
  HttpStatus.BAD_REQUEST,
  HttpStatus.UNAUTHORIZED,
  HttpStatus.FORBIDDEN,
  HttpStatus.NOT_FOUND,
  HttpStatus.CONFLICT,
] as const;
const ASSIGN_RULES =
  'Everything referenced must exist and be ACTIVE. Already-assigned ids are skipped (reported). Up to 100 ids. ' +
  'Non-ADMIN callers can only grant permissions they hold themselves.';

/** Who is in which group, which roles a group has, which permissions a role has. */
@ApiTags(API_TAGS.AccessMappings.name)
@ApiBearerAuth('access-token')
@ApiStandardErrors()
@Controller('access-mappings')
export class AccessMappingsController {
  constructor(private readonly mappingsService: AccessMappingsService) {}

  @Get()
  @RequirePermissions(P.MappingRead)
  @ResponseMessage('Access mappings')
  @ApiOperation({
    summary: 'List assignments',
    description:
      'Needs ACCESS_MAPPING_READ. Filter by type, userId, groupId, roleId, permissionId and assigned date; ' +
      '`search` finds users by email / name. Reverse lookups: members of a group ' +
      '(`type=GROUP_USER&groupId=`), groups of a user (`type=GROUP_USER&userId=`), roles of a group, groups of ' +
      'a role, permissions of a role, roles of a permission.',
  })
  @ApiPaginatedResponse(MappingResponseDto)
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.FORBIDDEN,
  )
  list(
    @Query() query: MappingListQueryDto,
  ): Promise<Paginated<MappingResponseDto>> {
    return this.mappingsService.list(query);
  }

  @Post('group-users')
  @RequirePermissions(P.MappingAssign)
  @Throttle({ default: ACCESS_ADMIN_THROTTLE })
  @ResponseMessage('Users added to the group')
  @ApiOperation({
    summary: 'Add users to a group',
    description: `Needs ACCESS_MAPPING_ASSIGN. ${ASSIGN_RULES} Users can't change their own membership (unless ADMIN).`,
  })
  @ApiWrappedResponse(AssignResultDto, { status: HttpStatus.CREATED })
  @ApiErrorResponses(...WRITE_ERRORS)
  assignGroupUsers(
    @Body() dto: GroupUsersDto,
    @CurrentActor() actor: Actor,
  ): Promise<AssignResultDto> {
    return this.mappingsService.assignGroupUsers(dto, actor);
  }

  @Post('group-users/remove')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(P.MappingRevoke)
  @Throttle({ default: ACCESS_ADMIN_THROTTLE })
  @ResponseMessage('Users removed from the group')
  @ApiOperation({
    summary: 'Remove users from a group',
    description:
      'Needs ACCESS_MAPPING_REVOKE. Ids not in the group are reported as notAssignedIds.',
  })
  @ApiWrappedResponse(RemoveResultDto)
  @ApiErrorResponses(...WRITE_ERRORS)
  removeGroupUsers(
    @Body() dto: GroupUsersDto,
    @CurrentActor() actor: Actor,
  ): Promise<RemoveResultDto> {
    return this.mappingsService.removeGroupUsers(dto, actor);
  }

  @Post('group-roles')
  @RequirePermissions(P.MappingAssign)
  @Throttle({ default: ACCESS_ADMIN_THROTTLE })
  @ResponseMessage('Roles assigned to the group')
  @ApiOperation({
    summary: 'Assign roles to a group',
    description: `Needs ACCESS_MAPPING_ASSIGN. ${ASSIGN_RULES}`,
  })
  @ApiWrappedResponse(AssignResultDto, { status: HttpStatus.CREATED })
  @ApiErrorResponses(...WRITE_ERRORS)
  assignGroupRoles(
    @Body() dto: GroupRolesDto,
    @CurrentActor() actor: Actor,
  ): Promise<AssignResultDto> {
    return this.mappingsService.assignGroupRoles(dto, actor);
  }

  @Post('group-roles/remove')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(P.MappingRevoke)
  @Throttle({ default: ACCESS_ADMIN_THROTTLE })
  @ResponseMessage('Roles removed from the group')
  @ApiOperation({
    summary: 'Remove roles from a group',
    description: 'Needs ACCESS_MAPPING_REVOKE.',
  })
  @ApiWrappedResponse(RemoveResultDto)
  @ApiErrorResponses(...WRITE_ERRORS)
  removeGroupRoles(
    @Body() dto: GroupRolesDto,
    @CurrentActor() actor: Actor,
  ): Promise<RemoveResultDto> {
    return this.mappingsService.removeGroupRoles(dto, actor);
  }

  @Post('role-permissions')
  @RequirePermissions(P.MappingAssign)
  @Throttle({ default: ACCESS_ADMIN_THROTTLE })
  @ResponseMessage('Permissions assigned to the role')
  @ApiOperation({
    summary: 'Assign permissions to a role',
    description: `Needs ACCESS_MAPPING_ASSIGN. ${ASSIGN_RULES} The system role's permissions are fixed (409).`,
  })
  @ApiWrappedResponse(AssignResultDto, { status: HttpStatus.CREATED })
  @ApiErrorResponses(...WRITE_ERRORS)
  assignRolePermissions(
    @Body() dto: RolePermissionsDto,
    @CurrentActor() actor: Actor,
  ): Promise<AssignResultDto> {
    return this.mappingsService.assignRolePermissions(dto, actor);
  }

  @Post('role-permissions/remove')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(P.MappingRevoke)
  @Throttle({ default: ACCESS_ADMIN_THROTTLE })
  @ResponseMessage('Permissions removed from the role')
  @ApiOperation({
    summary: 'Remove permissions from a role',
    description: 'Needs ACCESS_MAPPING_REVOKE.',
  })
  @ApiWrappedResponse(RemoveResultDto)
  @ApiErrorResponses(...WRITE_ERRORS)
  removeRolePermissions(
    @Body() dto: RolePermissionsDto,
    @CurrentActor() actor: Actor,
  ): Promise<RemoveResultDto> {
    return this.mappingsService.removeRolePermissions(dto, actor);
  }

  @Get('users/:userId/effective-access')
  @RequirePermissions(P.MappingRead)
  @ResponseMessage('Effective access')
  @ApiOperation({
    summary: "A user's effective access",
    description:
      'Needs ACCESS_MAPPING_READ. Groups → roles → permissions the user actually has (active only, no ' +
      'duplicates; parent groups included when ACCESS_INHERIT_PARENT_GROUPS=true).',
  })
  @ApiWrappedResponse(EffectiveAccessDto)
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.FORBIDDEN,
    HttpStatus.NOT_FOUND,
  )
  effectiveAccess(
    @Param('userId', ParseIdPipe) userId: string,
  ): Promise<EffectiveAccessDto> {
    return this.mappingsService.effectiveAccess(userId);
  }

  @Patch(':id')
  @RequirePermissions(P.MappingAssign)
  @Throttle({ default: ACCESS_ADMIN_THROTTLE })
  @ResponseMessage('Assignment end date updated')
  @ApiOperation({
    summary: 'Set or remove an assignment end date',
    description:
      'Needs ACCESS_MAPPING_ASSIGN. { expiresAt } (future date) or null for no end date. After the end date the ' +
      'link grants nothing (shown as isExpired). Extending follows the assign rules (no escalation, no self-membership).',
  })
  @ApiWrappedResponse(MappingResponseDto)
  @ApiErrorResponses(...WRITE_ERRORS)
  setExpiry(
    @Param('id', ParseIdPipe) id: string,
    @Body() dto: SetMappingExpiryDto,
    @CurrentActor() actor: Actor,
  ): Promise<MappingResponseDto> {
    return this.mappingsService.setExpiry(id, dto.expiresAt, actor);
  }

  @Delete(':id')
  @RequirePermissions(P.MappingRevoke)
  @Throttle({ default: ACCESS_ADMIN_THROTTLE })
  @ResponseMessage('Assignment removed')
  @ApiOperation({
    summary: 'Remove one assignment by id',
    description:
      'Needs ACCESS_MAPPING_REVOKE. Same rules as the bulk removals.',
  })
  @ApiWrappedResponse(RemoveResultDto)
  @ApiErrorResponses(...WRITE_ERRORS)
  remove(
    @Param('id', ParseIdPipe) id: string,
    @CurrentActor() actor: Actor,
  ): Promise<RemoveResultDto> {
    return this.mappingsService.removeById(id, actor);
  }
}
