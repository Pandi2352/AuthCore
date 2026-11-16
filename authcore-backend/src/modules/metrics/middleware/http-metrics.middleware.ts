import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

import { MetricsService } from '../metrics.service';

/**
 * Times every request. The route label is the route pattern
 * ("/api/v1/files/:id"), never the real path, so ids don't create new series.
 */
@Injectable()
export class HttpMetricsMiddleware implements NestMiddleware {
  constructor(private readonly metricsService: MetricsService) {}

  use(request: Request, response: Response, next: NextFunction): void {
    const start = process.hrtime.bigint();
    response.once('finish', () => {
      const route = (request.route as { path?: unknown } | undefined)?.path;
      const seconds = Number(process.hrtime.bigint() - start) / 1e9;
      this.metricsService.observeHttp(
        request.method,
        typeof route === 'string' ? request.baseUrl + route : 'unmatched',
        response.statusCode,
        seconds,
      );
    });
    next();
  }
}
