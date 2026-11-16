import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { ErrorCode } from '@common/constants/error-codes.constants';
import { AppException } from '@common/exceptions/app.exception';
import type { ClientInfo } from '@common/interfaces/client-info.interface';
import { generateUuid } from '@common/utils/uuid.util';
import type { MailContent } from '@modules/mail/interfaces/mail-message.interface';
import { MailService } from '@modules/mail/mail.service';
import {
  accountLockedEmail,
  newDeviceLoginEmail,
} from '@modules/mail/templates/mail-templates';
import { parseDeviceInfo } from '@modules/sessions/utils/device-info.util';
import {
  ActivityEvent,
  VerificationType,
} from '@modules/user-activity/enums/user-activity.enum';
import { UserActivityService } from '@modules/user-activity/user-activity.service';
import type { UserResponseDto } from '@modules/users/dto/user-response.dto';
import { UsersService } from '@modules/users/users.service';

import type { KnownDeviceDto } from '../dto/known-device.dto';
import { KnownDevice } from '../schemas/known-device.schema';
import { deviceFingerprint } from '../utils/device-fingerprint.util';

const DAY_MS = 86_400_000;

export interface SignInCheck {
  /** Signed in from a device not seen before (never true on the very first sign-in). */
  isNewDevice: boolean;
}

/**
 * Account-security notifications: new-device sign-in alerts (with the list of
 * known devices) and "account locked" emails. Never fails the sign-in that
 * triggered it: problems are logged.
 */
@Injectable()
export class LoginAlertsService {
  private readonly logger = new Logger(LoginAlertsService.name);

  constructor(
    @InjectModel(KnownDevice.name)
    private readonly deviceModel: Model<KnownDevice>,
    private readonly usersService: UsersService,
    private readonly activityService: UserActivityService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Remembers the device and, when it is new (and not the first ever), records
   * NEW_DEVICE_LOGIN and emails the user (unless they turned loginAlerts off).
   */
  async onSignIn(
    user: UserResponseDto,
    client: ClientInfo,
    sessionId: string,
  ): Promise<SignInCheck> {
    try {
      const isNewDevice = await this.rememberDevice(user.id, client);
      if (!isNewDevice) {
        return { isNewDevice: false };
      }
      const device = parseDeviceInfo(client.userAgent);
      await this.activityService.record({
        userId: user.id,
        event: ActivityEvent.NewDeviceLogin,
        client,
        verificationType: VerificationType.Password,
        sessionId,
        details: { deviceName: device.deviceName },
      });
      const isAlertSent =
        this.configService.getOrThrow<boolean>(
          'account.isNewDeviceAlertEnabled',
        ) && user.preferences.notifications.loginAlerts;
      if (isAlertSent) {
        await this.send(user, 'new-device-login', () =>
          newDeviceLoginEmail({
            appName: this.appName(),
            firstName: user.firstName,
            when: formatDate(new Date(), user.preferences.timezone),
            deviceName: device.deviceName,
            ipAddress: client.ipAddress,
          }),
        );
      }
      this.logger.log({
        message: 'Sign-in from a new device',
        userId: user.id,
        sessionId,
        isAlertSent,
      });
      return { isNewDevice: true };
    } catch (error) {
      this.logger.error(
        { message: 'New-device check failed', userId: user.id },
        error instanceof Error ? error.stack : undefined,
      );
      return { isNewDevice: false };
    }
  }

  /** The account was just locked: record it and email the user (security notice, always sent). */
  async onAccountLocked(
    userId: string,
    lockedUntil: Date,
    client: ClientInfo,
  ): Promise<void> {
    try {
      const attempts = this.configService.getOrThrow<number>(
        'auth.maxFailedAttempts',
      );
      await this.activityService.record({
        userId,
        event: ActivityEvent.AccountLocked,
        client,
        verificationType: VerificationType.Password,
        isSuccess: false,
        details: { lockedUntil: lockedUntil.toISOString(), attempts },
      });
      const user = await this.usersService.findById(userId);
      if (
        !user ||
        !this.configService.getOrThrow<boolean>(
          'account.isAccountLockedEmailEnabled',
        )
      ) {
        return;
      }
      await this.send(user, 'account-locked', () =>
        accountLockedEmail({
          appName: this.appName(),
          firstName: user.firstName,
          lockedUntil: formatDate(lockedUntil, user.preferences.timezone),
          attempts,
          ipAddress: client.ipAddress,
        }),
      );
    } catch (error) {
      this.logger.error(
        { message: 'Account-locked notice failed', userId },
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  async listDevices(userId: string): Promise<KnownDeviceDto[]> {
    const devices = await this.deviceModel
      .find({ userId })
      .sort({ lastSeenAt: -1 })
      .lean();
    return devices.map((d) => ({
      id: d._id,
      deviceName: d.deviceName,
      deviceType: d.deviceType,
      browser: d.browser,
      os: d.os,
      firstIpAddress: d.firstIpAddress,
      lastIpAddress: d.lastIpAddress,
      firstSeenAt: d.createdAt,
      lastSeenAt: d.lastSeenAt,
      signInCount: d.signInCount,
    }));
  }

  /** Forget a device: the next sign-in from it counts as new again. */
  async forgetDevice(userId: string, id: string): Promise<{ id: string }> {
    const result = await this.deviceModel.deleteOne({ _id: id, userId });
    if (result.deletedCount === 0) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NotFound,
        'Device not found',
      );
    }
    return { id };
  }

  /** true when the device wasn't known (and the user already had other devices). */
  private async rememberDevice(
    userId: string,
    client: ClientInfo,
  ): Promise<boolean> {
    const fingerprint = deviceFingerprint(client.userAgent);
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() +
        this.configService.getOrThrow<number>(
          'account.knownDeviceRetentionDays',
        ) *
          DAY_MS,
    );
    const known = await this.deviceModel.findOneAndUpdate(
      { userId, fingerprint },
      {
        $set: { lastIpAddress: client.ipAddress, lastSeenAt: now, expiresAt },
        $inc: { signInCount: 1 },
      },
      { projection: { _id: 1 } },
    );
    if (known) {
      return false;
    }
    const hasOtherDevices =
      (await this.deviceModel.exists({ userId })) !== null;
    const device = parseDeviceInfo(client.userAgent);
    try {
      await this.deviceModel.create({
        _id: generateUuid(),
        userId,
        fingerprint,
        deviceName: device.deviceName,
        deviceType: device.deviceType,
        browser: device.browser,
        os: device.os,
        firstIpAddress: client.ipAddress,
        lastIpAddress: client.ipAddress,
        lastSeenAt: now,
        signInCount: 1,
        expiresAt,
      });
    } catch (error) {
      // A parallel sign-in from the same device created it first.
      if ((error as { code?: unknown }).code === 11000) {
        return false;
      }
      throw error;
    }
    // The very first sign-in is not "a new device" worth an alert.
    return hasOtherDevices;
  }

  private appName(): string {
    return this.configService.getOrThrow<string>('registration.appName');
  }

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

/** e.g. "16 Nov 2026, 15:42 GMT+5:30" in the user's time zone. */
function formatDate(date: Date, timeZone: string): string {
  try {
    return (
      new Intl.DateTimeFormat('en-GB', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone,
      }).format(date) + ` (${timeZone})`
    );
  } catch {
    return `${date.toISOString()} (UTC)`;
  }
}
