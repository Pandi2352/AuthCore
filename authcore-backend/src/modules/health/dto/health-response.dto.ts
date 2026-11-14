import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class HealthChecksDto {
  @ApiProperty({ example: 'up', enum: ['up'] })
  database!: 'up';
}

export class HealthResponseDto {
  @ApiProperty({ example: 'ok', enum: ['ok'] })
  status!: 'ok';

  @ApiPropertyOptional({ type: HealthChecksDto })
  checks?: HealthChecksDto;

  @ApiPropertyOptional({
    example: 3600,
    description: 'Seconds since the process started',
  })
  uptimeSeconds?: number;
}
