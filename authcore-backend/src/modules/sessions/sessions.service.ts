import { createHash, randomBytes } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import type { ClientInfo } from '@common/interfaces/client-info.interface';
import { generateUuid } from '@common/utils/uuid.util';
import { authConfig } from '@config/configuration';

import {
  CreatedSession,
  CreateSessionInput,
  RefreshTokenUseResult,
  SessionSummary,
} from './interfaces/session.interface';
import { Session } from './schemas/session.schema';
import { parseDeviceInfo } from './utils/device-info.util';

/** Bytes of randomness in a refresh token (256 bits). */
const REFRESH_TOKEN_BYTES = 32;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Rotated token hashes kept per session for reuse detection. */
const ROTATED_HISTORY_SIZE = 100;

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

  /**
   * Uses a refresh token (refresh endpoint):
   *
   * 1. Current token of an active session → rotate atomically (only one
   *    concurrent request can win): new token hash, old one kept as
   *    "previous" and in the history. `expiresAt` is NOT extended.
   * 2. The previous token, within REFRESH_TOKEN_REUSE_GRACE_SECONDS of the
   *    rotation → "grace" (a parallel request lost the race; not an attack).
   * 3. Any other already-rotated token → reuse: the token family is revoked.
   * 4. Otherwise → invalid (unknown, expired or revoked session).
   */
  async useRefreshToken(
    refreshToken: string,
    client: ClientInfo,
  ): Promise<RefreshTokenUseResult> {
    const hash = hashRefreshToken(refreshToken);
    const now = new Date();
    const newRefreshToken =
      randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');

    const rotated = await this.sessionModel
      .findOneAndUpdate(
        { refreshTokenHash: hash, revokedAt: null, expiresAt: { $gt: now } },
        {
          $set: {
            refreshTokenHash: hashRefreshToken(newRefreshToken),
            previousRefreshTokenHash: hash,
            rotatedAt: now,
            lastUsedAt: now,
            lastIpAddress: client.ipAddress,
          },
          $push: {
            rotatedTokenHashes: {
              $each: [hash],
              $slice: -ROTATED_HISTORY_SIZE,
            },
          },
          $inc: { rotationCount: 1 },
        },
        { new: true },
      )
      .lean();
    if (rotated) {
      return {
        kind: 'rotated',
        session: toSummary(rotated),
        refreshToken: newRefreshToken,
      };
    }

    const graceStart = new Date(
      now.getTime() - this.auth.refreshToken.reuseGraceSeconds * 1000,
    );
    const inGrace = await this.sessionModel
      .findOneAndUpdate(
        {
          previousRefreshTokenHash: hash,
          rotatedAt: { $gte: graceStart },
          revokedAt: null,
          expiresAt: { $gt: now },
        },
        { $set: { lastUsedAt: now, lastIpAddress: client.ipAddress } },
        { new: true },
      )
      .lean();
    if (inGrace) {
      return { kind: 'grace', session: toSummary(inGrace) };
    }

    const reused = await this.sessionModel
      .findOne({ rotatedTokenHashes: hash }, { userId: 1, tokenFamilyId: 1 })
      .lean();
    if (reused) {
      await this.revokeFamily(reused.tokenFamilyId, 'token_reuse');
      return {
        kind: 'reused',
        userId: reused.userId,
        tokenFamilyId: reused.tokenFamilyId,
        sessionId: reused._id,
      };
    }
    return { kind: 'invalid' };
  }

  /** Signs one session out. Returns false if it was already revoked. */
  async revoke(sessionId: string, reason: string): Promise<boolean> {
    const result = await this.sessionModel.updateOne(
      { _id: sessionId, revokedAt: null },
      { $set: { revokedAt: new Date(), revokedReason: reason } },
    );
    return result.modifiedCount > 0;
  }

  /** Signs out every session of a token family (refresh token reuse). */
  async revokeFamily(tokenFamilyId: string, reason: string): Promise<number> {
    const result = await this.sessionModel.updateMany(
      { tokenFamilyId, revokedAt: null },
      { $set: { revokedAt: new Date(), revokedReason: reason } },
    );
    return result.modifiedCount;
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

function toSummary(session: Session): SessionSummary {
  return {
    sessionId: session._id,
    userId: session.userId,
    tokenFamilyId: session.tokenFamilyId,
    expiresAt: session.expiresAt,
    isPersistent: session.isPersistent,
    rotationCount: session.rotationCount,
  };
}

/**
 * Refresh tokens are 256-bit random values, so a plain SHA-256 is enough
 * (no salt / slow hash needed, unlike passwords).
 */
export function hashRefreshToken(refreshToken: string): string {
  return createHash('sha256').update(refreshToken).digest('hex');
}
