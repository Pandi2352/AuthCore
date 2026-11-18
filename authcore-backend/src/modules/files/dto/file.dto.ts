import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsDefined, IsEnum, IsIn, IsOptional, IsUUID } from 'class-validator';

import { PaginationQueryDto } from '@common/dto/pagination-query.dto';
import { trimLower, trimUpper } from '@common/utils/transform.util';

import { DIRECT_UPLOAD_PURPOSES } from '../constants/file.constants';
import { FilePurpose, FileVisibility, ScanStatus } from '../enums/file.enum';

/** Multipart fields next to `file`. */
export class UploadFileDto {
  @ApiProperty({
    enum: DIRECT_UPLOAD_PURPOSES,
    example: FilePurpose.Document,
    description:
      'What the file is for (decides allowed types, size and visibility)',
  })
  @IsIn(DIRECT_UPLOAD_PURPOSES, {
    message: `purpose must be one of: ${DIRECT_UPLOAD_PURPOSES.join(', ')}`,
  })
  @Transform(trimUpper)
  @IsDefined({ message: 'purpose is required' })
  purpose!: FilePurpose;
}

export class FileListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: FilePurpose })
  @IsEnum(FilePurpose)
  @Transform(trimUpper)
  @IsOptional()
  purpose?: FilePurpose;

  @ApiPropertyOptional({
    description: "Another user's files (needs FILE_READ); default: mine",
  })
  @IsUUID('all')
  @Transform(trimLower)
  @IsOptional()
  ownerId?: string;
}

export class FileResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() ownerId!: string;
  @ApiProperty({ enum: FilePurpose }) purpose!: FilePurpose;
  @ApiProperty({ enum: FileVisibility }) visibility!: FileVisibility;
  @ApiProperty({ example: 'passport.pdf' }) originalName!: string;
  @ApiProperty({ example: 'application/pdf' }) mimeType!: string;
  @ApiProperty({ example: 52311, description: 'Bytes' }) size!: number;
  @ApiProperty({ description: 'SHA-256 of the content (hex)' }) sha256!: string;
  @ApiProperty({
    example: '/api/v1/files/0190.../content',
    description: 'Download path (private: send the Bearer token) or public URL',
  })
  url!: string;
  @ApiProperty({
    example: 2_480_311,
    description:
      'Bytes as uploaded (images are re-encoded, so `size` is usually smaller)',
  })
  originalSize!: number;
  @ApiProperty({
    type: Number,
    nullable: true,
    example: 512,
    description: 'Images: width after processing',
  })
  width!: number | null;
  @ApiProperty({ type: Number, nullable: true, example: 512 })
  height!: number | null;
  @ApiProperty({
    enum: ScanStatus,
    description:
      'Virus scan: CLEAN, NOT_SCANNED (scanning off) or SCAN_FAILED (scanner was down, fail-open)',
  })
  scanStatus!: ScanStatus;
  @ApiProperty() uploadedBy!: string;
  @ApiProperty() createdAt!: Date;
}

export class OrphanCleanupResultDto {
  @ApiProperty({ description: 'Another instance is running it right now' })
  isLocked!: boolean;
  @ApiProperty({ description: 'Files looked at' }) scannedCount!: number;
  @ApiProperty({ description: 'Bytes without a record, deleted' })
  orphanCount!: number;
  @ApiProperty({ description: 'Leftovers of interrupted writes, deleted' })
  tempCount!: number;
  @ApiProperty({
    description: 'Records whose bytes are missing (reported only)',
  })
  missingBytesCount!: number;
}

export class FileDeletedDto {
  @ApiProperty() id!: string;
}

/** Swagger body for multipart uploads. */
export const UPLOAD_BODY_SCHEMA = {
  type: 'object',
  required: ['file', 'purpose'],
  properties: {
    file: {
      type: 'string',
      format: 'binary',
      description: 'The file (one per request)',
    },
    purpose: { type: 'string', enum: Object.values(FilePurpose) },
  },
};

export const AVATAR_BODY_SCHEMA = {
  type: 'object',
  required: ['file'],
  properties: {
    file: {
      type: 'string',
      format: 'binary',
      description: 'JPEG, PNG or WebP (UPLOAD_AVATAR_MAX_SIZE_MB)',
    },
  },
};
