import { createHash } from 'node:crypto';

import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { ErrorCode } from '@common/constants/error-codes.constants';
import { AppException } from '@common/exceptions/app.exception';
import { authConfig } from '@config/configuration';

import { LoginAttempt } from '../schemas/login-attempt.schema';

const MINUTE_MS = 60_000;

export type LockScope = 'ip' | 'account';

export interface FailedAttemptResult {
  /** Set when this failure triggered a lock. */
  lockedUntil: Date | null;
  /** ip: only this IP is locked out of the account; account: every IP is. */
  scope: LockScope | null;
}

/**
 * Brute-force / credential-stuffing protection (on top of the per-IP rate limit):
 * - Sign-in failures count per account + IP: LOGIN_MAX_FAILED_ATTEMPTS within
 *   LOGIN_FAILED_ATTEMPTS_WINDOW_MINUTES lock **that IP** out of the account
 *   for LOGIN_LOCKOUT_MINUTES. Someone who only knows a user's email can no
 *   longer lock the user out: the user's own devices still sign in.
 * - They also count per account across all IPs: LOGIN_MAX_FAILED_ATTEMPTS_PER_ACCOUNT
 *   locks the whole account (distributed attacks).
 * - Callers without an IP (current-password checks) use the account counter
 *   with LOGIN_MAX_FAILED_ATTEMPTS. Locks are always temporary.
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

  /** Counter key of one IP for an account key (IP stored hashed). */
  ipKeyFor(key: string, ipAddress: string): string {
    const hash = createHash('sha256')
      .update(ipAddress)
      .digest('hex')
      .slice(0, 32);
    return `${key}|ip:${hash}`;
  }

  /**
   * The lock end time if sign-in is locked for this key (and, with an IP, for
   * that IP on this key). The later one wins.
   */
  async getActiveLock(key: string, ipAddress?: string): Promise<Date | null> {
    const keys = ipAddress ? [key, this.ipKeyFor(key, ipAddress)] : [key];
    const attempt = await this.attemptModel
      .findOne(
        { key: { $in: keys }, lockedUntil: { $gt: new Date() } },
        { lockedUntil: 1 },
      )
      .sort({ lockedUntil: -1 })
      .lean();
    return attempt?.lockedUntil ?? null;
  }

  /**
   * Admin view: the latest active lock on the account or any of its IPs, and
   * how many IPs are currently locked out of it.
   */
  async lockSummary(
    key: string,
  ): Promise<{ lockedUntil: Date | null; lockedIpCount: number }> {
    const locks = await this.attemptModel
      .find(
        {
          key: { $regex: `^${escapeRegExp(key)}(\\|ip:.*)?$` },
          lockedUntil: { $gt: new Date() },
        },
        { key: 1, lockedUntil: 1 },
      )
      .sort({ lockedUntil: -1 })
      .lean();
    return {
      lockedUntil: locks[0]?.lockedUntil ?? null,
      lockedIpCount: locks.filter((l) => l.key.includes('|ip:')).length,
    };
  }

  /**
   * Counts a failure. With an IP: on the account + IP counter (limit
   * LOGIN_MAX_FAILED_ATTEMPTS) and the account counter (limit
   * LOGIN_MAX_FAILED_ATTEMPTS_PER_ACCOUNT). Without: the account counter with
   * LOGIN_MAX_FAILED_ATTEMPTS.
   */
  async recordFailure(
    key: string,
    ipAddress?: string,
  ): Promise<FailedAttemptResult> {
    if (!ipAddress) {
      const lockedUntil = await this.count(key, this.auth.maxFailedAttempts);
      return { lockedUntil, scope: lockedUntil ? 'account' : null };
    }
    const ipLock = await this.count(
      this.ipKeyFor(key, ipAddress),
      this.auth.maxFailedAttempts,
    );
    const accountLock = await this.count(
      key,
      this.auth.maxFailedAttemptsPerAccount,
    );
    if (accountLock) {
      return { lockedUntil: accountLock, scope: 'account' };
    }
    return { lockedUntil: ipLock, scope: ipLock ? 'ip' : null };
  }

  /** Atomic per key; returns the lock end when this failure locked the key. */
  private async count(key: string, maxFailures: number): Promise<Date | null> {
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
                $gte: ['$failedCount', maxFailures],
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
    return lockedUntil !== null && lockedUntil.getTime() === lockUntil.getTime()
      ? lockedUntil
      : null;
  }

  /** 429 for a locked key, with Retry-After until the lock ends. */
  lockedException(lockedUntil: Date): AppException {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((lockedUntil.getTime() - Date.now()) / 1000),
    );
    return new AppException(
      HttpStatus.TOO_MANY_REQUESTS,
      ErrorCode.AuthTooManyFailedAttempts,
      'Too many failed sign-in attempts. Try again later.',
      [],
      { 'Retry-After': String(retryAfterSeconds) },
    );
  }

  /** Clears the account counter and every IP counter / lock of it (unlock, password reset). */
  async clear(key: string): Promise<void> {
    await this.attemptModel.deleteMany({
      key: { $regex: `^${escapeRegExp(key)}(\\|ip:.*)?$` },
    });
  }

  /** After a successful sign-in: that IP's counter only (the account-wide one keeps counting). */
  async clearForIp(key: string, ipAddress: string): Promise<void> {
    await this.attemptModel.deleteOne({ key: this.ipKeyFor(key, ipAddress) });
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
