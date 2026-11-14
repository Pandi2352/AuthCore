import { Controller, Get, Header, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';

import { API_TAGS } from '@common/constants/api-tags.constants';
import {
  ApiErrorResponses,
  ApiWrappedResponse,
} from '@common/decorators/api-response.decorator';

import { HealthResponseDto } from './dto/health-response.dto';
import { HealthService } from './health.service';

/** Polled by load balancers and orchestrators: not rate limited, never cached. */
@ApiTags(API_TAGS.Health.name)
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Overall health (database + uptime)' })
  @ApiWrappedResponse(HealthResponseDto)
  @ApiErrorResponses(HttpStatus.SERVICE_UNAVAILABLE)
  check(): Promise<HealthResponseDto> {
    return this.healthService.check();
  }

  @Get('live')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Liveness: the process is running' })
  @ApiWrappedResponse(HealthResponseDto)
  live(): HealthResponseDto {
    return this.healthService.live();
  }

  @Get('ready')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Readiness: database reachable and not shutting down',
  })
  @ApiWrappedResponse(HealthResponseDto)
  @ApiErrorResponses(HttpStatus.SERVICE_UNAVAILABLE)
  ready(): Promise<HealthResponseDto> {
    return this.healthService.ready();
  }
}
