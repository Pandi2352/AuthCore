import type { NextFunction, Request, Response } from 'express';

import { runWithRequestContext } from '@common/context/request-context';
import { generateUuid } from '@common/utils/uuid.util';

export const REQUEST_ID_HEADER = 'X-Request-Id';

/** Accept an incoming id only if it is short and uses safe characters. */
const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]{1,128}$/;

/**
 * First middleware for every request. Reuses a safe incoming X-Request-Id
 * (e.g. from a gateway) or creates a UUID v7 (sorts by time), then:
 * - stores it on `request.requestId`
 * - returns it in the X-Request-Id response header
 * - makes it available to every log line for this request
 */
export function requestIdMiddleware(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  const incoming = request.get(REQUEST_ID_HEADER);
  const requestId =
    incoming !== undefined && SAFE_REQUEST_ID.test(incoming)
      ? incoming
      : generateUuid();

  request.requestId = requestId;
  response.setHeader(REQUEST_ID_HEADER, requestId);
  runWithRequestContext({ requestId }, next);
}
