import { Controller, Get, HttpStatus, Req, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request, Response } from 'express';

import { Public } from '@common/decorators/public.decorator';

import { MetricsService } from './metrics.service';

/**
 * Prometheus scrape endpoint (GET /api/v1/metrics, text format). Protected by
 * METRICS_TOKEN (Authorization: Bearer <token>). Without a token it is open in
 * development and disabled (404) in production. Not in Swagger.
 */
@ApiExcludeController()
@Public()
@SkipThrottle()
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  async metrics(
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    this.metricsService.assertScrapeAllowed(request.get('authorization'));
    response
      .status(HttpStatus.OK)
      .set({
        'Content-Type': this.metricsService.contentType,
        'Cache-Control': 'no-store',
      })
      .send(await this.metricsService.render());
  }
}
