import type { Request } from 'express';

/** Request path without the query string (queries may contain tokens). */
export function requestPath(request: Request): string {
  return request.originalUrl.split('?')[0] ?? request.originalUrl;
}
