import {
  Body,
  Controller,
  Delete,
  Get,
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
import { DropdownOptionDto, OptionDto } from '@common/dto/dropdown.dto';
import { ExistsResponseDto } from '@common/dto/exists.dto';
import type { Paginated } from '@common/interfaces/api-response.interface';
import { ParseIdPipe } from '@common/pipes/parse-id.pipe';

import {
  ACCESS_ADMIN_THROTTLE,
  ACCESS_PERMISSIONS as P,
} from '../constants/access-control.constants';
import { CurrentActor } from '../decorators/current-actor.decorator';
import {
  CreatePermissionDto,
  PermissionDropdownQueryDto,
  PermissionExistsQueryDto,
  PermissionListItemDto,
  PermissionListQueryDto,
  PermissionResponseDto,
  UpdatePermissionDto,
} from '../dto/permission.dto';
import { DeletedResponseDto } from '../dto/role.dto';
import type { Actor } from '../interfaces/actor.interface';
import { PermissionsService } from '../services/permissions.service';

const ERRORS_READ = [
  HttpStatus.BAD_REQUEST,
  HttpStatus.UNAUTHORIZED,
  HttpStatus.FORBIDDEN,
] as const;

@ApiTags(API_TAGS.Permissions.name)
@ApiBearerAuth('access-token')
@ApiStandardErrors()
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Post()
  @RequirePermissions(P.PermissionCreate)
  @Throttle({ default: ACCESS_ADMIN_THROTTLE })
  @ResponseMessage('Permission created')
  @ApiOperation({
    summary: 'Create a permission',
    description:
      'Needs PERMISSION_CREATE. `permissionKey` stored uppercase, unique; `permissionName` unique (case-insensitive). ' +
      '`metadata`: up to 20 `{ key, value, action }` entries with unique keys; actions from GET /permissions/actions.',
  })
  @ApiWrappedResponse(PermissionResponseDto, { status: HttpStatus.CREATED })
  @ApiErrorResponses(...ERRORS_READ, HttpStatus.CONFLICT)
  create(
    @Body() dto: CreatePermissionDto,
    @CurrentActor() actor: Actor,
  ): Promise<PermissionResponseDto> {
    return this.permissionsService.create(dto, actor);
  }

  @Get()
  @RequirePermissions(P.PermissionRead)
  @ResponseMessage('Permissions')
  @ApiOperation({
    summary: 'List permissions',
    description:
      'Needs PERMISSION_READ. Search (key, name, description); filter by metadataKey / metadataValue / action ' +
      '(one metadata entry must match all given), status, created & updated date; sort.',
  })
  @ApiPaginatedResponse(PermissionListItemDto)
  @ApiErrorResponses(...ERRORS_READ)
  list(
    @Query() query: PermissionListQueryDto,
  ): Promise<Paginated<PermissionListItemDto>> {
    return this.permissionsService.list(query);
  }

  @Get('dropdown')
  @RequirePermissions(P.PermissionRead)
  @ResponseMessage('Permission options')
  @ApiOperation({
    summary: 'Permission dropdown',
    description:
      'Needs PERMISSION_READ. Active only; filter by action or module.',
  })
  @ApiWrappedResponse(DropdownOptionDto, { isArray: true })
  @ApiErrorResponses(...ERRORS_READ)
  dropdown(
    @Query() query: PermissionDropdownQueryDto,
  ): Promise<DropdownOptionDto[]> {
    return this.permissionsService.dropdown(query);
  }

  @Get('actions')
  @RequirePermissions(P.PermissionRead)
  @ResponseMessage('Permission actions')
  @ApiOperation({
    summary: 'Supported metadata actions',
    description: 'Needs PERMISSION_READ.',
  })
  @ApiWrappedResponse(OptionDto, { isArray: true })
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN)
  actions() {
    return this.permissionsService.actions();
  }

  @Get('exists')
  @RequirePermissions(P.PermissionRead)
  @ResponseMessage('Permission key / name check')
  @ApiOperation({
    summary: 'Check if a permission key or name already exists',
    description:
      'Needs PERMISSION_READ. For live form validation: `permissionKey` and / or `permissionName`; ' +
      '`excludeId` while editing.',
  })
  @ApiWrappedResponse(ExistsResponseDto)
  @ApiErrorResponses(...ERRORS_READ)
  exists(@Query() query: PermissionExistsQueryDto): Promise<ExistsResponseDto> {
    return this.permissionsService.exists(query);
  }

  @Get(':id')
  @RequirePermissions(P.PermissionRead)
  @ResponseMessage('Permission')
  @ApiOperation({
    summary: 'Get a permission',
    description: 'Needs PERMISSION_READ. Includes roleCount.',
  })
  @ApiWrappedResponse(PermissionResponseDto)
  @ApiErrorResponses(...ERRORS_READ, HttpStatus.NOT_FOUND)
  get(@Param('id', ParseIdPipe) id: string): Promise<PermissionResponseDto> {
    return this.permissionsService.get(id);
  }

  @Patch(':id')
  @RequirePermissions(P.PermissionUpdate)
  @Throttle({ default: ACCESS_ADMIN_THROTTLE })
  @ResponseMessage('Permission updated')
  @ApiOperation({
    summary: 'Update a permission',
    description:
      'Needs PERMISSION_UPDATE. Partial update; `metadata`, when sent, replaces the whole list. Optional `version` ' +
      'for conflict detection. Changes apply to every role that has the permission. System permissions: 409.',
  })
  @ApiWrappedResponse(PermissionResponseDto)
  @ApiErrorResponses(...ERRORS_READ, HttpStatus.NOT_FOUND, HttpStatus.CONFLICT)
  update(
    @Param('id', ParseIdPipe) id: string,
    @Body() dto: UpdatePermissionDto,
    @CurrentActor() actor: Actor,
  ): Promise<PermissionResponseDto> {
    return this.permissionsService.update(id, dto, actor);
  }

  @Delete(':id')
  @RequirePermissions(P.PermissionDelete)
  @Throttle({ default: ACCESS_ADMIN_THROTTLE })
  @ResponseMessage('Permission deleted')
  @ApiOperation({
    summary: 'Delete a permission',
    description:
      'Needs PERMISSION_DELETE. Soft delete. 409 RESOURCE_IN_USE while any role has it.',
  })
  @ApiWrappedResponse(DeletedResponseDto)
  @ApiErrorResponses(...ERRORS_READ, HttpStatus.NOT_FOUND, HttpStatus.CONFLICT)
  remove(
    @Param('id', ParseIdPipe) id: string,
    @CurrentActor() actor: Actor,
  ): Promise<DeletedResponseDto> {
    return this.permissionsService.remove(id, actor);
  }
}
