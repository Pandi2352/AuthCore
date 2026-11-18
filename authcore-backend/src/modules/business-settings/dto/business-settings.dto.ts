import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

import { trim } from '@common/utils/transform.util';

import {
  SITE_DESCRIPTION_MAX_LENGTH,
  SITE_NAME_MAX_LENGTH,
} from '../constants/business-settings.constants';

// ---------------------------------------------------------------- requests

/** Change the text settings; send only the fields that change. */
export class UpdateBusinessSettingsDto {
  @ApiPropertyOptional({
    example: 'Acme Portal',
    maxLength: SITE_NAME_MAX_LENGTH,
    description:
      'Shown in the browser tab, sidebar (without a logo), sign-in pages and emails',
  })
  @MaxLength(SITE_NAME_MAX_LENGTH)
  @IsNotEmpty({ message: 'siteName cannot be empty' })
  @IsString()
  @Transform(trim)
  @IsOptional()
  siteName?: string;

  @ApiPropertyOptional({
    example: 'Customer and partner portal of Acme Ltd.',
    maxLength: SITE_DESCRIPTION_MAX_LENGTH,
    description:
      'Search engines and link previews (meta description); may be empty',
  })
  @MaxLength(SITE_DESCRIPTION_MAX_LENGTH)
  @IsString()
  @Transform(trim)
  @IsOptional()
  siteDescription?: string;

  @ApiPropertyOptional({
    example: 3,
    description:
      'The version you edited (from GET; 0 before the first save). If someone saved in between: 409 VERSION_CONFLICT. Omit to overwrite.',
  })
  @Min(0)
  @IsInt()
  @IsOptional()
  version?: number;
}

/** Swagger body for the image upload. */
export const BRAND_ASSET_BODY_SCHEMA = {
  type: 'object',
  required: ['file'],
  properties: {
    file: {
      type: 'string',
      format: 'binary',
      description:
        'PNG, WebP or JPEG (UPLOAD_AVATAR_MAX_SIZE_MB). PNG / WebP keep transparency. SVG is not accepted.',
    },
  },
};

// ---------------------------------------------------------------- responses

export class PublicBrandAssetsDto {
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Full logo (expanded sidebar)',
  })
  logo!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Square mark (collapsed sidebar)',
  })
  logoMark!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Sign-in / sign-up pages',
  })
  authLogo!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Browser tab icon',
  })
  favicon!: string | null;
}

/** What every page needs (no sign-in): name, description and image URLs. */
export class PublicBusinessSettingsDto {
  @ApiProperty({ example: 'Acme Portal' }) siteName!: string;
  @ApiProperty({ example: 'Customer and partner portal of Acme Ltd.' })
  siteDescription!: string;

  @ApiProperty({
    type: PublicBrandAssetsDto,
    description:
      'Public image URLs, null = not set (the frontend uses its built-in default)',
  })
  assets!: PublicBrandAssetsDto;

  @ApiProperty({ example: 3, description: 'Changes on every save' })
  version!: number;

  @ApiProperty({ type: Date, nullable: true }) updatedAt!: Date | null;
}

export class BrandAssetDto {
  @ApiProperty() fileId!: string;
  @ApiProperty({ example: '/api/v1/files/public/0190...' }) url!: string;
  @ApiProperty({ example: 'acme-logo.png' }) originalName!: string;
  @ApiProperty({ example: 'image/png' }) mimeType!: string;
  @ApiProperty({ example: 18211, description: 'Bytes (after processing)' })
  size!: number;
  @ApiProperty({ type: Number, nullable: true, example: 512 })
  width!: number | null;
  @ApiProperty({ type: Number, nullable: true, example: 128 })
  height!: number | null;
  @ApiProperty() uploadedAt!: Date;
}

export class BrandAssetsDto {
  @ApiProperty({ type: BrandAssetDto, nullable: true })
  logo!: BrandAssetDto | null;
  @ApiProperty({ type: BrandAssetDto, nullable: true })
  logoMark!: BrandAssetDto | null;
  @ApiProperty({ type: BrandAssetDto, nullable: true })
  authLogo!: BrandAssetDto | null;
  @ApiProperty({ type: BrandAssetDto, nullable: true })
  favicon!: BrandAssetDto | null;
}

/** Admin view: the same values plus file details and who changed them. */
export class BusinessSettingsDto {
  @ApiProperty({ example: 'Acme Portal' }) siteName!: string;
  @ApiProperty() siteDescription!: string;
  @ApiProperty({ type: BrandAssetsDto }) assets!: BrandAssetsDto;

  @ApiProperty({
    description: 'true until the first save: project defaults are shown',
  })
  isDefault!: boolean;

  @ApiProperty({ example: 3 }) version!: number;
  @ApiProperty({ type: Date, nullable: true }) updatedAt!: Date | null;
  @ApiProperty({ type: String, nullable: true }) updatedBy!: string | null;
}
