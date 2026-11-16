import type { AuthContext } from './auth-context.interface';

/** Fields AuthCore adds to every Express request. */
declare module 'express-serve-static-core' {
  interface Request {
    /** Set by requestIdMiddleware; also sent as the X-Request-Id header. */
    requestId?: string;
    /** Set by the authentication guard on protected routes. */
    auth?: AuthContext;
  }
}

export {};
