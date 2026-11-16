import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';

import { ErrorCode } from '@common/constants/error-codes.constants';
import { AppException } from '@common/exceptions/app.exception';
import type { AuthContext } from '@common/interfaces/auth-context.interface';
import type { ClientInfo } from '@common/interfaces/client-info.interface';
import { passwordResetConfig, registrationConfig } from '@config/configuration';
import type { MailContent } from '@modules/mail/interfaces/mail-message.interface';
import { MailService } from '@modules/mail/mail.service';
import {
  passwordChangedEmail,
  passwordResetCodeEmail,
  passwordResetLinkEmail,
} from '@modules/mail/templates/mail-templates';
import { PasswordResetService } from '@modules/password-reset/password-reset.service';
import { PasswordResetMethod } from '@modules/password-reset/schemas/password-reset.schema';
import { SessionsService } from '@modules/sessions/sessions.service';
import type { UserResponseDto } from '@modules/users/dto/user-response.dto';
import { UserStatus } from '@modules/users/enums/user-status.enum';
import { UsersService } from '@modules/users/users.service';
import { PasswordService } from '@shared/password.service';

import type {
  ChangePasswordDto,
  ChangePasswordResponseDto,
  ResetPasswordDto,
  VerifyResetTokenDto,
  VerifyResetTokenResponseDto,
} from '../dto/password.dto';
import { AccountEligibilityService } from './account-eligibility.service';
import { LoginSecurityService } from './login-security.service';
import { PasswordPolicyService } from './password-policy.service';

/**
 * Accounts that may reset their password. Suspended, banned, rejected and
 * deactivated accounts get no reset email (and the response doesn't say so).
 */
const RESETTABLE_STATUSES: ReadonlySet<UserStatus> = new Set([
  UserStatus.Active,
  UserStatus.PendingVerification,
  UserStatus.PendingApproval,
]);

/**
 * Forgot password → verify code / link → reset password, and change password
 * for a signed-in user.
 */
@Injectable()
export class PasswordManagementService {
  private readonly logger = new Logger(PasswordManagementService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly sessionsService: SessionsService,
    private readonly passwordService: PasswordService,
    private readonly passwordPolicyService: PasswordPolicyService,
    private readonly passwordResetService: PasswordResetService,
    private readonly loginSecurityService: LoginSecurityService,
    private readonly accountEligibilityService: AccountEligibilityService,
    private readonly mailService: MailService,
    @Inject(passwordResetConfig.KEY)
    private readonly config: ConfigType<typeof passwordResetConfig>,
    @Inject(registrationConfig.KEY)
    private readonly registration: ConfigType<typeof registrationConfig>,
  ) {}

  /**
   * Always returns immediately with the same response. The lookup and the
   * email run in the background, so neither the response nor its timing
   * reveals whether the email is registered.
   */
  forgotPassword(email: string, client: ClientInfo): void {
    void this.processForgotPassword(email, client).catch((error: unknown) => {
      this.logger.error(
        {
          message: 'Password reset request failed',
          ipAddress: client.ipAddress,
        },
        error instanceof Error ? error.stack : undefined,
      );
    });
  }

  async verifyResetToken(
    dto: VerifyResetTokenDto,
    client: ClientInfo,
  ): Promise<VerifyResetTokenResponseDto> {
    const isLink = dto.token !== undefined;
    const expected = isLink
      ? PasswordResetMethod.Link
      : PasswordResetMethod.Otp;
    if (this.passwordResetService.method !== expected) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NotFound,
        `Password reset by ${isLink ? 'link' : 'code'} is not enabled`,
      );
    }

    const result = isLink
      ? await this.passwordResetService.verifyLinkToken(dto.token ?? '')
      : await this.verifyCode(dto.email ?? '', dto.code ?? '');

    if (result.kind === 'attempts_exceeded') {
      this.logger.warn({
        message: 'Password reset code locked after too many attempts',
        ipAddress: client.ipAddress,
      });
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.AuthResetAttemptsExceeded,
        'Too many wrong codes. Request a new password reset code.',
      );
    }
    if (result.kind === 'invalid') {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.AuthInvalidResetCode,
        isLink
          ? 'The reset link is invalid or has expired'
          : 'The reset code is invalid or has expired',
      );
    }

    this.logger.log({
      message: 'Password reset verified',
      userId: result.userId,
      method: expected,
      ipAddress: client.ipAddress,
    });
    return { resetToken: result.resetToken, expiresIn: result.expiresIn };
  }

  /**
   * Sets a new password with a reset token. The password rules are checked
   * before the token is consumed, so a rejected password can be retried
   * with the same token. Afterwards every session is signed out.
   */
  async resetPassword(
    dto: ResetPasswordDto,
    client: ClientInfo,
  ): Promise<void> {
    const userId = await this.passwordResetService.peekResetToken(
      dto.resetToken,
    );
    const account = userId
      ? await this.usersService.findPasswordHashes(userId)
      : null;
    if (!userId || !account) {
      throw this.invalidResetToken();
    }
    this.assertCanReset(account.user);

    await this.assertNewPasswordAllowed(dto.newPassword, account);
    const newHash = await this.passwordService.hash(dto.newPassword);

    // Single use: only one request can consume the token.
    if (
      (await this.passwordResetService.consumeResetToken(dto.resetToken)) !==
      userId
    ) {
      throw this.invalidResetToken();
    }
    const isUpdated = await this.usersService.changePasswordHash(
      userId,
      account.passwordHash,
      newHash,
      this.config.historySize,
    );
    if (!isUpdated) {
      // The password changed in between: the reset no longer applies.
      throw this.invalidResetToken();
    }

    const revokedSessionCount = await this.sessionsService.revokeAllForUser(
      userId,
      'password_reset',
    );
    // A forgotten password often follows failed sign-ins: unlock the account.
    await this.loginSecurityService.clear(
      this.loginSecurityService.keyFor(userId, ''),
    );

    this.logger.log({
      message: 'Password reset',
      userId,
      revokedSessionCount,
      ipAddress: client.ipAddress,
    });
    this.sendInBackground(account.user, 'password-changed', () =>
      passwordChangedEmail({
        appName: this.registration.appName,
        firstName: account.user.firstName,
        isReset: true,
      }),
    );
  }

  /**
   * Changes the password of the signed-in user. This device stays signed in;
   * all other devices are signed out. Wrong current passwords count toward
   * the sign-in lockout, so a stolen access token can't be used to guess it.
   */
  async changePassword(
    auth: AuthContext,
    dto: ChangePasswordDto,
    client: ClientInfo,
  ): Promise<ChangePasswordResponseDto> {
    const account = await this.usersService.findPasswordHashes(auth.userId);
    if (!account) {
      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        ErrorCode.AuthSessionRevoked,
        'Your session has ended. Sign in again.',
      );
    }

    const lockKey = this.loginSecurityService.keyFor(auth.userId, '');
    const lockedUntil = await this.loginSecurityService.getActiveLock(lockKey);
    if (lockedUntil) {
      throw this.loginSecurityService.lockedException(lockedUntil);
    }
    const isCurrentCorrect = await this.passwordService.verify(
      account.passwordHash,
      dto.currentPassword,
    );
    if (!isCurrentCorrect) {
      await this.rejectCurrentPassword(lockKey, auth, client);
    }

    await this.assertNewPasswordAllowed(dto.newPassword, account);
    const newHash = await this.passwordService.hash(dto.newPassword);
    const isUpdated = await this.usersService.changePasswordHash(
      auth.userId,
      account.passwordHash,
      newHash,
      this.config.historySize,
    );
    if (!isUpdated) {
      throw new AppException(
        HttpStatus.CONFLICT,
        ErrorCode.Conflict,
        'Your password was changed by another request. Try again.',
      );
    }

    const revokedSessionCount = await this.sessionsService.revokeAllForUser(
      auth.userId,
      'password_changed',
      auth.sessionId,
    );
    await this.passwordResetService.invalidateForUser(auth.userId);
    await this.loginSecurityService.clear(lockKey);

    this.logger.log({
      message: 'Password changed',
      userId: auth.userId,
      sessionId: auth.sessionId,
      revokedSessionCount,
      ipAddress: client.ipAddress,
    });
    this.sendInBackground(account.user, 'password-changed', () =>
      passwordChangedEmail({
        appName: this.registration.appName,
        firstName: account.user.firstName,
        isReset: false,
      }),
    );
    return { revokedSessionCount, isCurrentSessionKept: true };
  }

  private async processForgotPassword(
    email: string,
    client: ClientInfo,
  ): Promise<void> {
    const user = await this.usersService.findByEmail(email);
    if (!user || !RESETTABLE_STATUSES.has(user.status)) {
      this.logger.log({
        message:
          'Password reset requested for an unknown or ineligible account',
        reason: user ? `status_${user.status}` : 'unknown_email',
        ipAddress: client.ipAddress,
      });
      return;
    }
    if (!(await this.passwordResetService.canSend(user.id))) {
      this.logger.log({
        message: 'Password reset email skipped: cooldown',
        userId: user.id,
        ipAddress: client.ipAddress,
      });
      return;
    }

    const { secret, ttlMinutes } = await this.passwordResetService.issue(
      user.id,
    );
    const isLink =
      this.passwordResetService.method === PasswordResetMethod.Link;
    this.logger.log({
      message: 'Password reset requested',
      userId: user.id,
      method: this.passwordResetService.method,
      ipAddress: client.ipAddress,
    });
    await this.send(
      user,
      isLink ? 'password-reset-link' : 'password-reset-code',
      () =>
        isLink
          ? passwordResetLinkEmail({
              appName: this.registration.appName,
              firstName: user.firstName,
              link: this.buildResetLink(secret),
              ttlMinutes,
            })
          : passwordResetCodeEmail({
              appName: this.registration.appName,
              firstName: user.firstName,
              code: secret,
              ttlMinutes,
            }),
    );
  }

  private async verifyCode(email: string, code: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      return { kind: 'invalid' } as const;
    }
    return this.passwordResetService.verifyCode(user.id, code);
  }

  private assertCanReset(user: UserResponseDto): void {
    if (!RESETTABLE_STATUSES.has(user.status)) {
      const refusal = this.accountEligibilityService.getRefusal(user);
      throw new AppException(
        HttpStatus.FORBIDDEN,
        refusal?.code ?? ErrorCode.AuthAccountDisabled,
        refusal?.message ?? 'This account cannot reset its password',
      );
    }
  }

  private async assertNewPasswordAllowed(
    newPassword: string,
    account: { user: UserResponseDto; passwordHash: string; history: string[] },
  ): Promise<void> {
    this.passwordPolicyService.assertNotPersonal(
      newPassword,
      account.user,
      'newPassword',
    );
    await this.passwordPolicyService.assertNotReused(
      newPassword,
      account.passwordHash,
      account.history,
    );
  }

  private async rejectCurrentPassword(
    lockKey: string,
    auth: AuthContext,
    client: ClientInfo,
  ): Promise<never> {
    const { lockedUntil } =
      await this.loginSecurityService.recordFailure(lockKey);
    this.logger.warn({
      message: 'Password change failed: wrong current password',
      userId: auth.userId,
      sessionId: auth.sessionId,
      isLocked: lockedUntil !== null,
      ipAddress: client.ipAddress,
    });
    if (lockedUntil) {
      throw this.loginSecurityService.lockedException(lockedUntil);
    }
    throw new AppException(
      HttpStatus.BAD_REQUEST,
      ErrorCode.AuthInvalidCurrentPassword,
      'The current password is incorrect',
      [{ field: 'currentPassword', message: 'currentPassword is incorrect' }],
    );
  }

  private invalidResetToken(): AppException {
    return new AppException(
      HttpStatus.BAD_REQUEST,
      ErrorCode.AuthInvalidResetToken,
      'The reset token is invalid or has expired. Request a new password reset.',
    );
  }

  private buildResetLink(token: string): string {
    const url = new URL(this.config.resetUrl);
    url.searchParams.set('token', token);
    return url.toString();
  }

  private sendInBackground(
    user: UserResponseDto,
    template: string,
    render: () => MailContent,
  ): void {
    void this.send(user, template, render);
  }

  /** Sends an email; logs instead of throwing on failure. */
  private async send(
    user: UserResponseDto,
    template: string,
    render: () => MailContent,
  ): Promise<void> {
    try {
      await this.mailService.send({ to: user.email, template, ...render() });
    } catch (error) {
      this.logger.error(
        { message: 'Email could not be sent', template, userId: user.id },
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
