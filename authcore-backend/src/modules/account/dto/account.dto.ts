import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDefined,
  IsEmail,
  IsNotEmpty,
  IsNotIn,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

import { trim, trimLower, trimOrUndefined } from '@common/utils/transform.util';
import {
  PASSWORD_MAX_LENGTH,
  PERSON_NAME_PATTERN,
  RESERVED_USERNAMES,
  USERNAME_PATTERN,
} from '@modules/auth/constants/auth.constants';
import { UserResponseDto } from '@modules/users/dto/user-response.dto';

/** "" or null clears an optional field. */
const nullable = ({ value }: { value: unknown }): unknown =>
  value === '' ? null : typeof value === 'string' ? value.trim() : value;
const nullableLower = ({ value }: { value: unknown }): unknown => {
  const v = nullable({ value });
  return typeof v === 'string' ? v.toLowerCase() : v;
};

/** GET /users/me: the profile plus custom variable values. */
export class ProfileResponseDto extends UserResponseDto {
  @ApiProperty({
    type: Object,
    example: { designation: 'Engineer', address: { locality: 'Bengaluru' } },
    description: 'Custom variable values you may see',
  })
  attributes!: Record<string, unknown>;

  @ApiProperty({
    type: [String],
    example: ['phone_number'],
    description: 'Required variables still empty',
  })
  missingRequired!: string[];
}

/** PATCH /users/me and PATCH /admin/users/:id: send only what changes. */
export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Jane', maxLength: 50 })
  @Matches(PERSON_NAME_PATTERN, {
    message: 'firstName contains characters that are not allowed',
  })
  @Length(1, 50)
  @Transform(trim)
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'Doe',
    description: 'null or "" removes it',
  })
  @Matches(PERSON_NAME_PATTERN, {
    message: 'lastName contains characters that are not allowed',
  })
  @Length(1, 50)
  @IsString()
  @ValidateIf(
    (dto: UpdateProfileDto) =>
      dto.lastName !== null && dto.lastName !== undefined,
  )
  @Transform(nullable)
  lastName?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'janedoe',
    description:
      "3–30 characters: letters, numbers, '.', '_' or '-'. Stored lowercase. null or \"\" removes it",
  })
  @IsNotIn([...RESERVED_USERNAMES], { message: 'username is not available' })
  @Matches(USERNAME_PATTERN, {
    message:
      "username must be 3–30 characters: letters, numbers, '.', '_' or '-' (not at the start or end)",
  })
  @IsString()
  @ValidateIf(
    (dto: UpdateProfileDto) =>
      dto.username !== null && dto.username !== undefined,
  )
  @Transform(nullableLower)
  username?: string | null;
}

export class NotificationPreferencesUpdateDto {
  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  productUpdates?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  loginAlerts?: boolean;
}

/** PATCH /users/me/preferences: send only what changes. */
export class UpdatePreferencesDto {
  @ApiPropertyOptional({
    example: 'en-IN',
    description: 'BCP 47 language tag, e.g. en, en-IN, ta',
  })
  @Matches(/^[a-z]{2,3}(-[A-Z]{2})?$/, {
    message: 'language must look like "en" or "en-IN"',
  })
  @Transform(trim)
  @IsString()
  @IsOptional()
  language?: string;

  @ApiPropertyOptional({
    example: 'Asia/Kolkata',
    description: 'IANA time zone',
  })
  @MaxLength(64)
  @Transform(trim)
  @IsString()
  @IsOptional()
  timezone?: string;

  @ApiPropertyOptional({ type: NotificationPreferencesUpdateDto })
  @ValidateNested()
  @Type(() => NotificationPreferencesUpdateDto)
  @IsObject()
  @IsOptional()
  notifications?: NotificationPreferencesUpdateDto;
}

/** Sensitive actions are confirmed with the current password. */
export class CurrentPasswordDto {
  @ApiProperty({ example: 'Str0ng!Passw0rd', format: 'password' })
  @MaxLength(PASSWORD_MAX_LENGTH)
  @IsNotEmpty({ message: 'currentPassword is required' })
  @IsString()
  @IsDefined({ message: 'currentPassword is required' })
  currentPassword!: string;
}

export class ChangeEmailDto extends CurrentPasswordDto {
  @ApiProperty({ example: 'jane.new@example.com' })
  @IsEmail()
  @MaxLength(254)
  @Transform(trimLower)
  @IsString()
  @IsDefined({ message: 'newEmail is required' })
  newEmail!: string;
}

export class EmailCodeDto {
  @ApiProperty({
    example: '048213',
    description: 'The 6-digit code from the email',
  })
  @Matches(/^\d{6}$/, { message: 'code must be 6 digits' })
  @Transform(trim)
  @IsString()
  @IsDefined({ message: 'code is required' })
  code!: string;
}

export class EmailChangeStartedDto {
  @ApiProperty({
    example: 'jane.new@example.com',
    description: 'The code was sent here',
  })
  pendingEmail!: string;

  @ApiProperty({ example: 15 })
  expiresInMinutes!: number;
}

export class CloseAccountDto extends CurrentPasswordDto {
  @ApiPropertyOptional({ example: 'Not using it any more', maxLength: 500 })
  @MaxLength(500)
  @Transform(trimOrUndefined)
  @IsString()
  @IsOptional()
  reason?: string;
}

export class DeletionScheduledDto {
  @ApiProperty({
    example: '2026-11-30T10:00:00.000Z',
    description: 'Permanently deleted after this date unless recovered',
  })
  deletionScheduledAt!: Date;
}

export class RecoveryRequestDto {
  @ApiProperty({ example: 'jane.doe@example.com' })
  @IsEmail()
  @MaxLength(254)
  @Transform(trimLower)
  @IsString()
  @IsDefined({ message: 'email is required' })
  email!: string;
}

export class RecoveryConfirmDto extends RecoveryRequestDto {
  @ApiProperty({ example: '048213' })
  @Matches(/^\d{6}$/, { message: 'code must be 6 digits' })
  @Transform(trim)
  @IsString()
  @IsDefined({ message: 'code is required' })
  code!: string;
}
