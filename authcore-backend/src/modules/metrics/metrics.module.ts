import { Global, Module } from '@nestjs/common';

import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';
import { HttpMetricsMiddleware } from './middleware/http-metrics.middleware';

/** Global: any module can count events (MetricsService). */
@Global()
@Module({
  controllers: [MetricsController],
  providers: [MetricsService, HttpMetricsMiddleware],
  exports: [MetricsService, HttpMetricsMiddleware],
})
export class MetricsModule {}
