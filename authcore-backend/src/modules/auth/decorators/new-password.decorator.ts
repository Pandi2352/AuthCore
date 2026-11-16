import { applyDecorators } from '@nestjs/common';
import { IsDefined, IsNotEmpty, IsString, MaxLength } from 'class-validator';

import { PASSWORD_MAX_LENGTH } from '../constants/auth.constants';

/**
 * Shape checks for a new password (register, reset, change). The rules
 * themselves (length, complexity, history...) come from the configurable
 * password policy and are applied by PasswordValidationService. The hard
 * maximum caps hashing work before anything else runs.
 */
export function IsNewPassword(field: string) {
  return applyDecorators(
    IsDefined({ message: `${field} is required` }),
    IsString(),
    IsNotEmpty({ message: `${field} is required` }),
    MaxLength(PASSWORD_MAX_LENGTH),
  );
}
