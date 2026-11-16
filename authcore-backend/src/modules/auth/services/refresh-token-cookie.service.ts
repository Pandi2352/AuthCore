import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import type { CookieOptions, Request, Response } from 'express';

import { DEFAULT_API_VERSION } from '@common/constants/api.constants';
import { ErrorCode } from '@common/constants/error-codes.constants';
import { AppException } from '@common/exceptions/app.exception';
import { appConfig, authConfig } from '@config/configuration';

export interface RefreshTokenDetails {
  refreshToken: string;
  expiresAt: Date;
  isPersistent: boolean;
}

/** Errors after which the browser's refresh cookie is useless and is removed. */
const COOKIE_CLEARING_CODES = new Set<ErrorCode>([
  ErrorCode.AuthInvalidRefreshToken,
  ErrorCode.AuthRefreshTokenReused,
  ErrorCode.AuthEmailNotVerified,
  ErrorCode.AuthAccountPendingApproval,
  ErrorCode.AuthAccountSuspended,
  ErrorCode.AuthAccountInactive,
  ErrorCode.AuthAccountDisabled,
]);

/**
 * Delivers and reads the refresh token according to REFRESH_TOKEN_DELIVERY:
 * - cookie: HttpOnly (no JavaScript access), Secure, SameSite, scoped to the
 *   auth routes (/api/v1/auth), so it is only sent to refresh / logout.
 * - body:   returned in / read from JSON (mobile apps store it in the
 *   platform's secure storage: Keychain / Keystore).
 */
@Injectable()
export class RefreshTokenCookieService {
  private readonly logger = new Logger(RefreshTokenCookieService.name);

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

  /** Sets the rotated cookie; nothing to do when there was no rotation (grace). */
  apply(response: Response, token: RefreshTokenDetails | null): void {
    if (token) {
      this.set(response, token);
    }
  }

  clear(response: Response): void {
    if (!this.isCookieDelivery) {
      return;
    }
    response.clearCookie(this.auth.refreshToken.cookie.name, this.baseOptions);
  }

  /**
   * Finds the refresh token in the cookie (browsers) or body (mobile), as
   * allowed by REFRESH_TOKEN_DELIVERY. A cookie also requires a trusted
   * Origin (CSRF protection), because browsers attach cookies automatically.
   */
  extract(request: Request, bodyToken: string | undefined): string {
    const cookies = request.cookies as Record<string, unknown> | undefined;
    const cookieToken = cookies?.[this.auth.refreshToken.cookie.name];

    if (
      this.isCookieDelivery &&
      typeof cookieToken === 'string' &&
      cookieToken !== ''
    ) {
      this.assertTrustedOrigin(request);
      return cookieToken;
    }
    if (this.isBodyDelivery && bodyToken) {
      return bodyToken;
    }
    throw new AppException(
      HttpStatus.UNAUTHORIZED,
      ErrorCode.AuthInvalidRefreshToken,
      'No refresh token was provided. Please sign in.',
    );
  }

  /**
   * Removes the cookie when the refresh was rejected for good (invalid,
   * reused, account can't sign in), then rethrows. Transient errors (429,
   * 5xx) keep the cookie so the client can retry.
   */
  clearIfRejected(response: Response, error: unknown): never {
    if (
      error instanceof AppException &&
      COOKIE_CLEARING_CODES.has(error.code)
    ) {
      this.clear(response);
    }
    throw error;
  }

  /** CSRF: the request must come from an allowed origin (CORS_ORIGIN). */
  private assertTrustedOrigin(request: Request): void {
    const origin = request.get('origin') ?? originOf(request.get('referer'));
    if (origin && this.app.corsOrigins.includes(origin)) {
      return;
    }
    this.logger.warn({
      message: 'Refresh refused: untrusted or missing origin',
      origin: origin ?? null,
      ipAddress: request.ip,
    });
    throw new AppException(
      HttpStatus.FORBIDDEN,
      ErrorCode.AuthInvalidOrigin,
      'This request is not allowed from this origin',
    );
  }
}

function originOf(url: string | undefined): string | undefined {
  if (!url) {
    return undefined;
  }
  try {
    return new URL(url).origin;
  } catch {
    return undefined;
  }
}
