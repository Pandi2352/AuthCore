import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { HealthCheckService, MongooseHealthIndicator } from '@nestjs/terminus';

import { ErrorCode } from '@common/constants/error-codes.constants';
import { isShuttingDown } from '@common/context/app-state';
import { AppException } from '@common/exceptions/app.exception';
import { ApiFieldError } from '@common/interfaces/api-response.interface';
import { lifecycleConfig } from '@config/configuration';

import { HealthResponseDto } from './dto/health-response.dto';

function unavailable(errors: ApiFieldError[]): AppException {
  return new AppException(
    HttpStatus.SERVICE_UNAVAILABLE,
    ErrorCode.ServiceUnavailable,
    undefined,
    errors,
  );
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private readonly health: HealthCheckService,
    private readonly mongoose: MongooseHealthIndicator,
    @Inject(lifecycleConfig.KEY)
    private readonly lifecycle: ConfigType<typeof lifecycleConfig>,
  ) {}

  /** Liveness: the process is running and can answer. No dependencies. */
  live(): HealthResponseDto {
    return { status: 'ok' };
  }

  /** Readiness: can serve traffic (not shutting down, database reachable). */
  async ready(): Promise<HealthResponseDto> {
    if (isShuttingDown()) {
      throw unavailable([{ field: 'application', message: 'Shutting down' }]);
    }
    try {
      await this.health.check([
        this.mongoose.pingCheck('database', {
          timeout: this.lifecycle.healthDbTimeoutMs,
        }),
      ]);
    } catch {
      this.logger.warn('Readiness check failed: database not reachable');
      throw unavailable([
        { field: 'database', message: 'Database is not reachable' },
      ]);
    }
    return { status: 'ok', checks: { database: 'up' } };
  }

  /** Overall health: readiness plus process uptime. */
  async check(): Promise<HealthResponseDto> {
    const { status, checks } = await this.ready();
    return { status, checks, uptimeSeconds: Math.floor(process.uptime()) };
  }
}
