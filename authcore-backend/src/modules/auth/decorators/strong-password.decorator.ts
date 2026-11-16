import { applyDecorators } from '@nestjs/common';
import {
  IsDefined,
  IsString,
  IsStrongPassword,
  MaxLength,
} from 'class-validator';

import { PASSWORD_POLICY } from '../constants/auth.constants';

/**
 * The AuthCore password policy for every new password (register, reset,
 * change). Decorators are listed basic-first: with stopAtFirstError the first
 * applied rule runs first, so a missing value reports "is required".
 */
export function IsStrongPasswordPolicy(field: string) {
  return applyDecorators(
    IsDefined({ message: `${field} is required` }),
    IsString(),
    MaxLength(PASSWORD_POLICY.maxLength),
    IsStrongPassword(
      {
        minLength: PASSWORD_POLICY.minLength,
        minLowercase: PASSWORD_POLICY.minLowercase,
        minUppercase: PASSWORD_POLICY.minUppercase,
        minNumbers: PASSWORD_POLICY.minNumbers,
        minSymbols: PASSWORD_POLICY.minSymbols,
      },
      {
        message:
          `${field} must be at least ${PASSWORD_POLICY.minLength} characters and contain ` +
          'a lowercase letter, an uppercase letter, a number and a symbol',
      },
    ),
  );
}
