import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDefined,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

import { trimLowerOrUndefined } from '@common/utils/transform.util';

import { PASSWORD_MAX_LENGTH } from '../constants/auth.constants';

/**
 * Sign in with `email` + password or `username` + password (exactly one
 * identifier). Which identifiers are allowed is set by LOGIN_IDENTIFIERS.
 */
export class LoginDto {
  @ApiPropertyOptional({
    description:
      'Email address (normalized: trimmed, lowercase). Use this or `username`.',
    example: 'jane.doe@example.com',
    maxLength: 254,
  })
  @Transform(trimLowerOrUndefined)
  @ValidateIf((dto: LoginDto) => dto.username === undefined)
  @IsEmail()
  @MaxLength(254)
  @IsString()
  @IsDefined({ message: 'email or username is required' })
  email?: string;

  @ApiPropertyOptional({
    description:
      'Username (normalized: trimmed, lowercase). Use this or `email`.',
    example: 'janedoe',
    maxLength: 30,
  })
  @Transform(trimLowerOrUndefined)
  @IsOptional()
  @MaxLength(30)
  @IsString()
  username?: string;

  @ApiProperty({
    description: 'Account password. Sent as typed (never trimmed).',
    example: 'Str0ng!Passw0rd',
    format: 'password',
    maxLength: PASSWORD_MAX_LENGTH,
  })
  @MaxLength(PASSWORD_MAX_LENGTH)
  @IsNotEmpty({ message: 'password is required' })
  @IsString()
  @IsDefined({ message: 'password is required' })
  password!: string;

  @ApiPropertyOptional({
    description:
      'Keep me signed in: longer session (REFRESH_TOKEN_REMEMBER_ME_TTL_DAYS) and a persistent cookie.',
    default: false,
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}
