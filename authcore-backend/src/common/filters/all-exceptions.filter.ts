import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import { AppException } from '@common/exceptions/app.exception';
import { buildErrorResponse } from '@common/utils/api-response.util';
import { mapException } from '@common/utils/exception-mapper.util';
import { requestPath } from '@common/utils/request.util';

function describe(exception: unknown): { summary: string; stack?: string } {
  if (exception instanceof Error) {
    return {
      summary: `${exception.name}: ${exception.message}`,
      stack: exception.stack,
    };
  }
  return { summary: `Non-error thrown: ${typeof exception}` };
}

/**
 * Catches every exception and returns the standard error envelope.
 * Clients get a safe message and code; full details go to the server log
 * for 5xx errors only. Request bodies and headers are never logged.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const path = requestPath(request);
    const mapped = mapException(exception);

    if (mapped.isServerError && exception instanceof AppException) {
      // Deliberate 5xx (e.g. readiness 503): one line, no stack.
      this.logger.warn({
        message: `${request.method} ${path} -> ${mapped.statusCode} ${mapped.code}`,
        method: request.method,
        path,
        statusCode: mapped.statusCode,
        code: mapped.code,
        requestId: request.requestId,
      });
    } else if (mapped.isServerError) {
      // Unexpected failure: full details and stack.
      const { summary, stack } = describe(exception);
      this.logger.error(
        {
          message: `${request.method} ${path} -> ${mapped.statusCode} ${mapped.code}: ${summary}`,
          method: request.method,
          path,
          statusCode: mapped.statusCode,
          code: mapped.code,
          requestId: request.requestId,
        },
        stack,
      );
    }

    // A stream or file download may already have started.
    if (response.headersSent) {
      return;
    }

    response.status(mapped.statusCode).json(
      buildErrorResponse({
        statusCode: mapped.statusCode,
        code: mapped.code,
        message: mapped.message,
        errors: mapped.errors,
        path,
      }),
    );
  }
}
