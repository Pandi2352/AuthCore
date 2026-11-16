import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDefined,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { trimOrUndefined } from '@common/utils/transform.util';

import { PASSWORD_HARD_LIMITS } from '../constants/password-policy.constants';

/**
 * Pre-check a password against the current policy (e.g. live feedback on a
 * sign-up form). Optional personal details enable the personal-info rule.
 * Password history can't be checked here (no account): that happens when
 * the password is actually set.
 */
export class ValidatePasswordDto {
  @ApiProperty({
    example: 'Test@123',
    format: 'password',
    maxLength: PASSWORD_HARD_LIMITS.maxLength,
  })
  @MaxLength(PASSWORD_HARD_LIMITS.maxLength)
  @IsString()
  @IsDefined({ message: 'password is required' })
  password!: string;

  @ApiPropertyOptional({ example: 'jane.doe@example.com' })
  @Transform(trimOrUndefined)
  @MaxLength(254)
  @IsString()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ example: 'janedoe' })
  @Transform(trimOrUndefined)
  @MaxLength(30)
  @IsString()
  @IsOptional()
  username?: string;

  @ApiPropertyOptional({ example: 'Jane' })
  @Transform(trimOrUndefined)
  @MaxLength(50)
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiPropertyOptional({ example: 'Doe' })
  @Transform(trimOrUndefined)
  @MaxLength(50)
  @IsString()
  @IsOptional()
  lastName?: string;
}

export class PasswordViolationDto {
  @ApiProperty({ example: 'minimumDigitCount' })
  rule!: string;

  @ApiProperty({ example: 'Password must contain at least 1 digit' })
  message!: string;
}

export class ValidatePasswordResponseDto {
  @ApiProperty({ example: false })
  isValid!: boolean;

  @ApiProperty({ type: [PasswordViolationDto] })
  violations!: PasswordViolationDto[];
}

export class GeneratePasswordDto {
  @ApiPropertyOptional({
    example: 16,
    minimum: 8,
    maximum: 128,
    description:
      'Clamped to the policy minimum / maximum (default: the larger of 16 and the minimum)',
  })
  @Max(128)
  @Min(8)
  @IsInt()
  @IsOptional()
  length?: number;
}

export class GeneratedPasswordDto {
  @ApiProperty({
    example: 'q7#Kd2!vXm9@Lp4Z',
    description: 'Meets the current password policy',
  })
  password!: string;

  @ApiProperty({ example: 16 })
  length!: number;
}
