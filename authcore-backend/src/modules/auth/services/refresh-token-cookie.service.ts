import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import type { CookieOptions, Response } from 'express';

import { DEFAULT_API_VERSION } from '@common/constants/api.constants';
import { appConfig, authConfig } from '@config/configuration';

export interface RefreshTokenDetails {
  refreshToken: string;
  expiresAt: Date;
  isPersistent: boolean;
}

/**
 * Delivers the refresh token according to REFRESH_TOKEN_DELIVERY:
 * - cookie: HttpOnly (no JavaScript access), Secure, SameSite, scoped to the
 *   auth routes (/api/v1/auth), so it is only sent to refresh / logout.
 * - body:   returned in the JSON response (mobile apps store it in the
 *   platform's secure storage: Keychain / Keystore).
 */
@Injectable()
export class RefreshTokenCookieService {
  constructor(
    @Inject(authConfig.KEY)
    private readonly auth: ConfigType<typeof authConfig>,
    @Inject(appConfig.KEY)
    private readonly app: ConfigType<typeof appConfig>,
  ) {}

  get isBodyDelivery(): boolean {
    return this.auth.refreshToken.delivery !== 'cookie';
  }

  private get isCookieDelivery(): boolean {
    return this.auth.refreshToken.delivery !== 'body';
  }

  private get baseOptions(): CookieOptions {
    const { cookie } = this.auth.refreshToken;
    return {
      httpOnly: true,
      secure: cookie.isSecure,
      sameSite: cookie.sameSite,
      domain: cookie.domain,
      path: `/${this.app.apiPrefix}/v${DEFAULT_API_VERSION}/auth`,
    };
  }

  /**
   * Sets the cookie. "Remember me" → persistent until the session expires;
   * otherwise a browser-session cookie (gone when the browser closes).
   */
  set(response: Response, token: RefreshTokenDetails): void {
    if (!this.isCookieDelivery) {
      return;
    }
    response.cookie(this.auth.refreshToken.cookie.name, token.refreshToken, {
      ...this.baseOptions,
      expires: token.isPersistent ? token.expiresAt : undefined,
    });
  }

  clear(response: Response): void {
    if (!this.isCookieDelivery) {
      return;
    }
    response.clearCookie(this.auth.refreshToken.cookie.name, this.baseOptions);
  }
}
