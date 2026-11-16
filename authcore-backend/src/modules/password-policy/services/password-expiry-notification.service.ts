import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { registrationConfig } from '@config/configuration';
import { mailLocaleOf } from '@modules/mail/locales/mail-locales';
import { MailService } from '@modules/mail/mail.service';
import { passwordExpiryReminderEmail } from '@modules/mail/templates/mail-templates';
import type { UserResponseDto } from '@modules/users/dto/user-response.dto';
import { UsersService } from '@modules/users/users.service';

import { NotificationStatus } from '../enums/scheduler.enum';
import { PasswordExpiryNotification } from '../schemas/password-expiry-notification.schema';
import { PasswordPolicyService } from './password-policy.service';

const DAY_MS = 86_400_000;
/** Upper bound per run; the next run continues with the rest. */
const BATCH_LIMIT = 1000;
const MAX_SEND_ATTEMPTS = 3;
const RECORD_RETENTION_DAYS = 30;

export type ExpiryRunSummary = Record<string, number | string>;

/**
 * Emails users whose password expires soon. For each user only the closest
 * reminder threshold applies (e.g. 3 days left → the "3 days" email), and the
 * (user, password, threshold) record makes sure it is sent once. Failed sends
 * are retried on later runs, up to MAX_SEND_ATTEMPTS.
 */
@Injectable()
export class PasswordExpiryNotificationService {
  private readonly logger = new Logger(PasswordExpiryNotificationService.name);

  constructor(
    @InjectModel(PasswordExpiryNotification.name)
    private readonly notificationModel: Model<PasswordExpiryNotification>,
    private readonly passwordPolicyService: PasswordPolicyService,
    private readonly usersService: UsersService,
    private readonly mailService: MailService,
    @Inject(registrationConfig.KEY)
    private readonly registration: ConfigType<typeof registrationConfig>,
  ) {}

  async run(now = new Date()): Promise<ExpiryRunSummary> {
    const { passwordValidity: validity } =
      await this.passwordPolicyService.getRules();
    if (
      !validity.enabled ||
      validity.notificationDaysBeforeExpiry.length === 0
    ) {
      return {
        skipped: 'Password validity is disabled or has no reminder days',
      };
    }
    const thresholds = [...validity.notificationDaysBeforeExpiry].sort(
      (a, b) => a - b,
    );
    const furthest = thresholds[thresholds.length - 1] ?? 0;
    const validityMs = validity.validityDays * DAY_MS;

    // Expiring within (now, now + furthest days]: changed within this window.
    const users = await this.usersService.findByPasswordChangedBetween(
      new Date(now.getTime() - validityMs),
      new Date(now.getTime() - validityMs + furthest * DAY_MS),
      BATCH_LIMIT,
    );

    const summary = {
      usersChecked: users.length,
      sent: 0,
      failed: 0,
      alreadyNotified: 0,
      gaveUp: 0,
    };
    for (const user of users) {
      const expiresAt = new Date(user.passwordChangedAt.getTime() + validityMs);
      const daysLeft = Math.ceil(
        (expiresAt.getTime() - now.getTime()) / DAY_MS,
      );
      const threshold = thresholds.find((days) => daysLeft <= days);
      if (threshold === undefined || daysLeft < 1) {
        continue;
      }
      const outcome = await this.notify(user, threshold, daysLeft, expiresAt);
      summary[outcome] += 1;
    }
    return summary;
  }

  private async notify(
    user: UserResponseDto,
    threshold: number,
    daysLeft: number,
    expiresAt: Date,
  ): Promise<'sent' | 'failed' | 'alreadyNotified' | 'gaveUp'> {
    const key = {
      userId: user.id,
      passwordChangedAt: user.passwordChangedAt,
      daysBeforeExpiry: threshold,
    };
    const existing = await this.notificationModel
      .findOne(key, { status: 1, attempts: 1 })
      .lean();
    if (existing?.status === NotificationStatus.Sent) {
      return 'alreadyNotified';
    }
    if (existing && existing.attempts >= MAX_SEND_ATTEMPTS) {
      return 'gaveUp';
    }

    try {
      // Claim the send (unique index: a concurrent claim fails with a duplicate key).
      await this.notificationModel.findOneAndUpdate(
        { ...key, status: { $ne: NotificationStatus.Sent } },
        {
          $set: { status: NotificationStatus.Failed },
          $inc: { attempts: 1 },
          $setOnInsert: {
            expiresAt: new Date(
              expiresAt.getTime() + RECORD_RETENTION_DAYS * DAY_MS,
            ),
          },
        },
        { upsert: true },
      );
    } catch {
      return 'alreadyNotified';
    }

    try {
      await this.mailService.send({
        to: user.email,
        template: 'password-expiry-reminder',
        ...passwordExpiryReminderEmail({
          appName: this.registration.appName,
          firstName: user.firstName,
          ...mailLocaleOf(user),
          daysLeft,
          expiresAt,
        }),
      });
      await this.notificationModel.updateOne(key, {
        $set: { status: NotificationStatus.Sent, sentAt: new Date() },
      });
      return 'sent';
    } catch (error) {
      this.logger.error(
        {
          message: 'Password expiry reminder could not be sent',
          userId: user.id,
        },
        error instanceof Error ? error.stack : undefined,
      );
      return 'failed';
    }
  }
}
