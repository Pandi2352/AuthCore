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

/**
 * Short-lived JWT access tokens. HS256 with the algorithm pinned on both sign
 * and verify (no "none", no algorithm switching); issuer and audience checked.
 * Configured in AuthModule (JwtModule.registerAsync).
 */
@Injectable()
export class AccessTokenService {
  constructor(
    private readonly jwtService: JwtService,
    @Inject(authConfig.KEY)
    private readonly auth: ConfigType<typeof authConfig>,
  ) {}

  async issue(userId: string, sessionId: string): Promise<IssuedAccessToken> {
    const accessToken = await this.jwtService.signAsync(
      { sid: sessionId, typ: 'access' },
      { subject: userId, jwtid: generateUuid() },
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
    const payload =
      await this.jwtService.verifyAsync<Record<string, unknown>>(token);
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
}
