import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';

import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Module({
  // Terminus' own error logging is off; HealthService logs failures.
  imports: [TerminusModule.forRoot({ logger: false })],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
