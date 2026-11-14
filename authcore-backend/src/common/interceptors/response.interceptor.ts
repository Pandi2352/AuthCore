import { Readable } from 'node:stream';

import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { map, type Observable } from 'rxjs';

import { RESPONSE_MESSAGE_KEY } from '@common/decorators/response-message.decorator';
import { SKIP_RESPONSE_WRAP_KEY } from '@common/decorators/skip-response-wrap.decorator';
import { buildSuccessResponse } from '@common/utils/api-response.util';
import { requestPath } from '@common/utils/request.util';

/** Files, buffers and streams are sent as-is. */
function isRawPayload(data: unknown): boolean {
  return (
    data instanceof StreamableFile ||
    data instanceof Readable ||
    Buffer.isBuffer(data)
  );
}

/**
 * Wraps every successful controller result in the standard success envelope
 * (section 5). Paginated results become `data` + `meta`.
 *
 * Only runs on success: errors skip `map()` and go to AllExceptionsFilter,
 * so an exception is never turned into a success response.
 */
@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const targets = [context.getHandler(), context.getClass()];
    const shouldSkip = this.reflector.getAllAndOverride<boolean | undefined>(
      SKIP_RESPONSE_WRAP_KEY,
      targets,
    );
    if (shouldSkip === true) {
      return next.handle();
    }

    const message = this.reflector.getAllAndOverride<string | undefined>(
      RESPONSE_MESSAGE_KEY,
      targets,
    );
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    return next.handle().pipe(
      map((data: unknown) => {
        // Raw payloads, and handlers that already wrote the response (@Res()).
        if (isRawPayload(data) || response.headersSent) {
          return data;
        }
        return buildSuccessResponse(data, requestPath(request), message);
      }),
    );
  }
}
