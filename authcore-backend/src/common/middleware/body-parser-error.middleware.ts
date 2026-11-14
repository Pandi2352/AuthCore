import type { NextFunction, Request, Response } from 'express';

import { toBodyParserException } from '@common/utils/exception-mapper.util';

/**
 * Express error handler registered right after the body parsers.
 *
 * Nest turns a JSON SyntaxError into `new BadRequestException(err.message)`,
 * which would send the raw parser message (e.g. "Unexpected end of JSON
 * input") to the client. This converts body parser errors into an
 * AppException with a safe message first. Other errors pass through.
 */
export function bodyParserErrorHandler(
  error: unknown,
  _request: Request,
  _response: Response,
  next: NextFunction,
): void {
  next(toBodyParserException(error));
}
