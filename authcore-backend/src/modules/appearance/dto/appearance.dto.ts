import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';

import { OPTION_VALUE } from '../constants/appearance.constants';

const MODES = ['light', 'dark', 'system'];

/** The application's look: default mode, color preset and appearance options. */
export class UpdateAppearanceDto {
  @ApiProperty({
    enum: MODES,
    example: 'system',
    description:
      'Default mode (users can still flip light / dark for themselves)',
  })
  @IsIn(MODES)
  mode!: string;

  @ApiProperty({ example: 'indigo' })
  @Matches(OPTION_VALUE)
  @IsString()
  preset!: string;

  @ApiProperty({
    example: { radius: 'large', density: 'comfortable', sidebar: 'floating' },
    description:
      'Appearance options (Settings → Appearance); unknown keys are refused',
  })
  @IsObject()
  appearance!: Record<string, string>;

  @ApiPropertyOptional({
    example: 2,
    description:
      'The version you edited: 409 VERSION_CONFLICT if it changed meanwhile. Omit to overwrite.',
  })
  @Min(0)
  @IsInt()
  @IsOptional()
  version?: number;
}

export class AppearanceDto {
  @ApiProperty({ type: String, nullable: true, example: 'system' })
  mode!: string | null;
  @ApiProperty({ type: String, nullable: true, example: 'indigo' })
  preset!: string | null;
  @ApiProperty({ example: { radius: 'large' } })
  appearance!: Record<string, string>;
  @ApiProperty({ description: '0 = never saved: the built-in defaults apply' })
  version!: number;
  @ApiProperty({ type: Date, nullable: true }) updatedAt!: Date | null;
}

export class AppearanceAdminDto extends AppearanceDto {
  @ApiProperty({ type: String, nullable: true }) updatedBy!: string | null;
}
