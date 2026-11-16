import {
  type CanActivate,
  type ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { ErrorCode } from '@common/constants/error-codes.constants';
import { IS_PUBLIC_KEY } from '@common/decorators/public.decorator';
import { AppException } from '@common/exceptions/app.exception';
import { SessionsService } from '@modules/sessions/sessions.service';
import { UsersService } from '@modules/users/users.service';

import { AccessTokenService } from '../services/access-token.service';
import { AccountEligibilityService } from '../services/account-eligibility.service';

const BEARER =
  /^Bearer\s+([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)\s*$/i;

/** 401 with the RFC 6750 WWW-Authenticate header. */
function unauthorized(
  code: ErrorCode,
  message: string,
  error: string,
): AppException {
  return new AppException(HttpStatus.UNAUTHORIZED, code, message, [], {
    'WWW-Authenticate': `Bearer realm="authcore", error="${error}"`,
  });
}

/**
 * Global authentication guard (registered as APP_GUARD): every route requires
 * a valid access token unless marked @Public().
 *
 * Per request:
 *  1. Authorization: Bearer <jwt> present
 *  2. JWT valid (HS256, signature, exp, iss, aud, typ)
 *  3. Session still active: logout / revocation takes effect immediately
 *  4. User still allowed to sign in (same rules as login and refresh)
 * Then `request.auth` = { userId, sessionId, tokenId } (see @CurrentUser()).
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly accessTokenService: AccessTokenService,
    private readonly sessionsService: SessionsService,
    private readonly usersService: UsersService,
    private readonly accountEligibilityService: AccountEligibilityService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') {
      return true;
    }
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(
      IS_PUBLIC_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isPublic === true) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const header = request.get('authorization');
    if (!header) {
      throw unauthorized(
        ErrorCode.AuthAccessTokenMissing,
        'Sign in to access this resource',
        'invalid_request',
      );
    }
    // Present but not "Bearer <jwt>" (another scheme, or not a JWT).
    const token = BEARER.exec(header)?.[1];
    if (!token) {
      throw unauthorized(
        ErrorCode.AuthAccessTokenInvalid,
        'The access token is invalid',
        'invalid_token',
      );
    }

    const payload = await this.accessTokenService
      .verify(token)
      .catch((error: unknown) => {
        const isExpired =
          error instanceof Error && error.name === 'TokenExpiredError';
        throw isExpired
          ? unauthorized(
              ErrorCode.AuthAccessTokenExpired,
              'Your access token has expired. Refresh it and try again.',
              'invalid_token',
            )
          : unauthorized(
              ErrorCode.AuthAccessTokenInvalid,
              'The access token is invalid',
              'invalid_token',
            );
      });

    if (!(await this.sessionsService.isActive(payload.sid, payload.sub))) {
      throw unauthorized(
        ErrorCode.AuthSessionRevoked,
        'This session has ended. Please sign in again.',
        'invalid_token',
      );
    }
    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw unauthorized(
        ErrorCode.AuthSessionRevoked,
        'This session has ended. Please sign in again.',
        'invalid_token',
      );
    }
    const refusal = this.accountEligibilityService.getRefusal(user);
    if (refusal) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        refusal.code,
        refusal.message,
      );
    }

    request.auth = {
      userId: payload.sub,
      sessionId: payload.sid,
      tokenId: payload.jti,
    };
    return true;
  }
}
