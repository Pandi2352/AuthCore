import { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

import { requestPath } from '@common/utils/request.util';

const logger = new Logger('HTTP');

/** Health probes run every few seconds; only failed ones are logged. */
const HEALTH_PATH = /\/health(\/live|\/ready)?$/;

/**
 * One structured log line per finished request:
 *   GET /api/v1/users 200 12.3ms  { method, path, statusCode, durationMs, ... }
 *
 * Runs as middleware, so requests rejected before reaching a controller
 * (404, 405, 413, 429, ...) are logged too. Never logs bodies, headers,
 * cookies or the query string.
 */
export function accessLogMiddleware(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  const startedAt = process.hrtime.bigint();

  response.on('finish', () => {
    const durationMs =
      Math.round(Number(process.hrtime.bigint() - startedAt) / 1e4) / 100;
    const path = requestPath(request);
    const { statusCode } = response;
    if (statusCode < 400 && HEALTH_PATH.test(path)) {
      return;
    }
    const entry = {
      message: `${request.method} ${path} ${statusCode} ${durationMs}ms`,
      method: request.method,
      path,
      statusCode,
      durationMs,
      requestId: request.requestId,
      ip: request.ip,
      userAgent: request.get('user-agent'),
    };

    if (statusCode >= 500) {
      logger.warn(entry);
    } else {
      logger.log(entry);
    }
  });

  next();
}
