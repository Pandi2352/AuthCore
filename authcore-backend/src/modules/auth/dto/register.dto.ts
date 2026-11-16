import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDefined,
  IsEmail,
  IsNotIn,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

import {
  trim,
  trimLower,
  trimLowerOrUndefined,
  trimOrUndefined,
} from '@common/utils/transform.util';

import {
  PASSWORD_MAX_LENGTH,
  PERSON_NAME_PATTERN,
  RESERVED_USERNAMES,
  USERNAME_PATTERN,
} from '../constants/auth.constants';
import { IsNewPassword } from '../decorators/new-password.decorator';

// With stopAtFirstError, class-validator runs the decorator closest to the
// property first. Basic checks (IsDefined, IsString) therefore sit at the
// bottom of each list, so a missing field says "is required".

export class RegisterDto {
  @ApiProperty({
    description: 'Login email. Stored lowercase.',
    example: 'jane.doe@example.com',
    maxLength: 254,
  })
  @Transform(trimLower)
  @IsEmail({ allow_display_name: false, allow_ip_domain: false })
  @MaxLength(254)
  @IsString()
  @IsDefined({ message: 'email is required' })
  email!: string;

  @ApiProperty({
    description:
      'Must meet the password policy (GET /api/v1/password-policies/requirements). ' +
      'Default: 8–64 characters with an uppercase letter, a lowercase letter, a digit and a ' +
      'special character, e.g. Test@123. Must not contain your email, username or name.',
    example: 'Str0ng!Passw0rd',
    maxLength: PASSWORD_MAX_LENGTH,
    format: 'password',
  })
  @IsNewPassword('password')
  password!: string;

  @ApiProperty({ example: 'Jane', minLength: 1, maxLength: 50 })
  @Transform(trim)
  @Matches(PERSON_NAME_PATTERN, {
    message: 'firstName contains characters that are not allowed',
  })
  @Length(1, 50)
  @IsString()
  @IsDefined({ message: 'firstName is required' })
  firstName!: string;

  @ApiPropertyOptional({ example: 'Doe', maxLength: 50 })
  @Transform(trimOrUndefined)
  @IsOptional()
  @Matches(PERSON_NAME_PATTERN, {
    message: 'lastName contains characters that are not allowed',
  })
  @Length(1, 50)
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({
    description:
      "Optional. 3–30 characters: lowercase letters, numbers, '.', '_' or '-' (not at the start or end). Stored lowercase.",
    example: 'janedoe',
    minLength: 3,
    maxLength: 30,
  })
  @Transform(trimLowerOrUndefined)
  @IsOptional()
  @IsNotIn([...RESERVED_USERNAMES], {
    message: 'username is not available',
  })
  @Matches(USERNAME_PATTERN, {
    message:
      "username must be 3–30 characters: letters, numbers, '.', '_' or '-' (not at the start or end)",
  })
  @IsString()
  username?: string;
}
