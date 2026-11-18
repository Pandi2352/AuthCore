import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';

import { LOCKABLE_KEYS, OPTION_VALUE } from '../constants/appearance.constants';

const MODES = ['light', 'dark', 'system'];

/** Mode, color preset and appearance options (keys checked by the service). */
export class ThemeValuesDto {
  @ApiPropertyOptional({ enum: MODES, nullable: true, example: 'system' })
  @IsIn([...MODES, null])
  @IsOptional()
  mode?: string | null;

  @ApiPropertyOptional({ example: 'indigo', nullable: true })
  @Matches(OPTION_VALUE)
  @IsString()
  @IsOptional()
  preset?: string | null;

  @ApiPropertyOptional({
    example: { radius: 'large', density: 'comfortable', sidebar: 'floating' },
    description:
      'Appearance options (Settings → Appearance); unknown keys are refused',
  })
  @IsObject()
  @IsOptional()
  appearance?: Record<string, string>;
}

export class UpdateOrgAppearanceDto extends ThemeValuesDto {
  @ApiProperty({
    example: ['preset', 'customColor'],
    description: `Options users cannot change: ${LOCKABLE_KEYS.join(', ')}`,
  })
  @IsIn(LOCKABLE_KEYS, { each: true })
  @ArrayUnique()
  @ArrayMaxSize(LOCKABLE_KEYS.length)
  @IsArray()
  locked!: string[];

  @ApiPropertyOptional({
    example: 2,
    description:
      'The version you edited (0 before the first save): 409 VERSION_CONFLICT if it changed',
  })
  @Min(0)
  @IsInt()
  @IsOptional()
  version?: number;
}

export class UpdateMyAppearanceDto {
  @ApiProperty({ description: 'Sync this look across your devices' })
  @IsBoolean()
  syncEnabled!: boolean;

  @ApiPropertyOptional({
    type: ThemeValuesDto,
    nullable: true,
    description: 'Your look (null = follow the organization / defaults)',
  })
  @ValidateNested()
  @Type(() => ThemeValuesDto)
  @IsOptional()
  theme?: ThemeValuesDto | null;
}

// ---------------------------------------------------------------- responses

export class OrgAppearanceDto {
  @ApiProperty({ type: String, nullable: true }) mode!: string | null;
  @ApiProperty({ type: String, nullable: true }) preset!: string | null;
  @ApiProperty({ example: { radius: 'large' } }) appearance!: Record<
    string,
    string
  >;
  @ApiProperty({ example: ['preset'] }) locked!: string[];
  @ApiProperty({ description: '0 = no organization look saved yet' })
  version!: number;
  @ApiProperty({ type: Date, nullable: true }) updatedAt!: Date | null;
}

export class OrgAppearanceAdminDto extends OrgAppearanceDto {
  @ApiProperty({ type: String, nullable: true }) updatedBy!: string | null;
  @ApiProperty({ example: LOCKABLE_KEYS }) lockableKeys!: readonly string[];
}

export class MyAppearanceDto {
  @ApiProperty() syncEnabled!: boolean;
  @ApiProperty({ type: ThemeValuesDto, nullable: true })
  theme!: ThemeValuesDto | null;
  @ApiProperty({ type: Date, nullable: true }) updatedAt!: Date | null;
}
