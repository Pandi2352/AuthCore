import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDefined,
  IsEnum,
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
  trimOrUndefined,
  trimUpper,
} from '@common/utils/transform.util';

import {
  DESCRIPTION_MAX_LENGTH,
  KEY_PATTERN,
  MAX_METADATA_ITEMS,
  METADATA_KEY_MAX_LENGTH,
  METADATA_KEY_PATTERN,
  METADATA_VALUE_MAX_LENGTH,
  METADATA_VALUE_PATTERN,
  NAME_MAX_LENGTH,
  PERMISSION_ACTION_VALUES,
  PERMISSION_KEY_MAX_LENGTH,
} from '../constants/access-control.constants';
import { RecordStatus } from '../enums/access-control.enum';

export const PERMISSION_SORT_FIELDS = [
  'permissionName',
  'permissionKey',
  'createdAt',
  'updatedAt',
] as const;

export class PermissionMetadataDto {
  @ApiProperty({
    example: 'module',
    description:
      'Letters, digits, _ . - (starts with a letter). Unique per permission.',
  })
  @Matches(METADATA_KEY_PATTERN, {
    message:
      'metadata key may contain only letters, digits, _ . - and must start with a letter',
  })
  @MaxLength(METADATA_KEY_MAX_LENGTH)
  @Transform(trim)
  @IsString()
  @IsDefined({ message: 'metadata key is required' })
  key!: string;

  @ApiProperty({
    example: 'users',
    description: 'Plain text: letters, digits, spaces and _ . : / * @ # -',
  })
  @Matches(METADATA_VALUE_PATTERN, {
    message: 'metadata value contains unsupported characters',
  })
  @MaxLength(METADATA_VALUE_MAX_LENGTH)
  @Transform(trim)
  @IsString()
  @IsDefined({ message: 'metadata value is required' })
  value!: string;

  @ApiProperty({
    example: 'CREATE',
    enum: PERMISSION_ACTION_VALUES,
    description: 'See GET /permissions/actions',
  })
  @IsIn(PERMISSION_ACTION_VALUES, {
    message: `metadata action must be one of: ${PERMISSION_ACTION_VALUES.join(', ')}`,
  })
  @Transform(trimUpper)
  @IsString()
  @IsDefined({ message: 'metadata action is required' })
  action!: string;
}

export class CreatePermissionDto {
  @ApiProperty({
    example: 'USER_CREATE',
    description:
      'Unique key. Stored uppercase; letters, digits and _ (starts with a letter).',
    maxLength: PERMISSION_KEY_MAX_LENGTH,
  })
  @Matches(KEY_PATTERN, {
    message:
      'permissionKey may contain only letters, digits and _ and must start with a letter',
  })
  @MaxLength(PERMISSION_KEY_MAX_LENGTH)
  @MinLength(2)
  @Transform(trimUpper)
  @IsString()
  @IsDefined({ message: 'permissionKey is required' })
  permissionKey!: string;

  @ApiProperty({
    example: 'Create User',
    description: 'Unique (case-insensitive)',
    maxLength: NAME_MAX_LENGTH,
  })
  @MaxLength(NAME_MAX_LENGTH)
  @IsNotEmpty({ message: 'permissionName is required' })
  @Transform(normalizeName)
  @IsString()
  @IsDefined({ message: 'permissionName is required' })
  permissionName!: string;

  @ApiPropertyOptional({
    example: 'Allows creating users',
    maxLength: DESCRIPTION_MAX_LENGTH,
  })
  @MaxLength(DESCRIPTION_MAX_LENGTH)
  @Transform(trim)
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    type: [PermissionMetadataDto],
    description: `Up to ${String(MAX_METADATA_ITEMS)} entries; keys must be unique.`,
    example: [
      { key: 'module', value: 'users', action: 'CREATE' },
      { key: 'resource', value: 'user', action: 'CREATE' },
    ],
  })
  @ValidateNested({ each: true })
  @Type(() => PermissionMetadataDto)
  @ArrayMaxSize(MAX_METADATA_ITEMS)
  @IsArray()
  @IsOptional()
  metadata?: PermissionMetadataDto[];

  @ApiPropertyOptional({ enum: RecordStatus, default: RecordStatus.Active })
  @IsEnum(RecordStatus)
  @IsOptional()
  status?: RecordStatus;
}

export class UpdatePermissionDto extends PartialType(CreatePermissionDto) {
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

export class PermissionListQueryDto extends ListQueryDto {
  @ApiPropertyOptional({
    example: 'module',
    description: 'Has a metadata entry with this key',
  })
  @Transform(trimOrUndefined)
  @MaxLength(METADATA_KEY_MAX_LENGTH)
  @IsString()
  @IsOptional()
  metadataKey?: string;

  @ApiPropertyOptional({
    example: 'users',
    description:
      'Has a metadata entry with this value (with metadataKey: on that key)',
  })
  @Transform(trimOrUndefined)
  @MaxLength(METADATA_VALUE_MAX_LENGTH)
  @IsString()
  @IsOptional()
  metadataValue?: string;

  @ApiPropertyOptional({ enum: PERMISSION_ACTION_VALUES })
  @IsIn(PERMISSION_ACTION_VALUES)
  @Transform(trimUpper)
  @IsOptional()
  action?: string;

  @ApiPropertyOptional({ enum: RecordStatus })
  @IsEnum(RecordStatus)
  @IsOptional()
  status?: RecordStatus;

  @ApiPropertyOptional({ enum: PERMISSION_SORT_FIELDS, default: 'updatedAt' })
  @IsIn(PERMISSION_SORT_FIELDS)
  @IsOptional()
  sortBy?: (typeof PERMISSION_SORT_FIELDS)[number];
}

export class PermissionDropdownQueryDto extends DropdownQueryDto {
  @ApiPropertyOptional({ enum: PERMISSION_ACTION_VALUES })
  @IsIn(PERMISSION_ACTION_VALUES)
  @Transform(trimUpper)
  @IsOptional()
  action?: string;

  @ApiPropertyOptional({
    example: 'users',
    description: 'Metadata entry module = this value',
  })
  @Transform(trimOrUndefined)
  @MaxLength(METADATA_VALUE_MAX_LENGTH)
  @IsString()
  @IsOptional()
  module?: string;
}

export class PermissionListItemDto {
  @ApiProperty({ example: '01a1e31b-d536-7092-8577-df304d74a00e' })
  id!: string;

  @ApiProperty({ example: 'USER_CREATE' })
  permissionKey!: string;

  @ApiProperty({ example: 'Create User' })
  permissionName!: string;

  @ApiProperty({ example: 'Allows creating users' })
  description!: string;

  @ApiProperty({ type: [PermissionMetadataDto] })
  metadata!: PermissionMetadataDto[];

  @ApiProperty({ enum: RecordStatus, example: RecordStatus.Active })
  status!: RecordStatus;

  @ApiProperty({ example: false })
  isSystem!: boolean;

  @ApiProperty({ example: '2026-11-16T05:30:00.000Z' })
  updatedAt!: Date;
}

/** GET /permissions/exists: is this key / name already taken? */
export class PermissionExistsQueryDto {
  @ApiPropertyOptional({ example: 'USER_CREATE' })
  @MaxLength(PERMISSION_KEY_MAX_LENGTH)
  @Transform(({ value }: { value: unknown }) =>
    trimUpper({ value: trimOrUndefined({ value }) }),
  )
  @IsString()
  @IsOptional()
  permissionKey?: string;

  @ApiPropertyOptional({ example: 'Create User' })
  @MaxLength(NAME_MAX_LENGTH)
  @Transform(normalizeName)
  @IsString()
  @IsOptional()
  permissionName?: string;

  @ApiPropertyOptional({ description: 'Editing: ignore this permission id' })
  @IsUUID('all')
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsOptional()
  excludeId?: string;
}

export class PermissionResponseDto extends PermissionListItemDto {
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
    description: 'Details only: roles that have this permission',
  })
  roleCount?: number;
}
