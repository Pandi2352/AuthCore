import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

import type { AuthContext } from '@common/interfaces/auth-context.interface';

/**
 * The authenticated caller on a protected route:
 *   me(@CurrentUser() auth: AuthContext) { ... auth.userId ... }
 *
 * Only valid on routes guarded by authentication (i.e. not @Public()).
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthContext => {
    const { auth } = context.switchToHttp().getRequest<Request>();
    if (!auth) {
      // A programming error: @CurrentUser() used on a @Public() route.
      throw new Error('@CurrentUser() used on a route without authentication');
    }
    return auth;
  },
);
