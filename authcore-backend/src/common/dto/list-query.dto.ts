import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsDate, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

import { trimOrUndefined } from '@common/utils/transform.util';

import { PaginationQueryDto } from './pagination-query.dto';

/**
 * Standard list query: pagination + free-text search + sort order + created /
 * updated date ranges. Feature DTOs extend it with their filters and an
 * allowlisted `sortBy`.
 */
export class ListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Case-insensitive text search',
    maxLength: 100,
  })
  @Transform(trimOrUndefined)
  @MaxLength(100)
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsIn(['asc', 'desc'])
  @IsOptional()
  sortOrder?: 'asc' | 'desc';

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    example: '2026-11-01T00:00:00.000Z',
  })
  @IsDate()
  @Type(() => Date)
  @IsOptional()
  createdFrom?: Date;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsDate()
  @Type(() => Date)
  @IsOptional()
  createdTo?: Date;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsDate()
  @Type(() => Date)
  @IsOptional()
  updatedFrom?: Date;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsDate()
  @Type(() => Date)
  @IsOptional()
  updatedTo?: Date;
}
