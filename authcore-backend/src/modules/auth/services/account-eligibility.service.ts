import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';

import { ErrorCode } from '@common/constants/error-codes.constants';
import { registrationConfig } from '@config/configuration';
import { UserResponseDto } from '@modules/users/dto/user-response.dto';
import { UserStatus } from '@modules/users/enums/user-status.enum';

export interface AccountRefusal {
  code: ErrorCode;
  message: string;
}

/**
 * Who may hold a session: ACTIVE accounts, with a verified email when email
 * verification is on. Shared by login and refresh, so a suspended or
 * deactivated user also loses existing sessions on their next refresh.
 */
@Injectable()
export class AccountEligibilityService {
  constructor(
    @Inject(registrationConfig.KEY)
    private readonly registration: ConfigType<typeof registrationConfig>,
  ) {}

  /** null = allowed; otherwise the reason, safe to show to the user. */
  getRefusal(user: UserResponseDto): AccountRefusal | null {
    const notVerified: AccountRefusal = {
      code: ErrorCode.AuthEmailNotVerified,
      message: 'Verify your email address before signing in',
    };

    if (user.deletionScheduledAt) {
      return {
        code: ErrorCode.AuthAccountPendingDeletion,
        message: `This account is scheduled for deletion on ${user.deletionScheduledAt.toISOString().slice(0, 10)}. Use account recovery to keep it.`,
      };
    }

    switch (user.status) {
      case UserStatus.Active:
        return this.registration.emailVerification !== 'none' &&
          !user.isEmailVerified
          ? notVerified
          : null;
      case UserStatus.PendingVerification:
        return notVerified;
      case UserStatus.PendingApproval:
        return {
          code: ErrorCode.AuthAccountPendingApproval,
          message: 'Your account is waiting for approval by an administrator',
        };
      case UserStatus.Suspended:
        return {
          code: ErrorCode.AuthAccountSuspended,
          message: 'Your account is suspended. Contact support for help.',
        };
      case UserStatus.Inactive:
        return {
          code: ErrorCode.AuthAccountInactive,
          message:
            'Your account is deactivated. If you deactivated it yourself, reactivate it with account recovery; otherwise contact support.',
        };
      case UserStatus.Rejected:
      case UserStatus.Banned:
        return {
          code: ErrorCode.AuthAccountDisabled,
          message:
            'This account cannot be used to sign in. Contact support for help.',
        };
    }
  }
}
