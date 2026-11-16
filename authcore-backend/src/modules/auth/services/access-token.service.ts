import { createHash } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import { generateUuid } from '@common/utils/uuid.util';
import { authConfig } from '@config/configuration';

/** Claims in an AuthCore access token. Nothing personal; ids only. */
export interface AccessTokenPayload {
  /** User id (UUID). */
  sub: string;
  /** Session id: lets one device be signed out without affecting others. */
  sid: string;
  /** Unique token id (for tracking / revocation lists). */
  jti: string;
  typ: 'access';
  iss: string;
  aud: string;
  iat: number;
  exp: number;
}

export interface IssuedAccessToken {
  accessToken: string;
  /** Seconds until expiry. */
  expiresIn: number;
}

/** Public id of a secret (never the secret itself): first 16 hex chars of its SHA-256. */
export function keyIdOf(secret: string): string {
  return createHash('sha256').update(secret).digest('hex').slice(0, 16);
}

/**
 * Short-lived JWT access tokens. HS256 with the algorithm pinned on both sign
 * and verify (no "none", no algorithm switching); issuer and audience checked.
 * Configured in AuthModule (JwtModule.registerAsync).
 *
 * Key rotation: tokens carry `kid` (the key id of the signing secret). New
 * tokens are always signed with JWT_ACCESS_SECRET; tokens whose kid matches a
 * secret in JWT_ACCESS_PREVIOUS_SECRETS still verify until they expire.
 */
@Injectable()
export class AccessTokenService {
  /** key id → secret, current first. */
  private readonly keys: Map<string, string>;
  private readonly currentKeyId: string;

  constructor(
    private readonly jwtService: JwtService,
    @Inject(authConfig.KEY)
    private readonly auth: ConfigType<typeof authConfig>,
  ) {
    this.currentKeyId = keyIdOf(auth.jwt.secret);
    this.keys = new Map(
      [auth.jwt.secret, ...auth.jwt.previousSecrets].map((secret) => [
        keyIdOf(secret),
        secret,
      ]),
    );
  }

  async issue(
    userId: string,
    sessionId: string,
    attributeClaims?: Record<string, unknown>,
  ): Promise<IssuedAccessToken> {
    const accessToken = await this.jwtService.signAsync(
      {
        sid: sessionId,
        typ: 'access',
        ...(attributeClaims ? { attrs: attributeClaims } : {}),
      },
      {
        subject: userId,
        jwtid: generateUuid(),
        keyid: this.currentKeyId,
        secret: this.auth.jwt.secret,
      },
    );
    return { accessToken, expiresIn: this.auth.jwt.ttlSeconds };
  }

  /**
   * Verifies signature, algorithm, expiry, issuer and audience. Throws if any
   * check fails. Used by the authentication guard.
   */
  async verify(token: string): Promise<AccessTokenPayload> {
    // Signature and standard claims are verified; the custom ones are checked
    // here, since the content is only trusted after these checks.
    const payload = await this.jwtService.verifyAsync<Record<string, unknown>>(
      token,
      { secret: this.secretFor(token) },
    );
    if (
      payload.typ !== 'access' ||
      typeof payload.sub !== 'string' ||
      typeof payload.sid !== 'string' ||
      typeof payload.jti !== 'string'
    ) {
      throw new Error('Not an access token');
    }
    return payload as unknown as AccessTokenPayload;
  }

  /**
   * Secret named by the token's kid. Tokens without kid (issued before key
   * ids existed) use the current secret; an unknown kid is rejected.
   */
  private secretFor(token: string): string {
    const decoded: unknown = this.jwtService.decode(token, { complete: true });
    const kid =
      typeof decoded === 'object' && decoded !== null && 'header' in decoded
        ? (decoded.header as { kid?: unknown }).kid
        : undefined;
    if (kid === undefined) {
      return this.auth.jwt.secret;
    }
    const secret = typeof kid === 'string' ? this.keys.get(kid) : undefined;
    if (!secret) {
      throw new Error('Unknown signing key');
    }
    return secret;
  }
}
