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
const BODY_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
/**
 * Upload routes: the only ones that accept multipart/form-data (POST /files, POST …/avatar,
 * POST /settings/business/assets/:slot, POST /uploads, POST /admin/users/bulk/:type/upload).
 */
const MULTIPART_ROUTE =
  /\/v\d+\/(files|uploads|users\/me\/avatar|admin\/users\/[^/]+\/avatar|settings\/business\/assets\/[^/]+|admin\/users\/bulk\/(create|update|password)\/upload)$/;

/** A request body is present (Content-Length > 0 or chunked). */
function hasBody(request: Request): boolean {
  const length = Number(request.headers['content-length'] ?? 0);
  return length > 0 || request.headers['transfer-encoding'] !== undefined;
}
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
 * 2. Rejects request bodies that are not JSON (415).
 * 3. Rejects bodies / queries with MongoDB operator keys ($ne, $gt, ...) or
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

    // The API only accepts JSON bodies: anything else would be silently ignored
    // by the JSON parser and fail with a misleading validation error.
    const isUpload =
      request.method === 'POST' &&
      MULTIPART_ROUTE.test(request.originalUrl.split('?')[0] ?? '') &&
      request.is('multipart/form-data') !== false;
    if (
      BODY_METHODS.has(request.method) &&
      hasBody(request) &&
      !isUpload &&
      request.is('application/json') === false
    ) {
      throw new AppException(
        HttpStatus.UNSUPPORTED_MEDIA_TYPE,
        ErrorCode.UnsupportedMediaType,
        'Send the request body as JSON (Content-Type: application/json)',
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
