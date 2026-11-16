import {
  type CanActivate,
  type ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { ErrorCode } from '@common/constants/error-codes.constants';
import { ALLOW_EXPIRED_PASSWORD_KEY } from '@common/decorators/allow-expired-password.decorator';
import { IS_PUBLIC_KEY } from '@common/decorators/public.decorator';
import { PERMISSIONS_KEY } from '@common/decorators/require-permissions.decorator';
import { ROLES_KEY } from '@common/decorators/roles.decorator';
import { AppException } from '@common/exceptions/app.exception';
import { PROJECT } from '@config/project';
import { AccessResolverService } from '@modules/access-control/services/access-resolver.service';
import { PasswordValidationService } from '@modules/password-policy/services/password-validation.service';
import { SessionsService } from '@modules/sessions/sessions.service';
import { UserRole } from '@modules/users/enums/user-role.enum';
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
    'WWW-Authenticate': `Bearer realm="${PROJECT.slug}", error="${error}"`,
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
 *  5. Role, if the route has @Roles(...)
 *  5b. Permissions, if the route has @RequirePermissions(...) (ADMIN passes)
 *  6. Password not expired, unless the route has @AllowExpiredPassword()
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
    private readonly passwordValidationService: PasswordValidationService,
    private readonly accessResolverService: AccessResolverService,
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

    const targets = [context.getHandler(), context.getClass()];
    const roles = this.reflector.getAllAndOverride<string[] | undefined>(
      ROLES_KEY,
      targets,
    );
    if (roles && !roles.includes(user.role)) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        ErrorCode.Forbidden,
        'You do not have permission to perform this action',
      );
    }

    // Permissions (groups → roles → permissions); ADMIN passes every check.
    const permissions = this.reflector.getAllAndOverride<string[] | undefined>(
      PERMISSIONS_KEY,
      targets,
    );
    if (permissions?.length && user.role !== UserRole.Admin) {
      const held = await this.accessResolverService.getPermissionKeys(user.id);
      const missing = permissions.filter((key) => !held.has(key));
      if (missing.length > 0) {
        throw new AppException(
          HttpStatus.FORBIDDEN,
          ErrorCode.Forbidden,
          'You do not have permission to perform this action',
          missing.map((key) => ({
            field: 'permission',
            message: `requires ${key}`,
          })),
        );
      }
    }

    // Expired password (policy: forceChangeOnExpiry, grace over): only the
    // routes needed to change it stay usable.
    const isExpiredAllowed = this.reflector.getAllAndOverride<
      boolean | undefined
    >(ALLOW_EXPIRED_PASSWORD_KEY, targets);
    if (isExpiredAllowed !== true) {
      const expiry = await this.passwordValidationService.getExpiryStatus(
        user.passwordChangedAt,
      );
      if (expiry.isChangeRequired || user.mustChangePassword) {
        throw new AppException(
          HttpStatus.FORBIDDEN,
          ErrorCode.AuthPasswordExpired,
          user.mustChangePassword
            ? 'An administrator requires you to change your password. Change it to continue.'
            : 'Your password has expired. Change it to continue.',
        );
      }
    }

    request.auth = {
      userId: payload.sub,
      sessionId: payload.sid,
      tokenId: payload.jti,
      role: user.role,
    };
    return true;
  }
}
