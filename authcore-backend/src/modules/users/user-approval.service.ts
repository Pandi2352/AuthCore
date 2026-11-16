import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';

import { ErrorCode } from '@common/constants/error-codes.constants';
import { AppException } from '@common/exceptions/app.exception';
import { registrationConfig } from '@config/configuration';
import { MailService } from '@modules/mail/mail.service';
import {
  accountApprovedEmail,
  accountRejectedEmail,
} from '@modules/mail/templates/mail-templates';

import { UserResponseDto } from './dto/user-response.dto';
import { UsersService } from './users.service';

/**
 * Admin review of registrations (REGISTRATION_REQUIRE_APPROVAL=true).
 * Used by the CLI script now; the Admin module's HTTP endpoints will call
 * the same methods, passing the admin's user id as `reviewedBy`.
 */
@Injectable()
export class UserApprovalService {
  private readonly logger = new Logger(UserApprovalService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly mailService: MailService,
    @Inject(registrationConfig.KEY)
    private readonly registration: ConfigType<typeof registrationConfig>,
  ) {}

  listPending(): Promise<UserResponseDto[]> {
    return this.usersService.listPendingApproval();
  }

  async approve(email: string, reviewedBy: string): Promise<UserResponseDto> {
    const user = await this.findPendingByEmail(email);
    const approved = await this.usersService.approve(user.id, reviewedBy);
    if (!approved) {
      throw this.notPending();
    }
    this.logger.log({
      message: 'Registration approved',
      userId: user.id,
      reviewedBy,
    });
    await this.notify(approved, () =>
      accountApprovedEmail({
        appName: this.registration.appName,
        firstName: approved.firstName,
      }),
    );
    return approved;
  }

  async reject(
    email: string,
    reviewedBy: string,
    reason: string | null,
  ): Promise<UserResponseDto> {
    const user = await this.findPendingByEmail(email);
    const rejected = await this.usersService.reject(
      user.id,
      reviewedBy,
      reason,
    );
    if (!rejected) {
      throw this.notPending();
    }
    this.logger.log({
      message: 'Registration rejected',
      userId: user.id,
      reviewedBy,
    });
    await this.notify(rejected, () =>
      accountRejectedEmail({
        appName: this.registration.appName,
        firstName: rejected.firstName,
        reason: reason ?? undefined,
      }),
    );
    return rejected;
  }

  private async findPendingByEmail(email: string): Promise<UserResponseDto> {
    const user = await this.usersService.findByEmail(
      email.trim().toLowerCase(),
    );
    if (!user) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NotFound,
        'User not found',
      );
    }
    return user;
  }

  private notPending(): AppException {
    return new AppException(
      HttpStatus.CONFLICT,
      ErrorCode.Conflict,
      'User is not waiting for approval',
    );
  }

  /** The decision is saved even if the email fails; the failure is logged. */
  private async notify(
    user: UserResponseDto,
    render: () => { subject: string; text: string; html: string },
  ): Promise<void> {
    try {
      await this.mailService.send({
        to: user.email,
        template: 'registration-review',
        ...render(),
      });
    } catch (error) {
      this.logger.error(
        { message: 'Review notification email failed', userId: user.id },
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
