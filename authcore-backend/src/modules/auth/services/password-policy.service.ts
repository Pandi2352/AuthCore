import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';

import { ErrorCode } from '@common/constants/error-codes.constants';
import { AppException } from '@common/exceptions/app.exception';
import { ValidationException } from '@common/exceptions/validation.exception';
import { passwordResetConfig } from '@config/configuration';
import { PasswordService } from '@shared/password.service';

import { PASSWORD_PERSONAL_INFO_MIN_LENGTH } from '../constants/auth.constants';

export interface PersonalInfo {
  email: string;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}

/**
 * Password rules beyond the DTO checks (strength, length), shared by
 * register, reset and change:
 * - must not contain the user's email name, username or names
 * - must differ from the current password and the last PASSWORD_HISTORY_SIZE
 */
@Injectable()
export class PasswordPolicyService {
  constructor(
    private readonly passwordService: PasswordService,
    @Inject(passwordResetConfig.KEY)
    private readonly config: ConfigType<typeof passwordResetConfig>,
  ) {}

  get historySize(): number {
    return this.config.historySize;
  }

  assertNotPersonal(
    password: string,
    info: PersonalInfo,
    field = 'password',
  ): void {
    const lower = password.toLowerCase();
    const parts = [
      info.email.split('@')[0],
      info.username,
      info.firstName,
      info.lastName,
    ]
      .filter((part): part is string => typeof part === 'string')
      .map((part) => part.toLowerCase())
      .filter((part) => part.length >= PASSWORD_PERSONAL_INFO_MIN_LENGTH);

    if (parts.some((part) => lower.includes(part))) {
      throw new ValidationException([
        {
          field,
          message: `${field} must not contain your email, username or name`,
        },
      ]);
    }
  }

  /**
   * Rejects the current password and the most recent PASSWORD_HISTORY_SIZE.
   * (One Argon2 verify per stored hash: at most 1 + history size.)
   */
  async assertNotReused(
    password: string,
    currentHash: string,
    history: string[],
    field = 'newPassword',
  ): Promise<void> {
    const recent = this.historySize > 0 ? history.slice(-this.historySize) : [];
    for (const hash of [currentHash, ...recent]) {
      if (await this.passwordService.verify(hash, password)) {
        throw new AppException(
          HttpStatus.BAD_REQUEST,
          ErrorCode.AuthPasswordReused,
          this.historySize > 0
            ? `Choose a password you haven't used recently (your current and last ${this.historySize} passwords can't be reused)`
            : 'The new password must be different from the current one',
          [{ field, message: `${field} was used before` }],
        );
      }
    }
  }
}
