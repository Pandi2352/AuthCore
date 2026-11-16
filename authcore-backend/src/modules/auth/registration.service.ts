import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';

import { ErrorCode } from '@common/constants/error-codes.constants';
import { AppException } from '@common/exceptions/app.exception';
import { ApiFieldError } from '@common/interfaces/api-response.interface';
import { registrationConfig } from '@config/configuration';
import { AccessMappingsService } from '@modules/access-control/services/access-mappings.service';
import { EmailVerificationService } from '@modules/email-verification/email-verification.service';
import { VerificationMethod } from '@modules/email-verification/enums/verification-method.enum';
import { MailContent } from '@modules/mail/interfaces/mail-message.interface';
import { MailService } from '@modules/mail/mail.service';
import {
  pendingApprovalEmail,
  verificationCodeEmail,
  verificationLinkEmail,
} from '@modules/mail/templates/mail-templates';
import { PasswordValidationService } from '@modules/password-policy/services/password-validation.service';
import { UserResponseDto } from '@modules/users/dto/user-response.dto';
import { UserStatus } from '@modules/users/enums/user-status.enum';
import { UsersService } from '@modules/users/users.service';
import { PasswordService } from '@shared/password.service';

import { RegisterDto } from './dto/register.dto';
import { RegisterResponseDto } from './dto/register-response.dto';
import { VerifyEmailResponseDto } from './dto/verify-email-response.dto';
import { RegistrationNextStep } from './enums/registration-next-step.enum';

/**
 * Registration flows, chosen by configuration:
 *
 * | REGISTRATION_EMAIL_VERIFICATION | REGISTRATION_REQUIRE_APPROVAL | Flow                                |
 * | none                            | false                         | Register → Login                    |
 * | otp / link                      | false                         | Register → Verify email → Login     |
 * | none                            | true                          | Register → Admin approval → Login   |
 * | otp / link                      | true                          | Register → Verify → Approval → Login |
 */
@Injectable()
export class RegistrationService {
  private readonly logger = new Logger(RegistrationService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly passwordService: PasswordService,
    private readonly passwordValidationService: PasswordValidationService,
    private readonly emailVerificationService: EmailVerificationService,
    private readonly mailService: MailService,
    private readonly mappingsService: AccessMappingsService,
    @Inject(registrationConfig.KEY)
    private readonly registration: ConfigType<typeof registrationConfig>,
  ) {}

  // ---------------------------------------------------------------------------
  // Register
  // ---------------------------------------------------------------------------

  /** Cheap checks first, the expensive password hash last. */
  async register(dto: RegisterDto): Promise<RegisterResponseDto> {
    await this.passwordValidationService.assertAcceptable(
      dto.password,
      'password',
      dto,
    );
    await this.assertIdentityAvailable(dto.email, dto.username);

    const passwordHash = await this.passwordService.hash(dto.password);
    const user = await this.usersService.create({
      email: dto.email,
      username: dto.username,
      firstName: dto.firstName,
      lastName: dto.lastName,
      passwordHash,
      status: this.initialStatus(),
    });
    // Ids only: no email or other personal data in logs.
    this.logger.log({
      message: 'User registered',
      userId: user.id,
      status: user.status,
    });
    await this.mappingsService.assignDefaultGroups(user.id, 'REGISTRATION');

    let isVerificationEmailSent = false;
    if (user.status === UserStatus.PendingVerification) {
      isVerificationEmailSent = await this.sendVerificationEmail(user);
    } else if (user.status === UserStatus.PendingApproval) {
      await this.sendBestEffort(user, 'pending-approval', () =>
        pendingApprovalEmail({
          appName: this.registration.appName,
          firstName: user.firstName,
        }),
      );
    }

    return {
      user,
      nextStep: this.nextStepFor(user.status),
      isVerificationEmailSent,
    };
  }

  // ---------------------------------------------------------------------------
  // Verify email
  // ---------------------------------------------------------------------------

  async verifyEmailOtp(
    email: string,
    code: string,
  ): Promise<VerifyEmailResponseDto> {
    this.assertMethodEnabled('otp');

    // Unknown email, wrong status and wrong code all get the same answer.
    const user = await this.usersService.findByEmail(email);
    if (!user || !this.needsEmailVerification(user)) {
      throw this.invalidCode();
    }

    const result = await this.emailVerificationService.verifyOtp(user.id, code);
    if (result === 'attempts_exceeded') {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.AuthVerificationAttemptsExceeded,
        'Too many incorrect codes. Request a new verification email.',
      );
    }
    if (result === 'invalid') {
      throw this.invalidCode();
    }
    return this.completeEmailVerification(user.id);
  }

  async verifyEmailLink(token: string): Promise<VerifyEmailResponseDto> {
    this.assertMethodEnabled('link');

    const userId = await this.emailVerificationService.consumeLinkToken(token);
    if (!userId) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.AuthInvalidVerificationToken,
        'This verification link is invalid or has expired',
      );
    }
    return this.completeEmailVerification(userId);
  }

  /**
   * Sends a new code / link. Always succeeds from the caller's point of view,
   * so it can't be used to find out which emails are registered.
   */
  async resendVerification(email: string): Promise<void> {
    if (this.registration.emailVerification === 'none') {
      throw this.methodNotEnabled();
    }
    const user = await this.usersService.findByEmail(email);
    if (!user || !this.needsEmailVerification(user)) {
      return;
    }
    if (!(await this.emailVerificationService.canResend(user.id))) {
      return;
    }
    await this.sendVerificationEmail(user);
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * Unverified and waiting for it: PENDING_VERIFICATION, or ACTIVE accounts
   * created before email verification was turned on (login asks them to verify).
   */
  private needsEmailVerification(user: UserResponseDto): boolean {
    return (
      !user.isEmailVerified &&
      (user.status === UserStatus.PendingVerification ||
        user.status === UserStatus.Active)
    );
  }

  private initialStatus(): UserStatus {
    if (this.registration.emailVerification !== 'none') {
      return UserStatus.PendingVerification;
    }
    return this.registration.isApprovalRequired
      ? UserStatus.PendingApproval
      : UserStatus.Active;
  }

  private nextStepFor(status: UserStatus): RegistrationNextStep {
    if (status === UserStatus.PendingVerification) {
      return this.registration.emailVerification === 'link'
        ? RegistrationNextStep.VerifyEmailLink
        : RegistrationNextStep.VerifyEmailOtp;
    }
    return status === UserStatus.PendingApproval
      ? RegistrationNextStep.AwaitApproval
      : RegistrationNextStep.Login;
  }

  /**
   * Email verified: PENDING_VERIFICATION → ACTIVE (or PENDING_APPROVAL when
   * approval is required); an ACTIVE unverified account stays ACTIVE.
   */
  private async completeEmailVerification(
    userId: string,
  ): Promise<VerifyEmailResponseDto> {
    const current = await this.usersService.findById(userId);
    if (!current || !this.needsEmailVerification(current)) {
      throw this.invalidCode();
    }
    const fromStatus =
      current.status === UserStatus.Active
        ? UserStatus.Active
        : UserStatus.PendingVerification;
    const nextStatus =
      fromStatus === UserStatus.Active || !this.registration.isApprovalRequired
        ? UserStatus.Active
        : UserStatus.PendingApproval;
    const user = await this.usersService.markEmailVerified(
      userId,
      fromStatus,
      nextStatus,
    );
    if (!user) {
      // Already verified or no longer pending (e.g. a parallel request won).
      throw this.invalidCode();
    }
    this.logger.log({
      message: 'Email verified',
      userId,
      status: user.status,
    });

    if (user.status === UserStatus.PendingApproval) {
      await this.sendBestEffort(user, 'pending-approval', () =>
        pendingApprovalEmail({
          appName: this.registration.appName,
          firstName: user.firstName,
        }),
      );
    }
    return { nextStep: this.nextStepFor(user.status) };
  }

  /**
   * Issues a code / link and emails it. Returns false if sending failed; the
   * account still exists and the user can request a new email.
   */
  private async sendVerificationEmail(user: UserResponseDto): Promise<boolean> {
    const isLink = this.registration.emailVerification === 'link';
    const { secret, ttlMinutes } = await this.emailVerificationService.issue(
      user.id,
      isLink ? VerificationMethod.Link : VerificationMethod.Otp,
    );
    const appName = this.registration.appName;

    return this.sendBestEffort(
      user,
      isLink ? 'verification-link' : 'verification-code',
      () =>
        isLink
          ? verificationLinkEmail({
              appName,
              firstName: user.firstName,
              link: this.buildVerificationLink(secret),
              ttlMinutes,
            })
          : verificationCodeEmail({
              appName,
              firstName: user.firstName,
              code: secret,
              ttlMinutes,
            }),
    );
  }

  private buildVerificationLink(token: string): string {
    const url = new URL(this.registration.verificationUrl);
    url.searchParams.set('token', token);
    return url.toString();
  }

  /** Sends an email; logs and returns false on failure instead of throwing. */
  private async sendBestEffort(
    user: UserResponseDto,
    template: string,
    render: () => MailContent,
  ): Promise<boolean> {
    try {
      await this.mailService.send({ to: user.email, template, ...render() });
      return true;
    } catch (error) {
      this.logger.error(
        { message: 'Email could not be sent', template, userId: user.id },
        error instanceof Error ? error.stack : undefined,
      );
      return false;
    }
  }

  private assertMethodEnabled(method: 'otp' | 'link'): void {
    if (this.registration.emailVerification !== method) {
      throw this.methodNotEnabled();
    }
  }

  private methodNotEnabled(): AppException {
    return new AppException(
      HttpStatus.NOT_FOUND,
      ErrorCode.NotFound,
      'This verification method is not enabled',
    );
  }

  private invalidCode(): AppException {
    return new AppException(
      HttpStatus.BAD_REQUEST,
      ErrorCode.AuthInvalidVerificationCode,
      'The verification code is invalid or has expired',
    );
  }

  /** 409 if the email or username is already registered. */
  private async assertIdentityAvailable(
    email: string,
    username: string | undefined,
  ): Promise<void> {
    const [isEmailTaken, isUsernameTaken] = await Promise.all([
      this.usersService.isEmailTaken(email),
      username === undefined
        ? Promise.resolve(false)
        : this.usersService.isUsernameTaken(username),
    ]);

    const errors: ApiFieldError[] = [];
    if (isEmailTaken) {
      errors.push({ field: 'email', message: 'email is already registered' });
    }
    if (isUsernameTaken) {
      errors.push({ field: 'username', message: 'username is already taken' });
    }
    if (errors.length > 0) {
      throw new AppException(
        HttpStatus.CONFLICT,
        ErrorCode.DuplicateResource,
        'An account with these details already exists',
        errors,
      );
    }
  }
}
