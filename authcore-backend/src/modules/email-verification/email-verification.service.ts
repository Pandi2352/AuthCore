import {
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { registrationConfig } from '@config/configuration';

import { VerificationMethod } from './enums/verification-method.enum';
import { EmailVerification } from './schemas/email-verification.schema';

/** Bytes of randomness in a link token (256 bits). */
const LINK_TOKEN_BYTES = 32;

export interface IssuedVerification {
  /** The code or token to put in the email. Never stored or logged. */
  secret: string;
  ttlMinutes: number;
}

export type OtpCheckResult = 'verified' | 'invalid' | 'attempts_exceeded';

/**
 * Issues and checks email verification codes (OTP) and link tokens.
 * Knows nothing about users or registration rules: callers pass a user id
 * and decide what a successful verification means.
 */
@Injectable()
export class EmailVerificationService {
  constructor(
    @InjectModel(EmailVerification.name)
    private readonly verificationModel: Model<EmailVerification>,
    @Inject(registrationConfig.KEY)
    private readonly registration: ConfigType<typeof registrationConfig>,
  ) {}

  /** Creates (or replaces) the user's pending verification. */
  async issue(
    userId: string,
    method: VerificationMethod,
  ): Promise<IssuedVerification> {
    const isOtp = method === VerificationMethod.Otp;
    const secret = isOtp ? this.generateOtp() : this.generateLinkToken();
    const ttlMinutes = isOtp
      ? this.registration.otpTtlMinutes
      : this.registration.linkTtlMinutes;
    const now = new Date();

    await this.verificationModel.findOneAndUpdate(
      { userId },
      {
        $set: {
          method,
          tokenHash: this.hash(method, isOtp ? `${userId}:${secret}` : secret),
          expiresAt: new Date(now.getTime() + ttlMinutes * 60_000),
          attempts: 0,
          lastSentAt: now,
        },
        $setOnInsert: { userId },
      },
      { upsert: true },
    );
    return { secret, ttlMinutes };
  }

  /** True if no verification was sent recently (resend cooldown). */
  async canResend(userId: string): Promise<boolean> {
    const pending = await this.verificationModel
      .findOne({ userId }, { lastSentAt: 1 })
      .lean();
    if (!pending) {
      return true;
    }
    const cooldownMs = this.registration.resendCooldownSeconds * 1000;
    return Date.now() - pending.lastSentAt.getTime() >= cooldownMs;
  }

  /**
   * Checks a code. Correct → the record is consumed (single use).
   * Wrong → attempts +1; at the limit the record is deleted and a new code
   * must be requested.
   */
  async verifyOtp(userId: string, code: string): Promise<OtpCheckResult> {
    const now = new Date();
    const pending = await this.verificationModel
      .findOne({
        userId,
        method: VerificationMethod.Otp,
        expiresAt: { $gt: now },
      })
      .lean();
    if (!pending) {
      return 'invalid';
    }

    const submittedHash = this.hash(
      VerificationMethod.Otp,
      `${userId}:${code}`,
    );
    if (this.isSameHash(submittedHash, pending.tokenHash)) {
      // Atomic consume: only one concurrent request can succeed.
      const consumed = await this.verificationModel.findOneAndDelete({
        _id: pending._id,
        tokenHash: pending.tokenHash,
      });
      return consumed ? 'verified' : 'invalid';
    }

    const updated = await this.verificationModel
      .findOneAndUpdate(
        { _id: pending._id },
        { $inc: { attempts: 1 } },
        { new: true, projection: { attempts: 1 } },
      )
      .lean();
    if (updated && updated.attempts >= this.registration.maxAttempts) {
      await this.verificationModel.deleteOne({ _id: pending._id });
      return 'attempts_exceeded';
    }
    return 'invalid';
  }

  /** Consumes a link token. Returns the user id, or null if invalid / expired / used. */
  async consumeLinkToken(token: string): Promise<string | null> {
    const consumed = await this.verificationModel
      .findOneAndDelete({
        method: VerificationMethod.Link,
        tokenHash: this.hash(VerificationMethod.Link, token),
        expiresAt: { $gt: new Date() },
      })
      .lean();
    return consumed?.userId ?? null;
  }

  /** Numeric code with leading zeros, e.g. "042917". Uniform (randomInt). */
  private generateOtp(): string {
    const length = this.registration.otpLength;
    return randomInt(0, 10 ** length)
      .toString()
      .padStart(length, '0');
  }

  private generateLinkToken(): string {
    return randomBytes(LINK_TOKEN_BYTES).toString('base64url');
  }

  /** HMAC with a server secret: a leaked database can't be brute-forced offline. */
  private hash(method: VerificationMethod, value: string): string {
    return createHmac('sha256', this.registration.tokenSecret)
      .update(`email-verification:${method}:${value}`)
      .digest('hex');
  }

  private isSameHash(a: string, b: string): boolean {
    const left = Buffer.from(a, 'hex');
    const right = Buffer.from(b, 'hex');
    return left.length === right.length && timingSafeEqual(left, right);
  }
}
