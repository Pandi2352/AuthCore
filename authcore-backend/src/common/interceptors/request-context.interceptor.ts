import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { Observable } from 'rxjs';

import { runWithRequestContext } from '@common/context/request-context';

/**
 * Re-enters the request context around the handler.
 *
 * requestIdMiddleware starts the context, but Node can lose it while the
 * request body stream is read (stream events run outside it). Running the
 * handler inside the context again guarantees that every log written by
 * controllers and services carries the request id.
 */
@Injectable()
export class RequestContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }
    const { requestId } = context.switchToHttp().getRequest<Request>();
    if (requestId === undefined) {
      return next.handle();
    }

    return new Observable((subscriber) =>
      runWithRequestContext({ requestId }, () =>
        next.handle().subscribe(subscriber),
      ),
    );
  }
}
