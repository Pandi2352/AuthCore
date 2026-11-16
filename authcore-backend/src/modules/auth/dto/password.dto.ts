import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDefined,
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';

import { Match } from '@common/decorators/match.decorator';
import {
  trim,
  trimLower,
  trimLowerOrUndefined,
} from '@common/utils/transform.util';

import { PASSWORD_POLICY } from '../constants/auth.constants';
import { IsStrongPasswordPolicy } from '../decorators/strong-password.decorator';

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

const NEW_PASSWORD_DESCRIPTION =
  `${PASSWORD_POLICY.minLength}–${PASSWORD_POLICY.maxLength} characters with a lowercase letter, ` +
  'an uppercase letter, a number and a symbol. Must not contain your email, username or name, ' +
  'and must not be your current or a recently used password.';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'jane.doe@example.com' })
  @Transform(trimLower)
  @IsEmail()
  @MaxLength(254)
  @IsString()
  @IsDefined({ message: 'email is required' })
  email!: string;
}

/**
 * OTP method: `email` + `code`. Link method: `token` from the link's
 * ?token= parameter. Which one applies is set by PASSWORD_RESET_METHOD.
 */
export class VerifyResetTokenDto {
  @ApiPropertyOptional({
    example: 'jane.doe@example.com',
    description: 'OTP method: the account email',
  })
  @Transform(trimLowerOrUndefined)
  @ValidateIf((dto: VerifyResetTokenDto) => dto.token === undefined)
  @IsEmail()
  @MaxLength(254)
  @IsString()
  @IsDefined({ message: 'email is required' })
  email?: string;

  @ApiPropertyOptional({
    example: '048213',
    description: 'OTP method: the code from the email',
  })
  @Transform(trim)
  @ValidateIf((dto: VerifyResetTokenDto) => dto.token === undefined)
  @Matches(/^\d{6}$/, { message: 'code must be 6 digits' })
  @IsString()
  @IsDefined({ message: 'code is required' })
  code?: string;

  @ApiPropertyOptional({
    example: 'q7Cw0p0Gk1H8mK3x9V2bLZsYtR4uE6aN1oFjD5cWhPg',
    description: 'Link method: the `token` parameter from the reset link',
  })
  @Transform(trim)
  @ValidateIf((dto: VerifyResetTokenDto) => dto.token !== undefined)
  @Matches(TOKEN_PATTERN, { message: 'token is not valid' })
  @IsString()
  token?: string;
}

export class VerifyResetTokenResponseDto {
  @ApiProperty({
    description: 'Single-use token for POST /auth/reset-password',
    example: 'M2b8xQ0n5p1L7cV9tR3eY6uW4aZ0kH2jF8dS5gN1mPq',
  })
  resetToken!: string;

  @ApiProperty({
    example: 600,
    description: 'Seconds until resetToken expires',
  })
  expiresIn!: number;
}

export class ResetPasswordDto {
  @ApiProperty({
    description: 'From POST /auth/verify-reset-token',
    example: 'M2b8xQ0n5p1L7cV9tR3eY6uW4aZ0kH2jF8dS5gN1mPq',
  })
  @Matches(TOKEN_PATTERN, { message: 'resetToken is not valid' })
  @IsString()
  @IsDefined({ message: 'resetToken is required' })
  resetToken!: string;

  @ApiProperty({
    description: NEW_PASSWORD_DESCRIPTION,
    example: 'N3w!Passw0rd',
    format: 'password',
  })
  @IsStrongPasswordPolicy('newPassword')
  newPassword!: string;

  @ApiProperty({
    description: 'Must equal newPassword',
    example: 'N3w!Passw0rd',
    format: 'password',
  })
  @Match('newPassword')
  @IsString()
  @IsDefined({ message: 'confirmPassword is required' })
  confirmPassword!: string;
}

export class ChangePasswordDto {
  @ApiProperty({ example: 'Str0ng!Passw0rd', format: 'password' })
  @MaxLength(PASSWORD_POLICY.maxLength)
  @IsNotEmpty({ message: 'currentPassword is required' })
  @IsString()
  @IsDefined({ message: 'currentPassword is required' })
  currentPassword!: string;

  @ApiProperty({
    description: NEW_PASSWORD_DESCRIPTION,
    example: 'N3w!Passw0rd',
    format: 'password',
  })
  @IsStrongPasswordPolicy('newPassword')
  newPassword!: string;

  @ApiProperty({
    description: 'Must equal newPassword',
    example: 'N3w!Passw0rd',
    format: 'password',
  })
  @Match('newPassword')
  @IsString()
  @IsDefined({ message: 'confirmPassword is required' })
  confirmPassword!: string;
}

export class ChangePasswordResponseDto {
  @ApiProperty({
    example: 2,
    description: 'Other devices that were signed out',
  })
  revokedSessionCount!: number;

  @ApiProperty({ example: true, description: 'This device stays signed in' })
  isCurrentSessionKept!: boolean;
}
