import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
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
import { DropdownOptionDto } from '@common/dto/dropdown.dto';
import { ExistsResponseDto } from '@common/dto/exists.dto';
import type { Paginated } from '@common/interfaces/api-response.interface';
import { ParseIdPipe } from '@common/pipes/parse-id.pipe';

import {
  ACCESS_ADMIN_THROTTLE,
  ACCESS_PERMISSIONS as P,
} from '../constants/access-control.constants';
import { CurrentActor } from '../decorators/current-actor.decorator';
import {
  BulkUpdateRolesDto,
  BulkUpdateRolesResponseDto,
  CreateRoleCategoryDto,
  CreateRoleDto,
  DeletedResponseDto,
  NextRoleKeyDto,
  RoleCategoryDto,
  RoleDropdownQueryDto,
  RoleExistsQueryDto,
  RoleListItemDto,
  RoleListQueryDto,
  RoleResponseDto,
  RoleSetupDto,
  RoleSetupResponseDto,
  RoleStatsDto,
  UpdateRoleDto,
} from '../dto/role.dto';
import type { Actor } from '../interfaces/actor.interface';
import { RoleKeyPipe } from '../pipes/role-key.pipe';
import { RoleSetupService } from '../services/role-setup.service';
import { RolesService } from '../services/roles.service';

const ERRORS_READ = [
  HttpStatus.BAD_REQUEST,
  HttpStatus.UNAUTHORIZED,
  HttpStatus.FORBIDDEN,
] as const;

@ApiTags(API_TAGS.Roles.name)
@ApiBearerAuth('access-token')
@ApiStandardErrors()
@Controller('roles')
export class RolesController {
  constructor(
    private readonly rolesService: RolesService,
    private readonly roleSetupService: RoleSetupService,
  ) {}

  @Post()
  @RequirePermissions(P.RoleCreate)
  @Throttle({ default: ACCESS_ADMIN_THROTTLE })
  @ResponseMessage('Role created')
  @ApiOperation({
    summary: 'Create a role',
    description:
      'Needs ROLE_CREATE. `roleKey` is stored uppercase and must be unique; `roleName` must be unique within ' +
      'its category (case-insensitive). 409 DUPLICATE_RESOURCE lists every clashing field.',
  })
  @ApiWrappedResponse(RoleResponseDto, { status: HttpStatus.CREATED })
  @ApiErrorResponses(...ERRORS_READ, HttpStatus.CONFLICT)
  create(
    @Body() dto: CreateRoleDto,
    @CurrentActor() actor: Actor,
  ): Promise<RoleResponseDto> {
    return this.rolesService.create(dto, actor);
  }

  @Get()
  @RequirePermissions(P.RoleRead)
  @ResponseMessage('Roles')
  @ApiOperation({
    summary: 'List roles',
    description:
      'Needs ROLE_READ. Search (key, name, description), filter by category / created & updated date, ' +
      'sort by roleName, roleKey, category, createdAt or updatedAt (default updatedAt desc).',
  })
  @ApiPaginatedResponse(RoleListItemDto)
  @ApiErrorResponses(...ERRORS_READ)
  list(@Query() query: RoleListQueryDto): Promise<Paginated<RoleListItemDto>> {
    return this.rolesService.list(query);
  }

  @Get('dropdown')
  @RequirePermissions(P.RoleRead)
  @ResponseMessage('Role options')
  @ApiOperation({
    summary: 'Role dropdown',
    description:
      'Needs ROLE_READ. Active roles only: `{ id, label, key }`, sorted by name.',
  })
  @ApiWrappedResponse(DropdownOptionDto, { isArray: true })
  @ApiErrorResponses(...ERRORS_READ)
  dropdown(@Query() query: RoleDropdownQueryDto): Promise<DropdownOptionDto[]> {
    return this.rolesService.dropdown(query);
  }

  @Get('categories')
  @RequirePermissions(P.RoleRead)
  @ResponseMessage('Role categories')
  @ApiOperation({
    summary: 'Role categories',
    description:
      'Needs ROLE_READ. Built-in categories, then the ones admins added (`isCustom`). `isReserved` categories (SYSTEM) cannot be used for new roles.',
  })
  @ApiWrappedResponse(RoleCategoryDto, { isArray: true })
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN)
  categories(): Promise<RoleCategoryDto[]> {
    return this.rolesService.categories();
  }

  @Post('categories')
  @RequirePermissions(P.RoleCreate)
  @Throttle({ default: ACCESS_ADMIN_THROTTLE })
  @ResponseMessage('Role category added')
  @ApiOperation({
    summary: 'Add a role category',
    description:
      'Needs ROLE_CREATE. The value is made from the label ("Finance team" → FINANCE_TEAM); an existing one with the same value is returned instead of a duplicate.',
  })
  @ApiWrappedResponse(RoleCategoryDto, { status: HttpStatus.CREATED })
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.FORBIDDEN,
  )
  createCategory(
    @Body() dto: CreateRoleCategoryDto,
    @CurrentActor() actor: Actor,
  ): Promise<RoleCategoryDto> {
    return this.rolesService.createCategory(dto.label, actor);
  }

  @Get('next-key')
  @RequirePermissions(P.RoleCreate)
  @Header('Cache-Control', 'no-store')
  @ResponseMessage('Next role key')
  @ApiOperation({
    summary: 'Suggested key for a new role',
    description:
      'Needs ROLE_CREATE. The next free key in the ROLE-NN series (ROLE-01, ROLE-02 …). Any other unique key can still be used.',
  })
  @ApiWrappedResponse(NextRoleKeyDto)
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN)
  nextKey(): Promise<NextRoleKeyDto> {
    return this.rolesService.nextRoleKey();
  }

  @Get('stats')
  @RequirePermissions(P.RoleRead)
  @Header('Cache-Control', 'no-store')
  @ResponseMessage('Role statistics')
  @ApiOperation({
    summary: 'Counts for the roles page',
    description:
      'Needs ROLE_READ. Roles (total / active / custom / built-in / without permissions), permissions (available / in use) and categories.',
  })
  @ApiWrappedResponse(RoleStatsDto)
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN)
  stats(): Promise<RoleStatsDto> {
    return this.rolesService.stats();
  }

  @Get('exists')
  @RequirePermissions(P.RoleRead)
  @ResponseMessage('Role key / name check')
  @ApiOperation({
    summary: 'Check if a role key or name already exists',
    description:
      'Needs ROLE_READ. For live form validation: send roleKey and / or roleName (+ category: names are ' +
      'unique per category). While editing, pass excludeId so the role itself does not count.',
  })
  @ApiWrappedResponse(ExistsResponseDto)
  @ApiErrorResponses(...ERRORS_READ)
  exists(@Query() query: RoleExistsQueryDto): Promise<ExistsResponseDto> {
    return this.rolesService.exists(query);
  }

  @Patch('bulk')
  @RequirePermissions(P.RoleUpdate)
  @Throttle({ default: ACCESS_ADMIN_THROTTLE })
  @ResponseMessage('Roles updated')
  @ApiOperation({
    summary: 'Update several roles at once',
    description:
      'Needs ROLE_UPDATE. Up to 100 `{ id, ...fields, version? }` items. All items are validated first ' +
      '(exists, not a system role, version, duplicates in the database and within the request); if any fails, ' +
      'nothing is changed: 400 BULK_OPERATION_FAILED listing `roles.<index>.<field>`.',
  })
  @ApiWrappedResponse(BulkUpdateRolesResponseDto)
  @ApiErrorResponses(...ERRORS_READ, HttpStatus.CONFLICT)
  bulkUpdate(
    @Body() dto: BulkUpdateRolesDto,
    @CurrentActor() actor: Actor,
  ): Promise<BulkUpdateRolesResponseDto> {
    return this.rolesService.bulkUpdate(dto, actor);
  }

  @Post('setup')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(P.RoleCreate, P.RoleUpdate, P.MappingAssign)
  @Throttle({ default: ACCESS_ADMIN_THROTTLE })
  @ResponseMessage('Role set up')
  @ApiOperation({
    summary: 'Create or update a role with its groups and permissions',
    description:
      'Needs ROLE_CREATE, ROLE_UPDATE and ACCESS_MAPPING_ASSIGN (+ ACCESS_MAPPING_REVOKE with ' +
      '`replaceAssignments`). Matches the role by roleKey: creates it or updates it, then assigns the ' +
      'permissions and groups. Everything is validated before anything is written. `isCreated` tells which.',
  })
  @ApiWrappedResponse(RoleSetupResponseDto)
  @ApiErrorResponses(...ERRORS_READ, HttpStatus.NOT_FOUND, HttpStatus.CONFLICT)
  setup(
    @Body() dto: RoleSetupDto,
    @CurrentActor() actor: Actor,
  ): Promise<RoleSetupResponseDto> {
    return this.roleSetupService.setup(dto, actor);
  }

  @Get('key/:roleKey')
  @RequirePermissions(P.RoleRead)
  @ResponseMessage('Role')
  @ApiOperation({
    summary: 'Get a role by its key',
    description: 'Needs ROLE_READ. Key is case-insensitive (stored uppercase).',
  })
  @ApiWrappedResponse(RoleResponseDto)
  @ApiErrorResponses(...ERRORS_READ, HttpStatus.NOT_FOUND)
  getByKey(
    @Param('roleKey', RoleKeyPipe) roleKey: string,
  ): Promise<RoleResponseDto> {
    return this.rolesService.getByKey(roleKey);
  }

  @Patch('key/:roleKey')
  @RequirePermissions(P.RoleUpdate)
  @Throttle({ default: ACCESS_ADMIN_THROTTLE })
  @ResponseMessage('Role updated')
  @ApiOperation({
    summary: 'Update a role by its key',
    description: 'Needs ROLE_UPDATE. Same rules as PATCH /roles/:id.',
  })
  @ApiWrappedResponse(RoleResponseDto)
  @ApiErrorResponses(...ERRORS_READ, HttpStatus.NOT_FOUND, HttpStatus.CONFLICT)
  async updateByKey(
    @Param('roleKey', RoleKeyPipe) roleKey: string,
    @Body() dto: UpdateRoleDto,
    @CurrentActor() actor: Actor,
  ): Promise<RoleResponseDto> {
    const role = await this.rolesService.findByKeyOrThrow(roleKey);
    return this.rolesService.update(role._id, dto, actor);
  }

  @Delete('key/:roleKey')
  @RequirePermissions(P.RoleDelete)
  @Throttle({ default: ACCESS_ADMIN_THROTTLE })
  @ResponseMessage('Role deleted')
  @ApiOperation({
    summary: 'Delete a role by its key',
    description: 'Needs ROLE_DELETE. Same rules as DELETE /roles/:id.',
  })
  @ApiWrappedResponse(DeletedResponseDto)
  @ApiErrorResponses(...ERRORS_READ, HttpStatus.NOT_FOUND, HttpStatus.CONFLICT)
  async removeByKey(
    @Param('roleKey', RoleKeyPipe) roleKey: string,
    @CurrentActor() actor: Actor,
  ): Promise<DeletedResponseDto> {
    const role = await this.rolesService.findByKeyOrThrow(roleKey);
    return this.rolesService.remove(role._id, actor);
  }

  @Get(':id')
  @RequirePermissions(P.RoleRead)
  @ResponseMessage('Role')
  @ApiOperation({
    summary: 'Get a role',
    description: 'Needs ROLE_READ. Includes permissionCount and groupCount.',
  })
  @ApiWrappedResponse(RoleResponseDto)
  @ApiErrorResponses(...ERRORS_READ, HttpStatus.NOT_FOUND)
  get(@Param('id', ParseIdPipe) id: string): Promise<RoleResponseDto> {
    return this.rolesService.get(id);
  }

  @Patch(':id')
  @RequirePermissions(P.RoleUpdate)
  @Throttle({ default: ACCESS_ADMIN_THROTTLE })
  @ResponseMessage('Role updated')
  @ApiOperation({
    summary: 'Update a role',
    description:
      'Needs ROLE_UPDATE. Send only the fields to change. Send `version` ' +
      'to reject the change if someone else edited the role meanwhile (409 VERSION_CONFLICT). System roles: ' +
      '409 SYSTEM_RESOURCE_PROTECTED.',
  })
  @ApiWrappedResponse(RoleResponseDto)
  @ApiErrorResponses(...ERRORS_READ, HttpStatus.NOT_FOUND, HttpStatus.CONFLICT)
  update(
    @Param('id', ParseIdPipe) id: string,
    @Body() dto: UpdateRoleDto,
    @CurrentActor() actor: Actor,
  ): Promise<RoleResponseDto> {
    return this.rolesService.update(id, dto, actor);
  }

  @Delete(':id')
  @RequirePermissions(P.RoleDelete)
  @Throttle({ default: ACCESS_ADMIN_THROTTLE })
  @ResponseMessage('Role deleted')
  @ApiOperation({
    summary: 'Delete a role',
    description:
      'Needs ROLE_DELETE. Soft delete (the key can be reused). 409 RESOURCE_IN_USE while groups still have the ' +
      'role; its own permission assignments are removed with it. System roles cannot be deleted.',
  })
  @ApiWrappedResponse(DeletedResponseDto)
  @ApiErrorResponses(...ERRORS_READ, HttpStatus.NOT_FOUND, HttpStatus.CONFLICT)
  remove(
    @Param('id', ParseIdPipe) id: string,
    @CurrentActor() actor: Actor,
  ): Promise<DeletedResponseDto> {
    return this.rolesService.remove(id, actor);
  }
}
