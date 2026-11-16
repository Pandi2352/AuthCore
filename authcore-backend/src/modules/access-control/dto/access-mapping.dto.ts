import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsDate,
  IsDefined,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';

import { IsFutureDate } from '@common/decorators/is-future-date.decorator';
import { PaginationQueryDto } from '@common/dto/pagination-query.dto';
import {
  trimLower,
  trimOrUndefined,
  trimUpper,
} from '@common/utils/transform.util';

import { MAX_BULK_ITEMS } from '../constants/access-control.constants';
import {
  AuditAction,
  AuditEntity,
  MappingType,
} from '../enums/access-control.enum';

const lowerIds = ({ value }: { value: unknown }): unknown =>
  Array.isArray(value)
    ? (value as unknown[]).map((v: unknown) =>
        typeof v === 'string' ? v.trim().toLowerCase() : v,
      )
    : value;

function IdList(field: string) {
  return function decorate(target: object, property: string): void {
    // Registered basic-first: with stopAtFirstError the first rule registered runs first.
    for (const decorator of [
      IsDefined({ message: `${field}s is required` }),
      Transform(lowerIds),
      IsArray({ message: `${field}s must be an array of ids` }),
      ArrayMinSize(1, { message: `${field}s must contain at least one id` }),
      ArrayMaxSize(MAX_BULK_ITEMS, {
        message: `at most ${String(MAX_BULK_ITEMS)} ${field}s per request`,
      }),
      ArrayUnique({ message: `${field}s must not contain duplicates` }),
      IsUUID('all', {
        each: true,
        message: `each ${field} must be a valid id`,
      }),
    ]) {
      decorator(target, property);
    }
  };
}

function SingleId(field: string) {
  return function decorate(target: object, property: string): void {
    // Registered basic-first: with stopAtFirstError the first rule registered runs first.
    for (const decorator of [
      IsDefined({ message: `${field} is required` }),
      IsString(),
      Transform(trimLower),
      IsUUID('all', { message: `${field} must be a valid id` }),
    ]) {
      decorator(target, property);
    }
  };
}

export class GroupUsersDto {
  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    nullable: true,
    example: '2027-01-31T00:00:00.000Z',
    description:
      'Optional end date for new assignments (must be in the future); ignored when removing',
  })
  @IsFutureDate()
  @IsDate()
  @Type(() => Date)
  @IsOptional()
  expiresAt?: Date;

  @ApiProperty({ example: '01a1e31b-d536-7092-8577-df304d74a00e' })
  @SingleId('groupId')
  groupId!: string;

  @ApiProperty({
    type: [String],
    example: ['01a1e31b-d536-7092-8577-df304d74a00f'],
    maxItems: MAX_BULK_ITEMS,
  })
  @IdList('userId')
  userIds!: string[];
}

export class GroupRolesDto {
  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    nullable: true,
    example: '2027-01-31T00:00:00.000Z',
    description:
      'Optional end date for new assignments (must be in the future); ignored when removing',
  })
  @IsFutureDate()
  @IsDate()
  @Type(() => Date)
  @IsOptional()
  expiresAt?: Date;

  @ApiProperty({ example: '01a1e31b-d536-7092-8577-df304d74a00e' })
  @SingleId('groupId')
  groupId!: string;

  @ApiProperty({
    type: [String],
    example: ['01a1e31b-d536-7092-8577-df304d74a010'],
    maxItems: MAX_BULK_ITEMS,
  })
  @IdList('roleId')
  roleIds!: string[];
}

export class RolePermissionsDto {
  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    nullable: true,
    example: '2027-01-31T00:00:00.000Z',
    description:
      'Optional end date for new assignments (must be in the future); ignored when removing',
  })
  @IsFutureDate()
  @IsDate()
  @Type(() => Date)
  @IsOptional()
  expiresAt?: Date;

  @ApiProperty({ example: '01a1e31b-d536-7092-8577-df304d74a010' })
  @SingleId('roleId')
  roleId!: string;

  @ApiProperty({
    type: [String],
    example: ['01a1e31b-d536-7092-8577-df304d74a011'],
    maxItems: MAX_BULK_ITEMS,
  })
  @IdList('permissionId')
  permissionIds!: string[];
}

export class AssignResultDto {
  @ApiProperty({ example: 2 })
  assignedCount!: number;

  @ApiProperty({
    type: [String],
    example: [],
    description: 'Ids that were already assigned (skipped)',
  })
  alreadyAssignedIds!: string[];
}

export class RemoveResultDto {
  @ApiProperty({ example: 2 })
  removedCount!: number;

  @ApiProperty({
    type: [String],
    example: [],
    description: 'Ids that were not assigned (nothing to remove)',
  })
  notAssignedIds!: string[];
}

export class MappingListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: MappingType })
  @IsEnum(MappingType)
  @Transform(trimUpper)
  @IsOptional()
  type?: MappingType;

  @ApiPropertyOptional()
  @IsUUID('all')
  @Transform(trimLower)
  @IsOptional()
  userId?: string;

  @ApiPropertyOptional()
  @IsUUID('all')
  @Transform(trimLower)
  @IsOptional()
  groupId?: string;

  @ApiPropertyOptional()
  @IsUUID('all')
  @Transform(trimLower)
  @IsOptional()
  roleId?: string;

  @ApiPropertyOptional()
  @IsUUID('all')
  @Transform(trimLower)
  @IsOptional()
  permissionId?: string;

  @ApiPropertyOptional({
    description:
      'User search (email, first or last name) for user-group mappings',
    maxLength: 100,
  })
  @Transform(trimOrUndefined)
  @MaxLength(100)
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsDate()
  @Type(() => Date)
  @IsOptional()
  assignedFrom?: Date;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsDate()
  @Type(() => Date)
  @IsOptional()
  assignedTo?: Date;

  @ApiPropertyOptional({
    enum: ['asc', 'desc'],
    default: 'desc',
    description: 'By assigned date',
  })
  @IsIn(['asc', 'desc'])
  @IsOptional()
  sortOrder?: 'asc' | 'desc';
}

export class MappingUserDto {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'jane.doe@example.com' }) email!: string;
  @ApiProperty({ example: 'Jane' }) firstName!: string;
  @ApiProperty({ type: String, nullable: true, example: 'Doe' }) lastName!:
    string | null;
}

export class MappingGroupDto {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'GRP-DEV' }) groupId!: string;
  @ApiProperty({ example: 'Development' }) groupName!: string;
}

export class MappingRoleDto {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'HR_MANAGER' }) roleKey!: string;
  @ApiProperty({ example: 'HR Manager' }) roleName!: string;
}

export class MappingPermissionDto {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'USER_CREATE' }) permissionKey!: string;
  @ApiProperty({ example: 'Create User' }) permissionName!: string;
}

export class MappingResponseDto {
  @ApiProperty({ example: '01a1e31b-d536-7092-8577-df304d74a099' })
  id!: string;

  @ApiProperty({ enum: MappingType, example: MappingType.GroupUser })
  type!: MappingType;

  @ApiProperty({ type: MappingUserDto, nullable: true })
  user!: MappingUserDto | null;

  @ApiProperty({ type: MappingGroupDto, nullable: true })
  group!: MappingGroupDto | null;

  @ApiProperty({ type: MappingRoleDto, nullable: true })
  role!: MappingRoleDto | null;

  @ApiProperty({ type: MappingPermissionDto, nullable: true })
  permission!: MappingPermissionDto | null;

  @ApiProperty({ example: '01a1e31b-d536-7092-8577-df304d74a00e' })
  assignedBy!: string;

  @ApiProperty({ example: '2026-11-16T05:30:00.000Z' })
  assignedAt!: Date;

  @ApiProperty({
    type: Date,
    nullable: true,
    description: 'null = no end date',
  })
  expiresAt!: Date | null;

  @ApiProperty({ example: false })
  isExpired!: boolean;
}

/** PATCH /access-mappings/:id */
export class SetMappingExpiryDto {
  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    example: '2027-01-31T00:00:00.000Z',
    description: 'New end date (future), or null to remove the end date',
  })
  @IsFutureDate()
  @IsDate()
  @Type(() => Date)
  @ValidateIf((dto: SetMappingExpiryDto) => dto.expiresAt !== null)
  @IsDefined({ message: 'expiresAt is required (null removes the end date)' })
  expiresAt!: Date | null;
}

class AccessTreePermissionDto {
  @ApiProperty() mappingId!: string;
  @ApiProperty({ type: MappingPermissionDto })
  permission!: MappingPermissionDto;
  @ApiProperty({ type: Date, nullable: true }) expiresAt!: Date | null;
  @ApiProperty() isExpired!: boolean;
}

class AccessTreeRoleDto {
  @ApiProperty() mappingId!: string;
  @ApiProperty({ type: MappingRoleDto }) role!: MappingRoleDto;
  @ApiProperty({ type: Date, nullable: true }) expiresAt!: Date | null;
  @ApiProperty() isExpired!: boolean;
  @ApiProperty({ type: [AccessTreePermissionDto] })
  permissions!: AccessTreePermissionDto[];
}

export class AccessTreeGroupDto {
  @ApiProperty({
    description:
      'Membership mapping id (DELETE /access-mappings/:id removes the user from the group)',
  })
  mappingId!: string;
  @ApiProperty({ type: MappingGroupDto }) group!: MappingGroupDto;
  @ApiProperty({ type: Date, nullable: true }) expiresAt!: Date | null;
  @ApiProperty() isExpired!: boolean;
  @ApiProperty({ type: [AccessTreeRoleDto] }) roles!: AccessTreeRoleDto[];
}

export class EffectivePermissionDto extends MappingPermissionDto {
  @ApiProperty({
    type: Object,
    isArray: true,
    example: [{ key: 'module', value: 'users', action: 'CREATE' }],
  })
  metadata!: { key: string; value: string; action: string }[];
}

export class EffectiveAccessDto {
  @ApiProperty({ example: '01a1e31b-d536-7092-8577-df304d74a00e' })
  userId!: string;

  @ApiProperty({
    example: false,
    description:
      'ADMIN role: passes every permission check regardless of the lists below',
  })
  isSuperAdmin!: boolean;

  @ApiProperty({
    type: [MappingGroupDto],
    description:
      'Active groups the user belongs to (+ inherited parents when enabled)',
  })
  groups!: MappingGroupDto[];

  @ApiProperty({
    type: [MappingRoleDto],
    description: 'Active roles through those groups, without duplicates',
  })
  roles!: MappingRoleDto[];

  @ApiProperty({
    type: [EffectivePermissionDto],
    description: 'Active permissions through those roles, without duplicates',
  })
  permissions!: EffectivePermissionDto[];

  @ApiProperty({ type: [String], example: ['USER_CREATE', 'USER_READ'] })
  permissionKeys!: string[];
}

export class AuditQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: AuditEntity })
  @IsEnum(AuditEntity)
  @Transform(trimUpper)
  @IsOptional()
  entityType?: AuditEntity;

  @ApiPropertyOptional()
  @IsUUID('all')
  @Transform(trimLower)
  @IsOptional()
  entityId?: string;

  @ApiPropertyOptional({ enum: AuditAction })
  @IsEnum(AuditAction)
  @Transform(trimUpper)
  @IsOptional()
  action?: AuditAction;

  @ApiPropertyOptional({ description: 'User id of who made the change' })
  @Transform(trimOrUndefined)
  @MaxLength(64)
  @IsString()
  @IsOptional()
  changedBy?: string;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsDate()
  @Type(() => Date)
  @IsOptional()
  from?: Date;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsDate()
  @Type(() => Date)
  @IsOptional()
  to?: Date;
}

export class AuditEntryDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: AuditEntity }) entityType!: AuditEntity;
  @ApiProperty() entityId!: string;
  @ApiProperty({ enum: AuditAction }) action!: AuditAction;
  @ApiProperty() changedBy!: string;
  @ApiProperty({ type: Object, nullable: true }) before!: Record<
    string,
    unknown
  > | null;
  @ApiProperty({ type: Object, nullable: true }) after!: Record<
    string,
    unknown
  > | null;
  @ApiProperty({ type: String, nullable: true }) ipAddress!: string | null;
  @ApiProperty() createdAt!: Date;
}
