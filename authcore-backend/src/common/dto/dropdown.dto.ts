import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

import { trimOrUndefined } from '@common/utils/transform.util';

/** Query for dropdown endpoints: optional search. Dropdowns return every matching record (no limit). */
export class DropdownQueryDto {
  @ApiPropertyOptional({
    description: 'Case-insensitive search on the label',
    maxLength: 100,
  })
  @Transform(trimOrUndefined)
  @MaxLength(100)
  @IsString()
  @IsOptional()
  search?: string;
}

/** One dropdown entry: id + display label (+ optional context). */
export class DropdownOptionDto {
  @ApiProperty({ example: '01a1e31b-d536-7092-8577-df304d74a00e' })
  id!: string;

  @ApiProperty({ example: 'Access Control Administrator' })
  label!: string;

  @ApiPropertyOptional({
    example: 'ACCESS_CONTROL_ADMIN',
    description: 'Key / code, when the entity has one',
  })
  key?: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Parent id (nested dropdowns)',
  })
  parentId?: string | null;

  @ApiPropertyOptional({
    example: 'DEPARTMENT',
    description: 'Category, when the entity has one',
  })
  category?: string;

  @ApiPropertyOptional({ example: 1, description: 'Groups: 0 = main group' })
  level?: number;

  @ApiPropertyOptional({
    example: 'Development / Backend Team',
    description:
      'Groups with withPath=true: names from the main group down to this one',
  })
  path?: string;
}

/** Fixed option lists (categories, actions). */
export class OptionDto {
  @ApiProperty({ example: 'DEPARTMENT' })
  value!: string;

  @ApiProperty({ example: 'Department' })
  label!: string;
}
