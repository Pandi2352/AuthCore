import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
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
  CreateGroupCategoryDto,
  CreateGroupDto,
  GroupCategoryDto,
  GroupCategoryQueryDto,
  GroupChildrenQueryDto,
  GroupDropdownQueryDto,
  GroupExistsQueryDto,
  GroupListItemDto,
  GroupListQueryDto,
  GroupResponseDto,
  GroupStatsDto,
  GroupTreeNodeDto,
  GroupTreeQueryDto,
  NextGroupIdDto,
  PermissionMatrixDto,
  UpdateGroupDto,
} from '../dto/group.dto';
import { DeletedResponseDto } from '../dto/role.dto';
import type { Actor } from '../interfaces/actor.interface';
import { GroupCodePipe } from '../pipes/group-code.pipe';
import { GroupsService } from '../services/groups.service';

const ERRORS_READ = [
  HttpStatus.BAD_REQUEST,
  HttpStatus.UNAUTHORIZED,
  HttpStatus.FORBIDDEN,
] as const;

@ApiTags(API_TAGS.Groups.name)
@ApiBearerAuth('access-token')
@ApiStandardErrors()
@Controller('groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Post()
  @RequirePermissions(P.GroupCreate)
  @Throttle({ default: ACCESS_ADMIN_THROTTLE })
  @ResponseMessage('Group created')
  @ApiOperation({
    summary: 'Create a group or sub-group',
    description:
      'Needs GROUP_CREATE. No `parentGroupId` = main group. `groupId` is optional (default: the next GRP-NN, see GET /groups/next-id). ' +
      'Tags: comma-separated string or array; letters, numbers, `_ - :` only. Name unique among siblings. ' +
      'Max nesting 10 levels.',
  })
  @ApiWrappedResponse(GroupResponseDto, { status: HttpStatus.CREATED })
  @ApiErrorResponses(...ERRORS_READ, HttpStatus.NOT_FOUND, HttpStatus.CONFLICT)
  create(
    @Body() dto: CreateGroupDto,
    @CurrentActor() actor: Actor,
  ): Promise<GroupResponseDto> {
    return this.groupsService.create(dto, actor);
  }

  @Get()
  @RequirePermissions(P.GroupRead)
  @ResponseMessage('Groups')
  @ApiOperation({
    summary: 'List groups',
    description:
      'Needs GROUP_READ. Search (name, group ID, description, tags); filter by category, parent, level ' +
      '(ROOT / CHILD), tags (`tags=a,b` with tagMode ANY or ALL), created & updated date; sort.',
  })
  @ApiPaginatedResponse(GroupListItemDto)
  @ApiErrorResponses(...ERRORS_READ)
  list(
    @Query() query: GroupListQueryDto,
  ): Promise<Paginated<GroupListItemDto>> {
    return this.groupsService.list(query);
  }

  @Get('dropdown')
  @RequirePermissions(P.GroupRead)
  @ResponseMessage('Group options')
  @ApiOperation({
    summary: 'Group dropdown (also parent selection)',
    description:
      'Needs GROUP_READ. Active groups: `{ id, label, key, parentId }`. For the parent field while editing, ' +
      'pass `excludeId=<group>`: the group and its sub-groups are left out. `rootOnly`, `parentGroupId` ' +
      '(nested selects), `category`, `search`.',
  })
  @ApiWrappedResponse(DropdownOptionDto, { isArray: true })
  @ApiErrorResponses(...ERRORS_READ)
  dropdown(
    @Query() query: GroupDropdownQueryDto,
  ): Promise<DropdownOptionDto[]> {
    return this.groupsService.dropdown(query);
  }

  @Get('categories')
  @RequirePermissions(P.GroupRead)
  @ResponseMessage('Group categories')
  @ApiOperation({
    summary: 'Group categories',
    description:
      'Needs GROUP_READ. Built-in categories, then the ones admins added (`isCustom`).',
  })
  @ApiWrappedResponse(GroupCategoryDto, { isArray: true })
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN)
  categories(): Promise<GroupCategoryDto[]> {
    return this.groupsService.categories();
  }

  @Post('categories')
  @RequirePermissions(P.GroupCreate)
  @Throttle({ default: ACCESS_ADMIN_THROTTLE })
  @ResponseMessage('Group category added')
  @ApiOperation({
    summary: 'Add a group category',
    description:
      'Needs GROUP_CREATE. The value is made from the label ("Field teams" → FIELD_TEAMS); an existing one with the same value is returned instead of a duplicate.',
  })
  @ApiWrappedResponse(GroupCategoryDto, { status: HttpStatus.CREATED })
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.FORBIDDEN,
  )
  createCategory(
    @Body() dto: CreateGroupCategoryDto,
    @CurrentActor() actor: Actor,
  ): Promise<GroupCategoryDto> {
    return this.groupsService.createCategory(dto.label, actor);
  }

  @Get('next-id')
  @RequirePermissions(P.GroupCreate)
  @Header('Cache-Control', 'no-store')
  @ResponseMessage('Next group ID')
  @ApiOperation({
    summary: 'Suggested ID for a new group',
    description:
      'Needs GROUP_CREATE. The next free ID in the GRP-NN series (GRP-01, GRP-02 …). Any other unique ID can still be used.',
  })
  @ApiWrappedResponse(NextGroupIdDto)
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN)
  nextId(): Promise<NextGroupIdDto> {
    return this.groupsService.nextGroupId();
  }

  @Get('stats')
  @RequirePermissions(P.GroupRead)
  @Header('Cache-Control', 'no-store')
  @ResponseMessage('Group statistics')
  @ApiOperation({
    summary: 'Counts for the groups page',
    description:
      'Needs GROUP_READ. Groups (total / top-level / sub-groups / with roles / without members / default), members and categories.',
  })
  @ApiWrappedResponse(GroupStatsDto)
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN)
  stats(): Promise<GroupStatsDto> {
    return this.groupsService.stats();
  }

  @Get('tree')
  @RequirePermissions(P.GroupRead)
  @ResponseMessage('Group tree')
  @ApiOperation({
    summary: 'Group hierarchy as a tree',
    description:
      'Needs GROUP_READ. Main groups with their sub-groups nested in `children` (sorted by name). Filters: ' +
      '`category`, `rootId` (one sub-tree), `maxDepth`; `withCounts=true` adds memberCount / roleCount.',
  })
  @ApiWrappedResponse(GroupTreeNodeDto, { isArray: true })
  @ApiErrorResponses(...ERRORS_READ, HttpStatus.NOT_FOUND)
  tree(@Query() query: GroupTreeQueryDto): Promise<GroupTreeNodeDto[]> {
    return this.groupsService.tree(query);
  }

  @Get('exists')
  @RequirePermissions(P.GroupRead)
  @ResponseMessage('Group ID / name check')
  @ApiOperation({
    summary: 'Check if a group ID or name already exists',
    description:
      'Needs GROUP_READ. For live form validation: `groupId` and / or `groupName` (+ `parentGroupId`: names are ' +
      'unique among siblings). While editing, pass `excludeId`.',
  })
  @ApiWrappedResponse(ExistsResponseDto)
  @ApiErrorResponses(...ERRORS_READ)
  exists(@Query() query: GroupExistsQueryDto): Promise<ExistsResponseDto> {
    return this.groupsService.exists(query);
  }

  @Get('code/:groupCode')
  @RequirePermissions(P.GroupRead)
  @ResponseMessage('Group')
  @ApiOperation({
    summary: 'Get a group by its group ID',
    description:
      'Needs GROUP_READ. By the business group ID (e.g. GRP-DEV, case-insensitive), optionally only within ' +
      '`category`. Same details as GET /groups/:id (path, counts, roles).',
  })
  @ApiWrappedResponse(GroupResponseDto)
  @ApiErrorResponses(...ERRORS_READ, HttpStatus.NOT_FOUND)
  getByCode(
    @Param('groupCode', GroupCodePipe) groupCode: string,
    @Query() query: GroupCategoryQueryDto,
  ): Promise<GroupResponseDto> {
    return this.groupsService.getByCode(groupCode, query.category);
  }

  @Get(':id/permission-matrix')
  @RequirePermissions(P.GroupRead, P.MappingRead)
  @ResponseMessage('Group permission matrix')
  @ApiOperation({
    summary: 'Permission matrix of a group',
    description:
      "Needs GROUP_READ and ACCESS_MAPPING_READ. Roles of the group (columns; parent groups' roles too when " +
      'ACCESS_INHERIT_PARENT_GROUPS=true, marked isInherited), the permissions they grant (rows, with ' +
      'grantedByRoleIds), and a module × action grid from the permission metadata. Optional `category`: the ' +
      'group must be in it.',
  })
  @ApiWrappedResponse(PermissionMatrixDto)
  @ApiErrorResponses(...ERRORS_READ, HttpStatus.NOT_FOUND)
  permissionMatrix(
    @Param('id', ParseIdPipe) id: string,
    @Query() query: GroupCategoryQueryDto,
  ): Promise<PermissionMatrixDto> {
    return this.groupsService.permissionMatrix(id, query.category);
  }

  @Get(':id')
  @RequirePermissions(P.GroupRead)
  @ResponseMessage('Group')
  @ApiOperation({
    summary: 'Get a group',
    description:
      'Needs GROUP_READ. With parent, path from the main group, child / member / role counts.',
  })
  @ApiWrappedResponse(GroupResponseDto)
  @ApiErrorResponses(...ERRORS_READ, HttpStatus.NOT_FOUND)
  get(@Param('id', ParseIdPipe) id: string): Promise<GroupResponseDto> {
    return this.groupsService.get(id);
  }

  @Get(':id/children')
  @RequirePermissions(P.GroupRead)
  @ResponseMessage('Sub-groups')
  @ApiOperation({
    summary: 'Sub-groups of a group',
    description:
      'Needs GROUP_READ. Direct children, or the whole subtree with `recursive=true`.',
  })
  @ApiWrappedResponse(GroupListItemDto, { isArray: true })
  @ApiErrorResponses(...ERRORS_READ, HttpStatus.NOT_FOUND)
  children(
    @Param('id', ParseIdPipe) id: string,
    @Query() query: GroupChildrenQueryDto,
  ): Promise<GroupListItemDto[]> {
    return this.groupsService.children(id, query);
  }

  @Patch(':id')
  @RequirePermissions(P.GroupUpdate)
  @Throttle({ default: ACCESS_ADMIN_THROTTLE })
  @ResponseMessage('Group updated')
  @ApiOperation({
    summary: 'Update or move a group',
    description:
      'Needs GROUP_UPDATE. Partial update. `parentGroupId` moves the group with all its sub-groups ' +
      '(null = make it a main group). 400 INVALID_GROUP_HIERARCHY: own parent, under its own sub-group, too deep. ' +
      'Optional `version` for conflict detection.',
  })
  @ApiWrappedResponse(GroupResponseDto)
  @ApiErrorResponses(...ERRORS_READ, HttpStatus.NOT_FOUND, HttpStatus.CONFLICT)
  update(
    @Param('id', ParseIdPipe) id: string,
    @Body() dto: UpdateGroupDto,
    @CurrentActor() actor: Actor,
  ): Promise<GroupResponseDto> {
    return this.groupsService.update(id, dto, actor);
  }

  @Delete(':id')
  @RequirePermissions(P.GroupDelete)
  @Throttle({ default: ACCESS_ADMIN_THROTTLE })
  @ResponseMessage('Group deleted')
  @ApiOperation({
    summary: 'Delete a group',
    description:
      'Needs GROUP_DELETE. Soft delete. 409 RESOURCE_IN_USE while it has sub-groups or members; its role ' +
      'assignments are removed with it.',
  })
  @ApiWrappedResponse(DeletedResponseDto)
  @ApiErrorResponses(...ERRORS_READ, HttpStatus.NOT_FOUND, HttpStatus.CONFLICT)
  remove(
    @Param('id', ParseIdPipe) id: string,
    @CurrentActor() actor: Actor,
  ): Promise<DeletedResponseDto> {
    return this.groupsService.remove(id, actor);
  }
}
