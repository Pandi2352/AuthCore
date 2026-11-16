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

import { passwordResetConfig } from '@config/configuration';

import {
  PasswordReset,
  PasswordResetMethod,
} from './schemas/password-reset.schema';

const OTP_LENGTH = 6;
const TOKEN_BYTES = 32;
const MINUTE_MS = 60_000;

export interface IssuedPasswordReset {
  /** Code or link token for the email. Never stored or logged. */
  secret: string;
  ttlMinutes: number;
}

export type ResetCodeResult =
  | { kind: 'verified'; userId: string; resetToken: string; expiresIn: number }
  | { kind: 'invalid' }
  | { kind: 'attempts_exceeded' };

/**
 * Issues and checks password-reset codes / links and the short-lived reset
 * tokens that authorize the actual reset. Knows nothing about users or
 * passwords; callers decide what a successful check allows.
 */
@Injectable()
export class PasswordResetService {
  constructor(
    @InjectModel(PasswordReset.name)
    private readonly resetModel: Model<PasswordReset>,
    @Inject(passwordResetConfig.KEY)
    private readonly config: ConfigType<typeof passwordResetConfig>,
  ) {}

  get method(): PasswordResetMethod {
    return this.config.method === 'link'
      ? PasswordResetMethod.Link
      : PasswordResetMethod.Otp;
  }

  /** False while the last reset email for this user is within the cooldown. */
  async canSend(userId: string): Promise<boolean> {
    const pending = await this.resetModel
      .findOne({ userId }, { lastSentAt: 1 })
      .lean();
    if (!pending) {
      return true;
    }
    const cooldownMs = this.config.resendCooldownSeconds * 1000;
    return Date.now() - pending.lastSentAt.getTime() >= cooldownMs;
  }

  /** Creates (or replaces) the user's reset: previous codes and reset tokens stop working. */
  async issue(userId: string): Promise<IssuedPasswordReset> {
    const method = this.method;
    const secret =
      method === PasswordResetMethod.Otp
        ? randomInt(0, 10 ** OTP_LENGTH)
            .toString()
            .padStart(OTP_LENGTH, '0')
        : randomBytes(TOKEN_BYTES).toString('base64url');
    const now = new Date();

    await this.resetModel.findOneAndUpdate(
      { userId },
      {
        $set: {
          method,
          codeHash: this.codeHash(method, userId, secret),
          attempts: 0,
          authorizationHash: null,
          authorizationExpiresAt: null,
          lastSentAt: now,
          expiresAt: new Date(
            now.getTime() + this.config.ttlMinutes * MINUTE_MS,
          ),
        },
        $setOnInsert: { userId },
      },
      { upsert: true },
    );
    return { secret, ttlMinutes: this.config.ttlMinutes };
  }

  /**
   * Checks an emailed code. Correct → the code is replaced by a reset token
   * (atomically: a code works once). Wrong → attempts +1; at the limit the
   * reset is deleted and a new one must be requested.
   */
  async verifyCode(userId: string, code: string): Promise<ResetCodeResult> {
    const pending = await this.resetModel
      .findOne({
        userId,
        method: PasswordResetMethod.Otp,
        codeHash: { $ne: null },
        expiresAt: { $gt: new Date() },
      })
      .lean();
    if (!pending?.codeHash) {
      return { kind: 'invalid' };
    }

    const submitted = this.codeHash(PasswordResetMethod.Otp, userId, code);
    if (isSameHash(submitted, pending.codeHash)) {
      return this.exchangeForResetToken(pending._id, pending.codeHash, userId);
    }

    const updated = await this.resetModel
      .findOneAndUpdate(
        { _id: pending._id },
        { $inc: { attempts: 1 } },
        { new: true, projection: { attempts: 1 } },
      )
      .lean();
    if (updated && updated.attempts >= this.config.maxAttempts) {
      await this.resetModel.deleteOne({ _id: pending._id });
      return { kind: 'attempts_exceeded' };
    }
    return { kind: 'invalid' };
  }

  /** Checks a link token (already unguessable: no attempt counting needed). */
  async verifyLinkToken(token: string): Promise<ResetCodeResult> {
    // The link token's HMAC doesn't include the user id (unknown here), so it
    // is looked up by hash directly.
    const hash = this.codeHash(PasswordResetMethod.Link, '', token);
    const pending = await this.resetModel
      .findOne({
        method: PasswordResetMethod.Link,
        codeHash: hash,
        expiresAt: { $gt: new Date() },
      })
      .lean();
    if (!pending) {
      return { kind: 'invalid' };
    }
    return this.exchangeForResetToken(pending._id, hash, pending.userId);
  }

  /**
   * Consumes a reset token (single use) and returns its user id, or null if
   * it is unknown, expired or already used.
   */
  async consumeResetToken(resetToken: string): Promise<string | null> {
    const consumed = await this.resetModel
      .findOneAndDelete({
        authorizationHash: this.authorizationHash(resetToken),
        authorizationExpiresAt: { $gt: new Date() },
      })
      .lean();
    return consumed?.userId ?? null;
  }

  /** User id of a still-valid reset token, without consuming it. */
  async peekResetToken(resetToken: string): Promise<string | null> {
    const pending = await this.resetModel
      .findOne(
        {
          authorizationHash: this.authorizationHash(resetToken),
          authorizationExpiresAt: { $gt: new Date() },
        },
        { userId: 1 },
      )
      .lean();
    return pending?.userId ?? null;
  }

  /** Cancels any pending reset (e.g. after the password was changed). */
  async invalidateForUser(userId: string): Promise<void> {
    await this.resetModel.deleteOne({ userId });
  }

  private async exchangeForResetToken(
    id: string,
    codeHash: string,
    userId: string,
  ): Promise<ResetCodeResult> {
    const resetToken = randomBytes(TOKEN_BYTES).toString('base64url');
    const ttlMs = this.config.authorizationTtlMinutes * MINUTE_MS;
    const expiresAt = new Date(Date.now() + ttlMs);
    // Conditional on the code hash: two parallel requests can't both succeed.
    const updated = await this.resetModel.updateOne(
      { _id: id, codeHash },
      {
        $set: {
          codeHash: null,
          authorizationHash: this.authorizationHash(resetToken),
          authorizationExpiresAt: expiresAt,
          expiresAt,
        },
      },
    );
    if (updated.modifiedCount === 0) {
      return { kind: 'invalid' };
    }
    return {
      kind: 'verified',
      userId,
      resetToken,
      expiresIn: Math.round(ttlMs / 1000),
    };
  }

  private codeHash(
    method: PasswordResetMethod,
    userId: string,
    value: string,
  ): string {
    const subject =
      method === PasswordResetMethod.Otp ? `${userId}:${value}` : value;
    return this.hmac(`password-reset:${method}:${subject}`);
  }

  private authorizationHash(resetToken: string): string {
    return this.hmac(`password-reset:authorization:${resetToken}`);
  }

  /** HMAC with a server secret: a leaked database can't be brute-forced offline. */
  private hmac(value: string): string {
    return createHmac('sha256', this.config.tokenSecret)
      .update(value)
      .digest('hex');
  }
}

function isSameHash(a: string, b: string): boolean {
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  return left.length === right.length && timingSafeEqual(left, right);
}
