import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';

import { ErrorCode } from '@common/constants/error-codes.constants';
import { AppException } from '@common/exceptions/app.exception';
import { ValidationException } from '@common/exceptions/validation.exception';
import type { AuthContext } from '@common/interfaces/auth-context.interface';
import type { ClientInfo } from '@common/interfaces/client-info.interface';
import { accountConfig, registrationConfig } from '@config/configuration';
import { PasswordManagementService } from '@modules/auth/services/password-management.service';
import type { MailContent } from '@modules/mail/interfaces/mail-message.interface';
import { MailService } from '@modules/mail/mail.service';
import {
  accountDeactivatedEmail,
  accountDeletionScheduledEmail,
  accountRecoveredEmail,
  accountRecoveryCodeEmail,
  emailChangeCodeEmail,
  emailChangedNoticeEmail,
} from '@modules/mail/templates/mail-templates';
import { SessionsService } from '@modules/sessions/sessions.service';
import type { UserResponseDto } from '@modules/users/dto/user-response.dto';
import { UserRole } from '@modules/users/enums/user-role.enum';
import { UserStatus } from '@modules/users/enums/user-status.enum';
import { UsersService } from '@modules/users/users.service';

import type {
  ChangeEmailDto,
  CloseAccountDto,
  DeletionScheduledDto,
  EmailChangeStartedDto,
  RecoveryConfirmDto,
  UpdatePreferencesDto,
  UpdateProfileDto,
} from '../dto/account.dto';
import { AccountCodePurpose } from '../enums/account-code-purpose.enum';
import { AccountCodeService, type CodeCheck } from './account-code.service';

const DAY_MS = 86_400_000;

/**
 * Self-service for the signed-in user: profile, preferences, email change,
 * deactivation, deletion; and public account recovery. Sensitive actions
 * need the current password (wrong guesses count toward the sign-in lockout).
 */
@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly sessionsService: SessionsService,
    private readonly passwordManagementService: PasswordManagementService,
    private readonly codeService: AccountCodeService,
    private readonly mailService: MailService,
    @Inject(accountConfig.KEY)
    private readonly config: ConfigType<typeof accountConfig>,
    @Inject(registrationConfig.KEY)
    private readonly registration: ConfigType<typeof registrationConfig>,
  ) {}

  async getProfile(auth: AuthContext): Promise<UserResponseDto> {
    return this.requireUser(auth.userId);
  }

  async updateProfile(
    auth: AuthContext,
    dto: UpdateProfileDto,
  ): Promise<UserResponseDto> {
    await this.requireUser(auth.userId);
    if (
      dto.username &&
      (await this.usersService.isUsernameTakenByOther(
        dto.username,
        auth.userId,
      ))
    ) {
      throw new AppException(
        HttpStatus.CONFLICT,
        ErrorCode.DuplicateResource,
        'This username is already taken',
        [{ field: 'username', message: 'username is already taken' }],
      );
    }
    const user = await this.usersService.updateProfile(auth.userId, {
      ...(dto.firstName !== undefined ? { firstName: dto.firstName } : {}),
      ...(dto.lastName !== undefined ? { lastName: dto.lastName } : {}),
      ...(dto.username !== undefined ? { username: dto.username } : {}),
    });
    this.logger.log({
      message: 'Profile updated',
      userId: auth.userId,
      fields: Object.keys(dto),
    });
    return user ?? this.requireUser(auth.userId);
  }

  async updatePreferences(
    auth: AuthContext,
    dto: UpdatePreferencesDto,
  ): Promise<UserResponseDto> {
    const user = await this.requireUser(auth.userId);
    if (dto.timezone !== undefined && !isValidTimeZone(dto.timezone)) {
      throw new ValidationException([
        {
          field: 'timezone',
          message: 'timezone must be a valid IANA time zone, e.g. Asia/Kolkata',
        },
      ]);
    }
    const preferences = {
      language: dto.language ?? user.preferences.language,
      timezone: dto.timezone ?? user.preferences.timezone,
      notifications: {
        productUpdates:
          dto.notifications?.productUpdates ??
          user.preferences.notifications.productUpdates,
        loginAlerts:
          dto.notifications?.loginAlerts ??
          user.preferences.notifications.loginAlerts,
      },
    };
    return (
      (await this.usersService.updatePreferences(auth.userId, preferences)) ??
      user
    );
  }

  /** Step 1: password check, then a code to the NEW address. Nothing changes yet. */
  async requestEmailChange(
    auth: AuthContext,
    dto: ChangeEmailDto,
    client: ClientInfo,
  ): Promise<EmailChangeStartedDto> {
    const account = await this.requirePassword(
      auth,
      dto.currentPassword,
      client,
    );
    if (dto.newEmail === account.user.email) {
      throw new ValidationException([
        {
          field: 'newEmail',
          message: 'newEmail is your current email address',
        },
      ]);
    }
    await this.assertEmailFree(dto.newEmail, auth.userId);
    await this.assertCanSend(auth.userId, AccountCodePurpose.EmailChange);
    const { code, ttlMinutes } = await this.codeService.issue(
      auth.userId,
      AccountCodePurpose.EmailChange,
      dto.newEmail,
    );
    await this.send(dto.newEmail, account.user, 'email-change-code', () =>
      emailChangeCodeEmail({
        appName: this.registration.appName,
        firstName: account.user.firstName,
        code,
        ttlMinutes,
      }),
    );
    this.logger.log({
      message: 'Email change requested',
      userId: auth.userId,
      ipAddress: client.ipAddress,
    });
    return { pendingEmail: dto.newEmail, expiresInMinutes: ttlMinutes };
  }

  /** Step 2: the code from the new address switches the email; the old address is notified. */
  async confirmEmailChange(
    auth: AuthContext,
    code: string,
    client: ClientInfo,
  ): Promise<UserResponseDto> {
    const user = await this.requireUser(auth.userId);
    const result = this.assertCodeOk(
      await this.codeService.verify(
        auth.userId,
        AccountCodePurpose.EmailChange,
        code,
      ),
    );
    const newEmail = result.newEmail ?? '';
    await this.assertEmailFree(newEmail, auth.userId);
    const updated = await this.usersService.changeEmail(
      auth.userId,
      user.email,
      newEmail,
    );
    if (!updated) {
      throw new AppException(
        HttpStatus.CONFLICT,
        ErrorCode.Conflict,
        'Your email changed in the meantime. Start again.',
      );
    }
    await this.send(user.email, user, 'email-changed-notice', () =>
      emailChangedNoticeEmail({
        appName: this.registration.appName,
        firstName: user.firstName,
        newEmail,
      }),
    );
    this.logger.log({
      message: 'Email changed',
      userId: auth.userId,
      ipAddress: client.ipAddress,
    });
    return updated;
  }

  /** Deactivates the account and signs out every device. Recoverable with account recovery. */
  async deactivate(
    auth: AuthContext,
    dto: CloseAccountDto,
    client: ClientInfo,
  ): Promise<void> {
    const account = await this.requirePassword(
      auth,
      dto.currentPassword,
      client,
    );
    await this.assertNotLastAdmin(account.user);
    const user = await this.usersService.setStatus(
      auth.userId,
      UserStatus.Inactive,
      {
        reason: dto.reason ?? 'Deactivated by the user',
        changedBy: auth.userId,
        fromStatuses: [UserStatus.Active],
      },
    );
    if (!user) {
      throw this.notAllowed('Only an active account can be deactivated');
    }
    const revoked = await this.sessionsService.revokeAllForUser(
      auth.userId,
      'account_deactivated',
    );
    await this.send(user.email, user, 'account-deactivated', () =>
      accountDeactivatedEmail({
        appName: this.registration.appName,
        firstName: user.firstName,
      }),
    );
    this.logger.log({
      message: 'Account deactivated by the user',
      userId: auth.userId,
      revokedSessionCount: revoked,
      ipAddress: client.ipAddress,
    });
  }

  /**
   * "Delete my account": deactivated now, permanently deleted after
   * ACCOUNT_DELETION_GRACE_DAYS unless recovered.
   */
  async requestDeletion(
    auth: AuthContext,
    dto: CloseAccountDto,
    client: ClientInfo,
  ): Promise<DeletionScheduledDto> {
    const account = await this.requirePassword(
      auth,
      dto.currentPassword,
      client,
    );
    await this.assertNotLastAdmin(account.user);
    const at = new Date(Date.now() + this.config.deletionGraceDays * DAY_MS);
    const user = await this.usersService.scheduleDeletion(
      auth.userId,
      at,
      dto.reason ?? null,
    );
    if (!user) {
      throw this.notAllowed('Deletion is already scheduled for this account');
    }
    const revoked = await this.sessionsService.revokeAllForUser(
      auth.userId,
      'account_deletion_requested',
    );
    await this.send(user.email, user, 'account-deletion-scheduled', () =>
      accountDeletionScheduledEmail({
        appName: this.registration.appName,
        firstName: user.firstName,
        deletionDate: at,
      }),
    );
    this.logger.log({
      message: 'Account deletion requested',
      userId: auth.userId,
      deletionScheduledAt: at,
      revokedSessionCount: revoked,
      ipAddress: client.ipAddress,
    });
    return { deletionScheduledAt: at };
  }

  /**
   * Public, same response for every email (no enumeration); the lookup and
   * email run in the background. Only accounts the user closed themselves
   * (self-deactivated or deletion scheduled) can be recovered.
   */
  requestRecovery(email: string, client: ClientInfo): void {
    void this.processRecoveryRequest(email, client).catch((error: unknown) => {
      this.logger.error(
        { message: 'Account recovery request failed' },
        error instanceof Error ? error.stack : undefined,
      );
    });
  }

  async confirmRecovery(
    dto: RecoveryConfirmDto,
    client: ClientInfo,
  ): Promise<void> {
    const user = await this.usersService.findByEmail(dto.email);
    const invalid = new AppException(
      HttpStatus.BAD_REQUEST,
      ErrorCode.AccountInvalidCode,
      'The code is invalid or has expired',
    );
    if (!user || !(await this.isRecoverable(user.id))) {
      throw invalid;
    }
    this.assertCodeOk(
      await this.codeService.verify(
        user.id,
        AccountCodePurpose.AccountRecovery,
        dto.code,
      ),
    );
    const recovered = await this.usersService.setStatus(
      user.id,
      UserStatus.Active,
      {
        reason: null,
        changedBy: user.id,
        fromStatuses: [UserStatus.Inactive],
      },
    );
    if (!recovered) {
      throw invalid;
    }
    await this.send(user.email, user, 'account-recovered', () =>
      accountRecoveredEmail({
        appName: this.registration.appName,
        firstName: user.firstName,
      }),
    );
    this.logger.log({
      message: 'Account recovered',
      userId: user.id,
      ipAddress: client.ipAddress,
    });
  }

  private async processRecoveryRequest(
    email: string,
    client: ClientInfo,
  ): Promise<void> {
    const user = await this.usersService.findByEmail(email);
    if (!user || !(await this.isRecoverable(user.id))) {
      this.logger.log({
        message:
          'Account recovery requested for an unknown or non-recoverable account',
        ipAddress: client.ipAddress,
      });
      return;
    }
    if (
      (await this.codeService.secondsUntilResend(
        user.id,
        AccountCodePurpose.AccountRecovery,
      )) > 0
    ) {
      return;
    }
    const { code, ttlMinutes } = await this.codeService.issue(
      user.id,
      AccountCodePurpose.AccountRecovery,
    );
    await this.send(user.email, user, 'account-recovery-code', () =>
      accountRecoveryCodeEmail({
        appName: this.registration.appName,
        firstName: user.firstName,
        code,
        ttlMinutes,
      }),
    );
    this.logger.log({
      message: 'Account recovery code sent',
      userId: user.id,
      ipAddress: client.ipAddress,
    });
  }

  /** Deactivated by the user (incl. pending deletion), not by an admin. */
  private async isRecoverable(userId: string): Promise<boolean> {
    const user = await this.usersService.findAdminById(userId);
    return (
      user !== null &&
      user.deletedAt === null &&
      user.status === UserStatus.Inactive &&
      user.statusChangedBy === user.id
    );
  }

  private async requireUser(userId: string): Promise<UserResponseDto> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        ErrorCode.AuthSessionRevoked,
        'Your session has ended. Sign in again.',
      );
    }
    return user;
  }

  private async requirePassword(
    auth: AuthContext,
    password: string,
    client: ClientInfo,
  ) {
    const account = await this.usersService.findPasswordHashes(auth.userId);
    if (!account) {
      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        ErrorCode.AuthSessionRevoked,
        'Your session has ended. Sign in again.',
      );
    }
    await this.passwordManagementService.verifyCurrentPassword(
      auth,
      account.passwordHash,
      password,
      client,
    );
    return account;
  }

  /** The last active ADMIN can't close their own account (nobody could manage AuthCore). */
  private async assertNotLastAdmin(user: UserResponseDto): Promise<void> {
    if (
      user.role === UserRole.Admin &&
      (await this.usersService.countActiveAdmins()) <= 1
    ) {
      throw this.notAllowed(
        'You are the last administrator. Make someone else ADMIN first.',
      );
    }
  }

  private async assertEmailFree(email: string, userId: string): Promise<void> {
    if (await this.usersService.isEmailTakenByOther(email, userId)) {
      throw new AppException(
        HttpStatus.CONFLICT,
        ErrorCode.AccountEmailInUse,
        'This email address is already used by another account',
        [{ field: 'newEmail', message: 'already in use' }],
      );
    }
  }

  private async assertCanSend(
    userId: string,
    purpose: AccountCodePurpose,
  ): Promise<void> {
    const wait = await this.codeService.secondsUntilResend(userId, purpose);
    if (wait > 0) {
      throw new AppException(
        HttpStatus.TOO_MANY_REQUESTS,
        ErrorCode.TooManyRequests,
        `A code was sent recently. Try again in ${String(wait)} seconds.`,
        [],
        { 'Retry-After': String(wait) },
      );
    }
  }

  private assertCodeOk(result: CodeCheck): { newEmail: string | null } {
    if (result.kind === 'attempts_exceeded') {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.AccountCodeAttemptsExceeded,
        'Too many wrong codes. Request a new code.',
      );
    }
    if (result.kind === 'invalid') {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.AccountInvalidCode,
        'The code is invalid or has expired',
      );
    }
    return { newEmail: result.newEmail };
  }

  private notAllowed(message: string): AppException {
    return new AppException(
      HttpStatus.CONFLICT,
      ErrorCode.AccountActionNotAllowed,
      message,
    );
  }

  /** Logs instead of failing the request when an email can't be sent. */
  private async send(
    to: string,
    user: UserResponseDto,
    template: string,
    render: () => MailContent,
  ): Promise<void> {
    try {
      await this.mailService.send({ to, template, ...render() });
    } catch (error) {
      this.logger.error(
        { message: 'Email could not be sent', template, userId: user.id },
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}

function isValidTimeZone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}
