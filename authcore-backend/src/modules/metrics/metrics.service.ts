import { timingSafeEqual } from 'node:crypto';

import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import {
  collectDefaultMetrics,
  Counter,
  Histogram,
  Registry,
} from 'prom-client';

import { ErrorCode } from '@common/constants/error-codes.constants';
import { AppException } from '@common/exceptions/app.exception';
import { appConfig, metricsConfig } from '@config/configuration';

const PREFIX = 'authcore_';

/**
 * Prometheus metrics: Node.js process metrics (CPU, memory, event-loop lag,
 * GC), HTTP request durations, account events (sign-ins, failures, lockouts
 * …) and emails. Labels never hold personal data (no ids, emails or IPs).
 */
@Injectable()
export class MetricsService {
  readonly registry = new Registry();

  private readonly httpDuration = new Histogram({
    name: `${PREFIX}http_request_duration_seconds`,
    help: 'HTTP request duration by method, route pattern and status code',
    labelNames: ['method', 'route', 'status_code'] as const,
    buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [this.registry],
  });

  private readonly userEvents = new Counter({
    name: `${PREFIX}user_events_total`,
    help: 'Account activity events (LOGIN, LOGIN_FAILED, ACCOUNT_LOCKED, …)',
    labelNames: ['event', 'success'] as const,
    registers: [this.registry],
  });

  private readonly emails = new Counter({
    name: `${PREFIX}emails_total`,
    help: 'Emails by template and result (sent / failed)',
    labelNames: ['template', 'result'] as const,
    registers: [this.registry],
  });

  constructor(
    @Inject(metricsConfig.KEY)
    private readonly config: ConfigType<typeof metricsConfig>,
    @Inject(appConfig.KEY)
    private readonly app: ConfigType<typeof appConfig>,
  ) {
    collectDefaultMetrics({ register: this.registry, prefix: PREFIX });
  }

  /**
   * Disabled, or no METRICS_TOKEN in production → 404; with a token, a
   * missing / wrong "Bearer <token>" → 401 (constant-time comparison).
   */
  assertScrapeAllowed(authorization: string | undefined): void {
    const expected = this.config.token;
    if (!this.config.isEnabled || (expected === '' && this.app.isProduction)) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NotFound,
        'Not found',
      );
    }
    if (expected === '') {
      return;
    }
    const header = authorization ?? '';
    const given = Buffer.from(
      header.startsWith('Bearer ') ? header.slice(7) : '',
    );
    const wanted = Buffer.from(expected);
    if (given.length !== wanted.length || !timingSafeEqual(given, wanted)) {
      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        ErrorCode.Unauthorized,
        'Metrics token required',
      );
    }
  }

  observeHttp(
    method: string,
    route: string,
    statusCode: number,
    seconds: number,
  ): void {
    this.httpDuration.observe(
      { method, route, status_code: String(statusCode) },
      seconds,
    );
  }

  countUserEvent(event: string, isSuccess: boolean): void {
    this.userEvents.inc({ event, success: String(isSuccess) });
  }

  countEmail(template: string, result: 'sent' | 'failed'): void {
    this.emails.inc({ template, result });
  }

  render(): Promise<string> {
    return this.registry.metrics();
  }

  get contentType(): string {
    return this.registry.contentType;
  }
}
