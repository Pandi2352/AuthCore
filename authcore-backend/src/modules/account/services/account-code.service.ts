import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { accountConfig } from '@config/configuration';

import { AccountCodePurpose } from '../enums/account-code-purpose.enum';
import { AccountCode } from '../schemas/account-code.schema';

const MINUTE_MS = 60_000;

export type CodeCheck =
  | { kind: 'verified'; newEmail: string | null }
  | { kind: 'invalid' }
  | { kind: 'attempts_exceeded' };

/** 6-digit emailed codes for email change and account recovery. */
@Injectable()
export class AccountCodeService {
  constructor(
    @InjectModel(AccountCode.name)
    private readonly codeModel: Model<AccountCode>,
    @Inject(accountConfig.KEY)
    private readonly config: ConfigType<typeof accountConfig>,
  ) {}

  /** Seconds until another code may be sent (0 = now). */
  async secondsUntilResend(
    userId: string,
    purpose: AccountCodePurpose,
  ): Promise<number> {
    const pending = await this.codeModel
      .findOne({ userId, purpose }, { lastSentAt: 1 })
      .lean();
    if (!pending) {
      return 0;
    }
    const readyAt =
      pending.lastSentAt.getTime() +
      this.config.codeResendCooldownSeconds * 1000;
    return Math.max(0, Math.ceil((readyAt - Date.now()) / 1000));
  }

  /** New code (replaces any pending one for the same purpose). */
  async issue(
    userId: string,
    purpose: AccountCodePurpose,
    newEmail: string | null = null,
  ): Promise<{ code: string; ttlMinutes: number }> {
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const now = new Date();
    await this.codeModel.findOneAndUpdate(
      { userId, purpose },
      {
        $set: {
          codeHash: this.hash(userId, purpose, code),
          attempts: 0,
          newEmail,
          lastSentAt: now,
          expiresAt: new Date(
            now.getTime() + this.config.codeTtlMinutes * MINUTE_MS,
          ),
        },
        $setOnInsert: { userId, purpose },
      },
      { upsert: true },
    );
    return { code, ttlMinutes: this.config.codeTtlMinutes };
  }

  /** Correct → consumed (single use). Wrong → attempts +1; at the limit the code is deleted. */
  async verify(
    userId: string,
    purpose: AccountCodePurpose,
    code: string,
  ): Promise<CodeCheck> {
    const pending = await this.codeModel
      .findOne({ userId, purpose, expiresAt: { $gt: new Date() } })
      .lean();
    if (!pending) {
      return { kind: 'invalid' };
    }
    if (isSameHash(this.hash(userId, purpose, code), pending.codeHash)) {
      const consumed = await this.codeModel
        .findOneAndDelete({ _id: pending._id, codeHash: pending.codeHash })
        .lean();
      return consumed
        ? { kind: 'verified', newEmail: consumed.newEmail }
        : { kind: 'invalid' };
    }
    const updated = await this.codeModel
      .findOneAndUpdate(
        { _id: pending._id },
        { $inc: { attempts: 1 } },
        { new: true, projection: { attempts: 1 } },
      )
      .lean();
    if (updated && updated.attempts >= this.config.codeMaxAttempts) {
      await this.codeModel.deleteOne({ _id: pending._id });
      return { kind: 'attempts_exceeded' };
    }
    return { kind: 'invalid' };
  }

  async cancel(userId: string, purpose: AccountCodePurpose): Promise<void> {
    await this.codeModel.deleteOne({ userId, purpose });
  }

  private hash(
    userId: string,
    purpose: AccountCodePurpose,
    code: string,
  ): string {
    return createHmac('sha256', this.config.tokenSecret)
      .update(`account:${purpose}:${userId}:${code}`)
      .digest('hex');
  }
}

function isSameHash(a: string, b: string): boolean {
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  return left.length === right.length && timingSafeEqual(left, right);
}
