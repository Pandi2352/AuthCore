import { createHash, randomBytes } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { generateUuid } from '@common/utils/uuid.util';
import { authConfig } from '@config/configuration';

import {
  CreatedSession,
  CreateSessionInput,
} from './interfaces/session.interface';
import { Session } from './schemas/session.schema';
import { parseDeviceInfo } from './utils/device-info.util';

/** Bytes of randomness in a refresh token (256 bits). */
const REFRESH_TOKEN_BYTES = 32;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Sessions = signed-in devices. Each holds the hash of its current refresh
 * token. Rotation, reuse detection, listing and revocation build on this
 * (refresh / logout / session APIs).
 */
@Injectable()
export class SessionsService {
  constructor(
    @InjectModel(Session.name) private readonly sessionModel: Model<Session>,
    @Inject(authConfig.KEY)
    private readonly auth: ConfigType<typeof authConfig>,
  ) {}

  /**
   * Creates a session with a new refresh token. If the user already has the
   * maximum number of active sessions, the least recently used are revoked.
   */
  async create(input: CreateSessionInput): Promise<CreatedSession> {
    const revokedSessionIds = await this.enforceSessionLimit(input.userId);

    const refreshToken = randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
    const now = new Date();
    const ttlDays = input.isPersistent
      ? this.auth.refreshToken.rememberMeTtlDays
      : this.auth.refreshToken.ttlDays;
    const expiresAt = new Date(now.getTime() + ttlDays * DAY_MS);
    const device = parseDeviceInfo(input.client.userAgent);

    const session = await this.sessionModel.create({
      userId: input.userId,
      tokenFamilyId: generateUuid(),
      refreshTokenHash: hashRefreshToken(refreshToken),
      isPersistent: input.isPersistent,
      ipAddress: input.client.ipAddress,
      userAgent: input.client.userAgent,
      deviceType: device.deviceType,
      browser: device.browser,
      os: device.os,
      deviceName: device.deviceName,
      lastUsedAt: now,
      expiresAt,
    });

    return {
      sessionId: session._id,
      refreshToken,
      expiresAt,
      isPersistent: input.isPersistent,
      revokedSessionIds,
    };
  }

  private async enforceSessionLimit(userId: string): Promise<string[]> {
    const active = await this.sessionModel
      .find(
        { userId, revokedAt: null, expiresAt: { $gt: new Date() } },
        { _id: 1 },
      )
      .sort({ lastUsedAt: 1 })
      .lean();
    const excess = active.length - this.auth.maxSessionsPerUser + 1;
    if (excess <= 0) {
      return [];
    }
    const ids = active.slice(0, excess).map((session) => session._id);
    await this.sessionModel.updateMany(
      { _id: { $in: ids }, revokedAt: null },
      { $set: { revokedAt: new Date(), revokedReason: 'session_limit' } },
    );
    return ids;
  }
}

/**
 * Refresh tokens are 256-bit random values, so a plain SHA-256 is enough
 * (no salt / slow hash needed, unlike passwords).
 */
export function hashRefreshToken(refreshToken: string): string {
  return createHash('sha256').update(refreshToken).digest('hex');
}
