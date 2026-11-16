import { createHash } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { authConfig } from '@config/configuration';

import { LoginAttempt } from '../schemas/login-attempt.schema';

const MINUTE_MS = 60_000;

export interface FailedAttemptResult {
  /** Set when this failure triggered a lock. */
  lockedUntil: Date | null;
}

/**
 * Brute-force / credential-stuffing protection (per account, on top of the
 * per-IP rate limit):
 * - LOGIN_MAX_FAILED_ATTEMPTS failures within LOGIN_FAILED_ATTEMPTS_WINDOW_MINUTES
 *   lock sign-in for LOGIN_LOCKOUT_MINUTES. The lock is always temporary.
 * - Unknown identifiers are counted and locked the same way, so a lock reveals
 *   nothing about whether an account exists.
 * - A successful sign-in clears the counter.
 */
@Injectable()
export class LoginSecurityService {
  constructor(
    @InjectModel(LoginAttempt.name)
    private readonly attemptModel: Model<LoginAttempt>,
    @Inject(authConfig.KEY)
    private readonly auth: ConfigType<typeof authConfig>,
  ) {}

  /** Counter key: the account if known (email and username share it), else the hashed identifier. */
  keyFor(userId: string | null, identifier: string): string {
    if (userId !== null) {
      return `user:${userId}`;
    }
    const hash = createHash('sha256').update(identifier).digest('hex');
    return `identifier:${hash}`;
  }

  /** The lock end time if sign-in is currently locked for this key. */
  async getActiveLock(key: string): Promise<Date | null> {
    const attempt = await this.attemptModel
      .findOne({ key, lockedUntil: { $gt: new Date() } }, { lockedUntil: 1 })
      .lean();
    return attempt?.lockedUntil ?? null;
  }

  /** Counts a failure; locks when the limit is reached. Atomic per key. */
  async recordFailure(key: string): Promise<FailedAttemptResult> {
    const now = new Date();
    const windowMs = this.auth.failedAttemptsWindowMinutes * MINUTE_MS;
    const lockUntil = new Date(
      now.getTime() + this.auth.lockoutMinutes * MINUTE_MS,
    );

    // 1. Make sure the record exists (with schema defaults, incl. a UUID _id).
    await this.attemptModel.updateOne(
      { key },
      { $setOnInsert: { key, expiresAt: new Date(now.getTime() + windowMs) } },
      { upsert: true },
    );

    // 2. Count the failure in one atomic update.
    const updated = await this.attemptModel
      .findOneAndUpdate(
        { key },
        [
          {
            $set: {
              isNewWindow: {
                $or: [
                  { $eq: [{ $ifNull: ['$windowStartedAt', null] }, null] },
                  {
                    $lt: [
                      '$windowStartedAt',
                      new Date(now.getTime() - windowMs),
                    ],
                  },
                ],
              },
            },
          },
          {
            $set: {
              failedCount: {
                $cond: ['$isNewWindow', 1, { $add: ['$failedCount', 1] }],
              },
              windowStartedAt: {
                $cond: ['$isNewWindow', now, '$windowStartedAt'],
              },
            },
          },
          {
            $set: {
              isLockedNow: {
                $gte: ['$failedCount', this.auth.maxFailedAttempts],
              },
            },
          },
          {
            $set: {
              // On lock: start a fresh window, so after the lock the user gets
              // the full number of attempts again (never a permanent lock).
              lockedUntil: {
                $cond: ['$isLockedNow', lockUntil, '$lockedUntil'],
              },
              failedCount: { $cond: ['$isLockedNow', 0, '$failedCount'] },
              windowStartedAt: {
                $cond: ['$isLockedNow', null, '$windowStartedAt'],
              },
              expiresAt: {
                $cond: [
                  '$isLockedNow',
                  lockUntil,
                  { $add: ['$windowStartedAt', windowMs] },
                ],
              },
            },
          },
          { $unset: ['isNewWindow', 'isLockedNow'] },
        ],
        { new: true, projection: { lockedUntil: 1 } },
      )
      .lean();

    const lockedUntil = updated?.lockedUntil ?? null;
    return {
      lockedUntil:
        lockedUntil !== null && lockedUntil.getTime() === lockUntil.getTime()
          ? lockedUntil
          : null,
    };
  }

  async clear(key: string): Promise<void> {
    await this.attemptModel.deleteOne({ key });
  }
}
