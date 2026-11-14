import {
  type CallHandler,
  type ExecutionContext,
  HttpStatus,
  Inject,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  catchError,
  type Observable,
  throwError,
  timeout,
  TimeoutError,
} from 'rxjs';

import { ErrorCode } from '@common/constants/error-codes.constants';
import { HANDLER_TIMEOUT_KEY } from '@common/decorators/handler-timeout.decorator';
import { AppException } from '@common/exceptions/app.exception';

/** Injection token for the default handler timeout (provided by AppModule from config). */
export const DEFAULT_HANDLER_TIMEOUT_MS = Symbol('DEFAULT_HANDLER_TIMEOUT_MS');

/**
 * Fails a request with 408 REQUEST_TIMEOUT if the handler takes longer than
 * HANDLER_TIMEOUT_MS (or @HandlerTimeout()). The client gets an answer, but
 * the work already started is not cancelled: database queries have their own
 * limit (MONGODB_QUERY_TIMEOUT_MS).
 */
@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    @Inject(DEFAULT_HANDLER_TIMEOUT_MS)
    private readonly defaultTimeoutMs: number,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const routeTimeoutMs = this.reflector.getAllAndOverride<number | undefined>(
      HANDLER_TIMEOUT_KEY,
      [context.getHandler(), context.getClass()],
    );
    const timeoutMs = routeTimeoutMs ?? this.defaultTimeoutMs;

    return next.handle().pipe(
      timeout(timeoutMs),
      catchError((error: unknown) =>
        throwError(() =>
          error instanceof TimeoutError
            ? new AppException(
                HttpStatus.REQUEST_TIMEOUT,
                ErrorCode.RequestTimeout,
              )
            : error,
        ),
      ),
    );
  }
}
