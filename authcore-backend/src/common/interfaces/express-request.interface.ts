/** Fields AuthCore adds to every Express request. */
declare module 'express-serve-static-core' {
  interface Request {
    /** Set by requestIdMiddleware; also sent as the X-Request-Id header. */
    requestId?: string;
  }
}

export {};
