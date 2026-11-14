import { HttpStatus, Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

import { ErrorCode } from '@common/constants/error-codes.constants';
import { AppException } from '@common/exceptions/app.exception';

/** Methods the API serves. TRACE / CONNECT / TRACK and others are rejected. */
export const ALLOWED_HTTP_METHODS = [
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'OPTIONS',
  'HEAD',
] as const;

const ALLOWED_METHODS = new Set<string>(ALLOWED_HTTP_METHODS);
const MAX_DEPTH = 20;

/**
 * Returns the first key that starts with "$" or contains "." (MongoDB
 * operators / dotted paths), or null. Depth-limited to avoid deep recursion.
 */
export function findUnsafeKey(value: unknown, depth = 0): string | null {
  if (depth > MAX_DEPTH || typeof value !== 'object' || value === null) {
    return null;
  }
  for (const [key, child] of Object.entries(value)) {
    if (key.startsWith('$') || key.includes('.')) {
      return key;
    }
    const nested = findUnsafeKey(child, depth + 1);
    if (nested !== null) {
      return nested;
    }
  }
  return null;
}

/**
 * Runs before every route:
 * 1. Rejects HTTP methods the API doesn't use (405).
 * 2. Rejects bodies / queries with MongoDB operator keys ($ne, $gt, ...) or
 *    dotted keys, as defense in depth against NoSQL injection (400).
 */
@Injectable()
export class SecurityMiddleware implements NestMiddleware {
  use(request: Request, _response: Response, next: NextFunction): void {
    if (!ALLOWED_METHODS.has(request.method)) {
      throw new AppException(
        HttpStatus.METHOD_NOT_ALLOWED,
        ErrorCode.MethodNotAllowed,
      );
    }

    const unsafeKey =
      findUnsafeKey(request.body) ?? findUnsafeKey(request.query);
    if (unsafeKey !== null) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.BadRequest,
        'Request contains a field name that is not allowed',
      );
    }

    next();
  }
}
