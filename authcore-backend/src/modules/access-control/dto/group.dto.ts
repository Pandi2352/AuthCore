import {
  ApiProperty,
  ApiPropertyOptional,
  OmitType,
  PartialType,
} from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDefined,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

import { DropdownQueryDto } from '@common/dto/dropdown.dto';
import { ListQueryDto } from '@common/dto/list-query.dto';
import {
  normalizeName,
  parseTags,
  trim,
  trimLower,
  trimUpper,
} from '@common/utils/transform.util';

import {
  DESCRIPTION_MAX_LENGTH,
  GROUP_CATEGORY_VALUES,
  GROUP_ID_MAX_LENGTH,
  GROUP_ID_PATTERN,
  MAX_TAG_LENGTH,
  MAX_TAGS,
  NAME_MAX_LENGTH,
  TAG_PATTERN,
} from '../constants/access-control.constants';
import { RecordStatus, TagMatchMode } from '../enums/access-control.enum';

export const GROUP_SORT_FIELDS = [
  'groupName',
  'groupId',
  'category',
  'level',
  'createdAt',
  'updatedAt',
] as const;

const TAG_MESSAGE =
  "each tag may contain only letters, numbers, '_', '-' and ':'";
const toBoolean = ({ value }: { value: unknown }): unknown =>
  value === 'true' ? true : value === 'false' ? false : value;

export class CreateGroupDto {
  @ApiProperty({
    example: 'DEPARTMENT',
    enum: GROUP_CATEGORY_VALUES,
    description: 'See GET /groups/categories',
  })
  @IsIn(GROUP_CATEGORY_VALUES, {
    message: `category must be one of: ${GROUP_CATEGORY_VALUES.join(', ')}`,
  })
  @Transform(trimUpper)
  @IsString()
  @IsDefined({ message: 'category is required' })
  category!: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: null,
    description:
      'Parent group `id` (from GET /groups/dropdown). Empty / null = main group.',
  })
  @IsUUID('all', { message: 'parentGroupId must be a valid id' })
  @ValidateIf(
    (dto: CreateGroupDto) =>
      dto.parentGroupId !== null && dto.parentGroupId !== undefined,
  )
  @Transform(({ value }: { value: unknown }) =>
    value === ''
      ? null
      : typeof value === 'string'
        ? value.trim().toLowerCase()
        : value,
  )
  parentGroupId?: string | null;

  @ApiPropertyOptional({
    example: 'GRP-DEV',
    description:
      'Unique group ID (stored uppercase; letters, numbers, _ - :). Generated (GRP-XXXXXX) when omitted.',
    maxLength: GROUP_ID_MAX_LENGTH,
  })
  @Matches(GROUP_ID_PATTERN, {
    message: "groupId may contain only letters, numbers, '_', '-' and ':'",
  })
  @MaxLength(GROUP_ID_MAX_LENGTH)
  @MinLength(2)
  @Transform(({ value }: { value: unknown }) =>
    value === '' ? undefined : trimUpper({ value }),
  )
  @IsString()
  @IsOptional()
  groupId?: string;

  @ApiProperty({
    example: 'Development',
    description: 'Unique among groups with the same parent',
    maxLength: NAME_MAX_LENGTH,
  })
  @MaxLength(NAME_MAX_LENGTH)
  @IsNotEmpty({ message: 'groupName is required' })
  @Transform(normalizeName)
  @IsString()
  @IsDefined({ message: 'groupName is required' })
  groupName!: string;

  @ApiPropertyOptional({
    example: 'All engineering teams',
    maxLength: DESCRIPTION_MAX_LENGTH,
  })
  @MaxLength(DESCRIPTION_MAX_LENGTH)
  @Transform(trim)
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    oneOf: [
      { type: 'string', example: 'development, backend, node_js, api-v1' },
      { type: 'array', items: { type: 'string' } },
    ],
    description:
      `Comma-separated string or array. Each tag: letters, numbers, '_', '-', ':' (max ${String(MAX_TAG_LENGTH)} chars, ` +
      `max ${String(MAX_TAGS)} tags). Stored lowercase without duplicates.`,
  })
  @Matches(TAG_PATTERN, { each: true, message: TAG_MESSAGE })
  @MaxLength(MAX_TAG_LENGTH, {
    each: true,
    message: `each tag must be at most ${String(MAX_TAG_LENGTH)} characters`,
  })
  @IsString({ each: true })
  @ArrayMaxSize(MAX_TAGS, { message: `at most ${String(MAX_TAGS)} tags` })
  @IsArray({
    message: 'tags must be a comma-separated string or an array of strings',
  })
  @Transform(parseTags)
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional({ enum: RecordStatus, default: RecordStatus.Active })
  @IsEnum(RecordStatus)
  @IsOptional()
  status?: RecordStatus;

  @ApiPropertyOptional({
    default: false,
    description:
      'Default group: every new user (registration, invite, admin-created) joins it automatically, getting its roles. ' +
      "Needs permission to grant the group's permissions.",
  })
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}

export class UpdateGroupDto extends PartialType(
  OmitType(CreateGroupDto, ['groupId'] as const),
) {
  @ApiPropertyOptional({ example: 'GRP-DEV', maxLength: GROUP_ID_MAX_LENGTH })
  @Matches(GROUP_ID_PATTERN, {
    message: "groupId may contain only letters, numbers, '_', '-' and ':'",
  })
  @MaxLength(GROUP_ID_MAX_LENGTH)
  @MinLength(2)
  @Transform(trimUpper)
  @IsString()
  @IsOptional()
  groupId?: string;

  @ApiPropertyOptional({
    example: 3,
    description:
      'The version you loaded (optional; 409 VERSION_CONFLICT if it changed)',
  })
  @Min(1)
  @IsInt()
  @IsOptional()
  version?: number;
}

export class GroupListQueryDto extends ListQueryDto {
  @ApiPropertyOptional({ enum: GROUP_CATEGORY_VALUES })
  @IsIn(GROUP_CATEGORY_VALUES)
  @Transform(trimUpper)
  @IsOptional()
  category?: string;

  @ApiPropertyOptional({ description: 'Direct children of this group' })
  @IsUUID('all')
  @Transform(trimLower)
  @IsOptional()
  parentGroupId?: string;

  @ApiPropertyOptional({
    enum: ['ROOT', 'CHILD'],
    description: 'ROOT = main groups only, CHILD = sub-groups only',
  })
  @IsIn(['ROOT', 'CHILD'])
  @Transform(trimUpper)
  @IsOptional()
  level?: 'ROOT' | 'CHILD';

  @ApiPropertyOptional({
    example: 'backend,api-v1',
    description: 'Comma-separated tags (exact match, case-insensitive)',
  })
  @Matches(TAG_PATTERN, { each: true, message: TAG_MESSAGE })
  @IsString({ each: true })
  @ArrayMaxSize(MAX_TAGS)
  @IsArray()
  @Transform(parseTags)
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional({
    enum: TagMatchMode,
    default: TagMatchMode.Any,
    description: 'ALL: every tag must match; ANY: at least one',
  })
  @IsEnum(TagMatchMode)
  @Transform(trimUpper)
  @IsOptional()
  tagMode?: TagMatchMode;

  @ApiPropertyOptional({ enum: RecordStatus })
  @IsEnum(RecordStatus)
  @IsOptional()
  status?: RecordStatus;

  @ApiPropertyOptional({
    description: 'Only default groups (true) or only others (false)',
  })
  @IsBoolean()
  @Transform(toBoolean)
  @IsOptional()
  isDefault?: boolean;

  @ApiPropertyOptional({ enum: GROUP_SORT_FIELDS, default: 'updatedAt' })
  @IsIn(GROUP_SORT_FIELDS)
  @IsOptional()
  sortBy?: (typeof GROUP_SORT_FIELDS)[number];
}

export class GroupDropdownQueryDto extends DropdownQueryDto {
  @ApiPropertyOptional({
    description:
      'Add `path` (e.g. "Development / Backend Team") to every option',
  })
  @IsBoolean()
  @Transform(toBoolean)
  @IsOptional()
  withPath?: boolean;

  @ApiPropertyOptional({ enum: GROUP_CATEGORY_VALUES })
  @IsIn(GROUP_CATEGORY_VALUES)
  @Transform(trimUpper)
  @IsOptional()
  category?: string;

  @ApiPropertyOptional({
    description: 'Only direct children of this group (nested dropdowns)',
  })
  @IsUUID('all')
  @Transform(trimLower)
  @IsOptional()
  parentGroupId?: string;

  @ApiPropertyOptional({ description: 'Main groups only' })
  @IsBoolean()
  @Transform(toBoolean)
  @IsOptional()
  rootOnly?: boolean;

  @ApiPropertyOptional({
    description:
      'Parent selection while editing: excludes this group and all its sub-groups (they would create a cycle)',
  })
  @IsUUID('all')
  @Transform(trimLower)
  @IsOptional()
  excludeId?: string;
}

export class GroupRefDto {
  @ApiProperty({ example: '01a1e31b-d536-7092-8577-df304d74a00e' })
  id!: string;

  @ApiProperty({ example: 'GRP-DEV' })
  groupId!: string;

  @ApiProperty({ example: 'Development' })
  groupName!: string;
}

export class GroupListItemDto {
  @ApiProperty({ example: '01a1e31b-d536-7092-8577-df304d74a00e' })
  id!: string;

  @ApiProperty({ example: 'GRP-BACKEND' })
  groupId!: string;

  @ApiProperty({ example: 'Backend Team' })
  groupName!: string;

  @ApiProperty({ example: 'TEAM' })
  category!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: '01a1e31b-0000-7000-8000-000000000001',
  })
  parentGroupId!: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'Development' })
  parentGroupName!: string | null;

  @ApiProperty({ example: 1, description: '0 = main group' })
  level!: number;

  @ApiProperty({ example: 'Node.js services' })
  description!: string;

  @ApiProperty({ type: [String], example: ['backend', 'node_js'] })
  tags!: string[];

  @ApiProperty({ enum: RecordStatus, example: RecordStatus.Active })
  status!: RecordStatus;

  @ApiProperty({
    example: false,
    description: 'New users join it automatically',
  })
  isDefault!: boolean;

  @ApiProperty({ example: '2026-11-16T05:30:00.000Z' })
  updatedAt!: Date;
}

export class GroupResponseDto extends GroupListItemDto {
  @ApiProperty({ type: GroupRefDto, nullable: true })
  parent!: GroupRefDto | null;

  @ApiProperty({
    type: [GroupRefDto],
    description: 'Main group first, down to the parent',
  })
  path!: GroupRefDto[];

  @ApiProperty({ example: false })
  isSystem!: boolean;

  @ApiProperty({ example: 1 })
  version!: number;

  @ApiProperty({ example: '01a1e31b-d536-7092-8577-df304d74a00e' })
  createdBy!: string;

  @ApiProperty({ example: '01a1e31b-d536-7092-8577-df304d74a00e' })
  updatedBy!: string;

  @ApiProperty({ example: '2026-11-16T05:30:00.000Z' })
  createdAt!: Date;

  @ApiPropertyOptional({
    example: 2,
    description: 'Details only: direct sub-groups',
  })
  childCount?: number;

  @ApiPropertyOptional({
    example: 12,
    description: 'Details only: users in the group',
  })
  memberCount?: number;

  @ApiPropertyOptional({
    example: 3,
    description: 'Details only: roles assigned to the group',
  })
  roleCount?: number;

  @ApiPropertyOptional({
    type: () => [GroupRoleRefDto],
    description: 'Details only: the roles assigned to the group',
  })
  roles?: GroupRoleRefDto[];
}

export class GroupRoleRefDto {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'HR_MANAGER' }) roleKey!: string;
  @ApiProperty({ example: 'HR Manager' }) roleName!: string;
  @ApiProperty({ enum: RecordStatus }) status!: RecordStatus;
}

/** GET /groups/tree */
export class GroupTreeQueryDto {
  @ApiPropertyOptional({
    enum: GROUP_CATEGORY_VALUES,
    description:
      'Only groups of this category (a group whose parent is in another category becomes a top node)',
  })
  @IsIn(GROUP_CATEGORY_VALUES)
  @Transform(trimUpper)
  @IsOptional()
  category?: string;

  @ApiPropertyOptional({
    description: 'Only this group and everything below it',
  })
  @IsUUID('all')
  @Transform(trimLower)
  @IsOptional()
  rootId?: string;

  @ApiPropertyOptional({
    minimum: 0,
    maximum: 10,
    description: 'Levels below the top to include (default: all)',
  })
  @Max(10)
  @Min(0)
  @IsInt()
  @Type(() => Number)
  @IsOptional()
  maxDepth?: number;

  @ApiPropertyOptional({
    enum: RecordStatus,
    description: 'Default: all statuses',
  })
  @IsEnum(RecordStatus)
  @IsOptional()
  status?: RecordStatus;

  @ApiPropertyOptional({
    description: 'Add memberCount and roleCount to every node',
  })
  @IsBoolean()
  @Transform(toBoolean)
  @IsOptional()
  withCounts?: boolean;
}

export class GroupTreeNodeDto {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'GRP-DEV' }) groupId!: string;
  @ApiProperty({ example: 'Development' }) groupName!: string;
  @ApiProperty({ example: 'DEPARTMENT' }) category!: string;
  @ApiProperty({ type: String, nullable: true }) parentGroupId!: string | null;
  @ApiProperty({ example: 0 }) level!: number;
  @ApiProperty({ enum: RecordStatus }) status!: RecordStatus;
  @ApiProperty({ type: [String] }) tags!: string[];
  @ApiPropertyOptional({ example: 12 }) memberCount?: number;
  @ApiPropertyOptional({ example: 2 }) roleCount?: number;
  @ApiProperty({ type: () => [GroupTreeNodeDto] })
  children!: GroupTreeNodeDto[];
}

/** Optional category constraint for lookups (by code, permission matrix). */
export class GroupCategoryQueryDto {
  @ApiPropertyOptional({
    enum: GROUP_CATEGORY_VALUES,
    description: 'The group must be in this category (404 otherwise)',
  })
  @IsIn(GROUP_CATEGORY_VALUES)
  @Transform(trimUpper)
  @IsOptional()
  category?: string;
}

/** GET /groups/exists */
export class GroupExistsQueryDto {
  @ApiPropertyOptional({ example: 'GRP-DEV' })
  @MaxLength(GROUP_ID_MAX_LENGTH)
  @Transform(({ value }: { value: unknown }) =>
    value === '' ? undefined : trimUpper({ value }),
  )
  @IsString()
  @IsOptional()
  groupId?: string;

  @ApiPropertyOptional({
    example: 'Backend Team',
    description:
      'Checked among the children of parentGroupId (among main groups when empty)',
  })
  @MaxLength(NAME_MAX_LENGTH)
  @Transform(normalizeName)
  @IsString()
  @IsOptional()
  groupName?: string;

  @ApiPropertyOptional()
  @IsUUID('all')
  @Transform(trimLower)
  @IsOptional()
  parentGroupId?: string;

  @ApiPropertyOptional({ description: 'Editing: ignore this group id' })
  @IsUUID('all')
  @Transform(trimLower)
  @IsOptional()
  excludeId?: string;
}

export class MatrixRoleDto extends GroupRoleRefDto {
  @ApiProperty({
    example: false,
    description: 'true: from a parent group (ACCESS_INHERIT_PARENT_GROUPS)',
  })
  isInherited!: boolean;

  @ApiProperty({ description: 'The group the role is assigned to' })
  viaGroupId!: string;
}

export class MatrixPermissionDto {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'USER_CREATE' }) permissionKey!: string;
  @ApiProperty({ example: 'Create User' }) permissionName!: string;
  @ApiProperty({ type: [String], example: ['users'] }) modules!: string[];
  @ApiProperty({ type: [String], example: ['CREATE'] }) actions!: string[];
  @ApiProperty({
    type: [String],
    description: 'Role ids (matrix columns) that grant this permission',
  })
  grantedByRoleIds!: string[];
}

export class MatrixModuleRowDto {
  @ApiProperty({
    example: 'users',
    description: 'metadata "module" value ("general" when none)',
  })
  module!: string;

  @ApiProperty({
    type: Object,
    example: { CREATE: true, READ: true, UPDATE: false, DELETE: false },
  })
  actions!: Record<string, boolean>;
}

export class PermissionMatrixDto {
  @ApiProperty({ type: GroupRefDto }) group!: GroupRefDto;
  @ApiProperty({ example: 'TEAM' }) category!: string;
  @ApiProperty({
    type: [String],
    description: 'Columns of the module grid',
    example: ['CREATE', 'READ', 'UPDATE', 'DELETE'],
  })
  actions!: string[];
  @ApiProperty({
    type: [MatrixRoleDto],
    description: 'Active roles of the group',
  })
  roles!: MatrixRoleDto[];
  @ApiProperty({
    type: [MatrixPermissionDto],
    description: 'Permissions × roles',
  })
  permissions!: MatrixPermissionDto[];
  @ApiProperty({
    type: [MatrixModuleRowDto],
    description: 'Module × action grid',
  })
  modules!: MatrixModuleRowDto[];
}

export class GroupChildrenQueryDto {
  @ApiPropertyOptional({
    description: 'Include all levels below (default: direct children only)',
  })
  @IsBoolean()
  @Transform(toBoolean)
  @IsOptional()
  recursive?: boolean;

  @ApiPropertyOptional({ enum: RecordStatus })
  @IsEnum(RecordStatus)
  @IsOptional()
  status?: RecordStatus;
}
