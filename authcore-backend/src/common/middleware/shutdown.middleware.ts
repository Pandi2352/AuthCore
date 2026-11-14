import type { NextFunction, Request, Response } from 'express';

import { isShuttingDown } from '@common/context/app-state';

/**
 * During shutdown, tells keep-alive clients to close the connection after
 * this response, so their next request goes to another instance.
 * Requests already received are still served.
 */
export function shutdownMiddleware(
  _request: Request,
  response: Response,
  next: NextFunction,
): void {
  if (isShuttingDown()) {
    response.setHeader('Connection', 'close');
  }
  next();
}
