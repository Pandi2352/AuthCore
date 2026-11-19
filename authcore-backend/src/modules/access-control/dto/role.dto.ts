import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDefined,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

import { DropdownQueryDto } from '@common/dto/dropdown.dto';
import { ListQueryDto } from '@common/dto/list-query.dto';
import {
  normalizeName,
  trim,
  trimLower,
  trimOrUndefined,
  trimUpper,
} from '@common/utils/transform.util';

import {
  CATEGORY_LABEL_MAX_LENGTH,
  CATEGORY_VALUE_PATTERN,
  DESCRIPTION_MAX_LENGTH,
  MAX_BULK_ITEMS,
  NAME_MAX_LENGTH,
  ROLE_KEY_MAX_LENGTH,
  ROLE_KEY_PATTERN,
} from '../constants/access-control.constants';

export const ROLE_SORT_FIELDS = [
  'roleName',
  'roleKey',
  'category',
  'createdAt',
  'updatedAt',
] as const;

export class CreateRoleDto {
  @ApiProperty({
    example: 'ROLE-01',
    description:
      'Unique key. Stored uppercase; letters, digits, _ and - (starts with a letter). GET /roles/next-key suggests the next ROLE-NN.',
    maxLength: ROLE_KEY_MAX_LENGTH,
  })
  @Matches(ROLE_KEY_PATTERN, {
    message:
      'roleKey may contain only letters, digits, _ and - and must start with a letter',
  })
  @MaxLength(ROLE_KEY_MAX_LENGTH)
  @MinLength(2)
  @Transform(trimUpper)
  @IsString()
  @IsDefined({ message: 'roleKey is required' })
  roleKey!: string;

  @ApiProperty({
    example: 'HR Manager',
    description: 'Unique within its category (case-insensitive)',
    maxLength: NAME_MAX_LENGTH,
  })
  @MaxLength(NAME_MAX_LENGTH)
  @IsNotEmpty({ message: 'roleName is required' })
  @Transform(normalizeName)
  @IsString()
  @IsDefined({ message: 'roleName is required' })
  roleName!: string;

  @ApiProperty({
    example: 'MANAGEMENT',
    description:
      'A value from GET /roles/categories (built-in or added with POST /roles/categories; SYSTEM is reserved)',
  })
  @Matches(CATEGORY_VALUE_PATTERN, {
    message: 'category must be a category value, e.g. MANAGEMENT',
  })
  @Transform(trimUpper)
  @IsString()
  @IsDefined({ message: 'category is required' })
  category!: string;

  @ApiPropertyOptional({
    example: 'Manages HR staff and approves leave',
    maxLength: DESCRIPTION_MAX_LENGTH,
  })
  @MaxLength(DESCRIPTION_MAX_LENGTH)
  @Transform(trim)
  @IsString()
  @IsOptional()
  description?: string;
}

export class UpdateRoleDto extends PartialType(CreateRoleDto) {
  @ApiPropertyOptional({
    example: 3,
    description:
      'The version you loaded. If the role changed since, 409 VERSION_CONFLICT (optional).',
  })
  @Min(1)
  @IsInt()
  @IsOptional()
  version?: number;
}

export class RoleListQueryDto extends ListQueryDto {
  @ApiPropertyOptional({ example: 'MANAGEMENT' })
  @Matches(CATEGORY_VALUE_PATTERN)
  @Transform(trimUpper)
  @IsOptional()
  category?: string;

  @ApiPropertyOptional({ enum: ROLE_SORT_FIELDS, default: 'updatedAt' })
  @IsIn(ROLE_SORT_FIELDS)
  @IsOptional()
  sortBy?: (typeof ROLE_SORT_FIELDS)[number];
}

export class RoleDropdownQueryDto extends DropdownQueryDto {
  @ApiPropertyOptional({ example: 'MANAGEMENT' })
  @Matches(CATEGORY_VALUE_PATTERN)
  @Transform(trimUpper)
  @IsOptional()
  category?: string;
}

export class RoleListItemDto {
  @ApiProperty({ example: '01a1e31b-d536-7092-8577-df304d74a00e' })
  id!: string;

  @ApiProperty({ example: 'HR_MANAGER' })
  roleKey!: string;

  @ApiProperty({ example: 'HR Manager' })
  roleName!: string;

  @ApiProperty({ example: 'MANAGEMENT' })
  category!: string;

  @ApiProperty({ example: 'Manages HR staff and approves leave' })
  description!: string;

  @ApiProperty({ example: false })
  isSystem!: boolean;

  @ApiProperty({
    example: '2026-11-16T05:30:00.000Z',
    description: 'Updated on',
  })
  updatedAt!: Date;

  @ApiPropertyOptional({
    example: 12,
    description: 'Permissions assigned to the role (list and details)',
  })
  permissionCount?: number;
}

export class RoleResponseDto extends RoleListItemDto {
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
    description: 'Details only: groups the role is assigned to',
  })
  groupCount?: number;
}

/** Shared by every delete endpoint. */
export class DeletedResponseDto {
  @ApiProperty({ example: '01a1e31b-d536-7092-8577-df304d74a00e' })
  id!: string;

  @ApiProperty({ example: '2026-11-16T05:30:00.000Z' })
  deletedAt!: Date;
}

const lowerIds = ({ value }: { value: unknown }): unknown =>
  Array.isArray(value)
    ? (value as unknown[]).map((v: unknown) =>
        typeof v === 'string' ? v.trim().toLowerCase() : v,
      )
    : value;

/** GET /roles/exists: is this key / name already taken? */
export class RoleExistsQueryDto {
  @ApiPropertyOptional({ example: 'HR_MANAGER' })
  @MaxLength(ROLE_KEY_MAX_LENGTH)
  @Transform(({ value }: { value: unknown }) =>
    trimUpper({ value: trimOrUndefined({ value }) }),
  )
  @IsString()
  @IsOptional()
  roleKey?: string;

  @ApiPropertyOptional({
    example: 'HR Manager',
    description: 'Checked within `category` (required with roleName)',
  })
  @MaxLength(NAME_MAX_LENGTH)
  @Transform(normalizeName)
  @IsString()
  @IsOptional()
  roleName?: string;

  @ApiPropertyOptional({ example: 'MANAGEMENT' })
  @Matches(CATEGORY_VALUE_PATTERN)
  @Transform(trimUpper)
  @IsOptional()
  category?: string;

  @ApiPropertyOptional({ description: 'Editing: ignore this role id' })
  @IsUUID('all')
  @Transform(trimLower)
  @IsOptional()
  excludeId?: string;
}

export class BulkRoleItemDto extends UpdateRoleDto {
  @ApiProperty({ example: '01a1e31b-d536-7092-8577-df304d74a00e' })
  @IsUUID('all', { message: 'id must be a valid id' })
  @Transform(trimLower)
  @IsString()
  @IsDefined({ message: 'id is required' })
  id!: string;
}

/** PATCH /roles/bulk: several role updates, all validated before any is applied. */
export class BulkUpdateRolesDto {
  @ApiProperty({
    type: [BulkRoleItemDto],
    maxItems: MAX_BULK_ITEMS,
    example: [
      { id: '01a1e31b-d536-7092-8577-df304d74a00e', category: 'SUPPORT' },
      {
        id: '01a1e31b-d536-7092-8577-df304d74a00f',
        description: 'Updated',
        version: 2,
      },
    ],
  })
  @ValidateNested({ each: true })
  @Type(() => BulkRoleItemDto)
  @ArrayMaxSize(MAX_BULK_ITEMS)
  @ArrayMinSize(1, { message: 'roles must contain at least one item' })
  @IsArray()
  @IsDefined({ message: 'roles is required' })
  roles!: BulkRoleItemDto[];
}

export class BulkUpdateRolesResponseDto {
  @ApiProperty({ example: 2 })
  updatedCount!: number;

  @ApiProperty({ type: [String], description: 'Ids with nothing to change' })
  unchangedIds!: string[];

  @ApiProperty({ type: [RoleListItemDto] })
  roles!: RoleListItemDto[];
}

/**
 * POST /roles/setup: create the role (or update it, matched by roleKey) and
 * assign it to groups and permissions in one call.
 */
export class RoleSetupDto extends CreateRoleDto {
  @ApiPropertyOptional({
    type: [String],
    description: 'Groups that get this role',
    maxItems: MAX_BULK_ITEMS,
  })
  @IsUUID('all', { each: true, message: 'each groupId must be a valid id' })
  @ArrayUnique()
  @ArrayMaxSize(MAX_BULK_ITEMS)
  @IsArray()
  @Transform(lowerIds)
  @IsOptional()
  groupIds?: string[];

  @ApiPropertyOptional({
    type: [String],
    description: 'Permissions the role grants',
    maxItems: MAX_BULK_ITEMS,
  })
  @IsUUID('all', {
    each: true,
    message: 'each permissionId must be a valid id',
  })
  @ArrayUnique()
  @ArrayMaxSize(MAX_BULK_ITEMS)
  @IsArray()
  @Transform(lowerIds)
  @IsOptional()
  permissionIds?: string[];

  @ApiPropertyOptional({
    default: false,
    description:
      'true: groupIds / permissionIds become the complete lists (others are removed); false: only added',
  })
  @IsBoolean()
  @IsOptional()
  replaceAssignments?: boolean;
}

export class RoleSetupResponseDto {
  @ApiProperty({ type: RoleResponseDto })
  role!: RoleResponseDto;

  @ApiProperty({
    example: true,
    description: 'false when an existing role (same roleKey) was updated',
  })
  isCreated!: boolean;

  @ApiProperty({ example: 2 })
  groupsAssigned!: number;

  @ApiProperty({ example: 0 })
  groupsRemoved!: number;

  @ApiProperty({ example: 3 })
  permissionsAssigned!: number;

  @ApiProperty({ example: 0 })
  permissionsRemoved!: number;
}

export class RoleGroupRefDto {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'GRP-DEV' }) groupId!: string;
  @ApiProperty({ example: 'Development' }) groupName!: string;
}

export class RoleCategoryDto {
  @ApiProperty({ example: 'MANAGEMENT' }) value!: string;
  @ApiProperty({ example: 'Management' }) label!: string;
  @ApiProperty({ description: 'SYSTEM: only built-in roles use it' })
  isReserved!: boolean;
  @ApiProperty({ description: 'Added by an admin (not built in)' })
  isCustom!: boolean;
}

export class CreateRoleCategoryDto {
  @ApiProperty({
    example: 'Finance team',
    maxLength: CATEGORY_LABEL_MAX_LENGTH,
  })
  @MaxLength(CATEGORY_LABEL_MAX_LENGTH)
  @IsNotEmpty({ message: 'label is required' })
  @Transform(normalizeName)
  @IsString()
  @IsDefined({ message: 'label is required' })
  label!: string;
}

export class NextRoleKeyDto {
  @ApiProperty({
    example: 'ROLE-07',
    description: 'The next free key in the ROLE-NN series',
  })
  roleKey!: string;
}

export class RoleStatsDto {
  @ApiProperty({ example: 14 }) totalRoles!: number;
  @ApiProperty({ example: 6, description: 'Given to at least one group' })
  rolesInUse!: number;
  @ApiProperty({ example: 9, description: 'Created by admins' })
  customRoles!: number;
  @ApiProperty({ example: 5, description: 'Built in (fixed)' })
  systemRoles!: number;
  @ApiProperty({
    example: 41,
    description: 'Active permissions that can be granted',
  })
  totalPermissions!: number;
  @ApiProperty({
    example: 27,
    description: 'Permissions granted by at least one role',
  })
  permissionsInUse!: number;
  @ApiProperty({ example: 2, description: 'Roles that grant nothing yet' })
  rolesWithoutPermissions!: number;
  @ApiProperty({ example: 8, description: 'Built-in + custom categories' })
  categories!: number;
}
