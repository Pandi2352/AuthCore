import { setTimeout as sleep } from 'node:timers/promises';

import {
  type BeforeApplicationShutdown,
  Inject,
  Injectable,
  Logger,
  type OnApplicationShutdown,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';

import { markShuttingDown } from '@common/context/app-state';
import { lifecycleConfig } from '@config/configuration';

/**
 * Graceful shutdown on SIGTERM / SIGINT (enabled by app.enableShutdownHooks()):
 *
 * 1. beforeApplicationShutdown: mark "shutting down" so readiness returns 503,
 *    start a force-exit timer, then wait SHUTDOWN_DRAIN_DELAY_MS so load
 *    balancers stop sending traffic.
 * 2. Nest closes the HTTP server: no new connections; in-flight requests finish.
 * 3. onApplicationShutdown: MongoDB connections are closed by @nestjs/mongoose.
 *
 * If all of this takes longer than SHUTDOWN_TIMEOUT_MS, the process exits with code 1.
 */
@Injectable()
export class LifecycleService
  implements BeforeApplicationShutdown, OnApplicationShutdown
{
  private readonly logger = new Logger('Lifecycle');

  constructor(
    @Inject(lifecycleConfig.KEY)
    private readonly lifecycle: ConfigType<typeof lifecycleConfig>,
  ) {}

  async beforeApplicationShutdown(signal?: string): Promise<void> {
    markShuttingDown();
    const { drainDelayMs, shutdownTimeoutMs } = this.lifecycle;
    this.logger.log(
      `Shutting down${signal ? ` (${signal})` : ''}: readiness now failing, ` +
        `draining ${drainDelayMs}ms, timeout ${shutdownTimeoutMs}ms`,
    );

    const forceExit = setTimeout(() => {
      this.logger.error(
        `Graceful shutdown took longer than ${shutdownTimeoutMs}ms; forcing exit`,
      );
      process.exit(1);
    }, shutdownTimeoutMs);
    forceExit.unref();

    if (drainDelayMs > 0) {
      await sleep(drainDelayMs);
    }
    this.logger.log('Closing HTTP server; waiting for in-flight requests');
  }

  onApplicationShutdown(): void {
    this.logger.log('Shutdown complete');
  }
}
