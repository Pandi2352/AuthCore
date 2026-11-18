import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

import { trim } from '@common/utils/transform.util';

import { STORAGE_NAME_MAX_LENGTH } from '../constants/storage.constants';
import { STORAGE_PROVIDER_IDS } from '../providers';
import type { StorageProviderId } from '../providers/storage-provider.types';

const CLOUD_PROVIDERS = STORAGE_PROVIDER_IDS.filter((id) => id !== 'LOCAL');

// ---------------------------------------------------------------- requests

export class CreateStorageConfigDto {
  @ApiProperty({
    example: 'Production bucket',
    maxLength: STORAGE_NAME_MAX_LENGTH,
  })
  @MaxLength(STORAGE_NAME_MAX_LENGTH)
  @IsNotEmpty()
  @IsString()
  @Transform(trim)
  name!: string;

  @ApiProperty({ enum: CLOUD_PROVIDERS, example: 'AWS_S3' })
  @IsIn(CLOUD_PROVIDERS, {
    message: `provider must be one of: ${CLOUD_PROVIDERS.join(', ')}`,
  })
  provider!: StorageProviderId;

  @ApiProperty({
    example: {
      bucket: 'my-app-files',
      region: 'ap-south-1',
      accessKeyId: 'AKIA…',
    },
    description:
      'Non-secret fields of the provider (GET /settings/storage/providers lists them)',
  })
  @IsObject()
  settings!: Record<string, string | boolean>;

  @ApiProperty({
    example: { secretAccessKey: '…' },
    description: 'Secret fields; encrypted at rest, never returned',
  })
  @IsObject()
  secrets!: Record<string, string>;
}

export class UpdateStorageConfigDto {
  @ApiPropertyOptional({ maxLength: STORAGE_NAME_MAX_LENGTH })
  @MaxLength(STORAGE_NAME_MAX_LENGTH)
  @IsNotEmpty()
  @IsString()
  @Transform(trim)
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: 'All non-secret fields (replaces them)' })
  @IsObject()
  @IsOptional()
  settings?: Record<string, string | boolean>;

  @ApiPropertyOptional({
    description:
      'Only the secrets that change; empty / missing = keep the saved one',
  })
  @IsObject()
  @IsOptional()
  secrets?: Record<string, string>;

  @ApiPropertyOptional({
    example: 2,
    description:
      'The version you edited: 409 VERSION_CONFLICT if it changed meanwhile',
  })
  @Min(1)
  @IsInt()
  @IsOptional()
  version?: number;
}

/** Test values from the form before saving. With `id`, empty secrets use the saved ones. */
export class TestStorageConfigDto {
  @ApiProperty({ enum: CLOUD_PROVIDERS })
  @IsIn(CLOUD_PROVIDERS)
  provider!: StorageProviderId;

  @ApiProperty() @IsObject() settings!: Record<string, string | boolean>;
  @ApiProperty() @IsObject() secrets!: Record<string, string>;

  @ApiPropertyOptional({ description: 'Saved storage being edited' })
  @IsUUID('all')
  @IsOptional()
  id?: string;
}

// ---------------------------------------------------------------- responses

export class StorageFieldDto {
  @ApiProperty() key!: string;
  @ApiProperty() label!: string;
  @ApiProperty({ enum: ['text', 'url', 'secret', 'boolean'] }) type!: string;
  @ApiProperty() required!: boolean;
  @ApiPropertyOptional() hint?: string;
  @ApiPropertyOptional() placeholder?: string;
  @ApiPropertyOptional({ oneOf: [{ type: 'string' }, { type: 'boolean' }] })
  defaultValue?: string | boolean;
  @ApiPropertyOptional() secret?: boolean;
  @ApiPropertyOptional() pattern?: string;
  @ApiPropertyOptional({
    description: 'Error text when the pattern does not match',
  })
  formatHint?: string;
}

export class StorageProviderDto {
  @ApiProperty({ enum: STORAGE_PROVIDER_IDS }) id!: StorageProviderId;
  @ApiProperty() label!: string;
  @ApiProperty() description!: string;
  @ApiPropertyOptional() docsUrl?: string;
  @ApiProperty() isBuiltIn!: boolean;
  @ApiProperty({ type: [StorageFieldDto] }) fields!: StorageFieldDto[];
}

export class StorageSecretStateDto {
  @ApiProperty() isSet!: boolean;
  @ApiProperty({ example: '••••7Q2X', nullable: true, type: String })
  hint!: string | null;
}

export class StorageTestResultDto {
  @ApiProperty() isSuccess!: boolean;
  @ApiProperty({ example: 'Connected: wrote, read and deleted a test file' })
  message!: string;
  @ApiProperty({ example: 412 }) durationMs!: number;
  @ApiProperty() testedAt!: Date;
}

export class StorageUsageDto {
  @ApiProperty({ description: 'Files stored here (file records)' })
  fileCount!: number;
  @ApiProperty({
    example: 52_311_000,
    description: 'Bytes stored here by this API',
  })
  usedBytes!: number;
  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      'Local folder: disk size. Buckets: the "Storage limit (GB)" setting. null = unknown / unlimited',
  })
  capacityBytes!: number | null;
  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'Local folder: free disk space. Buckets: limit minus used',
  })
  freeBytes!: number | null;
  @ApiProperty({ enum: ['disk', 'limit'], nullable: true, type: String })
  capacitySource!: 'disk' | 'limit' | null;
}

export class StorageConfigDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: STORAGE_PROVIDER_IDS }) provider!: StorageProviderId;
  @ApiProperty() providerLabel!: string;
  @ApiProperty({ description: 'Non-secret fields' })
  settings!: Record<string, string | boolean>;
  @ApiProperty({
    description:
      'Per secret field: whether it is set and its last 4 characters',
    additionalProperties: {
      $ref: '#/components/schemas/StorageSecretStateDto',
    },
  })
  secrets!: Record<string, StorageSecretStateDto>;
  @ApiProperty() isActive!: boolean;
  @ApiProperty() isBuiltIn!: boolean;
  @ApiProperty({ type: StorageTestResultDto, nullable: true })
  lastTest!: StorageTestResultDto | null;
  @ApiProperty({
    description: 'Files stored here (they keep working after a switch)',
  })
  fileCount!: number;
  @ApiProperty({ type: StorageUsageDto }) usage!: StorageUsageDto;
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Example public URL of a file (null = served through the API)',
  })
  publicUrlExample!: string | null;
  @ApiProperty() version!: number;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}
