import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDefined,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import {
  SchedulerExecutionStatus,
  SchedulerFrequency,
} from '../enums/scheduler.enum';

export class SchedulerSettingsDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  @IsDefined()
  enabled!: boolean;

  @ApiProperty({
    enum: SchedulerFrequency,
    enumName: 'SchedulerFrequency',
    example: SchedulerFrequency.Daily,
  })
  @IsEnum(SchedulerFrequency)
  @IsDefined()
  frequency!: SchedulerFrequency;

  @ApiProperty({
    example: '09:00',
    description: 'HH:mm, 24-hour, in `timezone`. HOURLY uses only the minutes.',
  })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'executionTime must be HH:mm (24-hour)',
  })
  @IsString()
  @IsDefined()
  executionTime!: string;

  @ApiProperty({ example: 'Asia/Kolkata', description: 'IANA time zone' })
  @MaxLength(64)
  @IsString()
  @IsDefined()
  timezone!: string;

  @ApiPropertyOptional({
    example: 1,
    minimum: 1,
    maximum: 7,
    description: 'WEEKLY: 1 = Monday … 7 = Sunday (default 1)',
  })
  @Max(7)
  @Min(1)
  @IsInt()
  @IsOptional()
  dayOfWeek?: number;

  @ApiPropertyOptional({
    example: 1,
    minimum: 1,
    maximum: 28,
    description: 'MONTHLY: day 1–28 (default 1)',
  })
  @Max(28)
  @Min(1)
  @IsInt()
  @IsOptional()
  dayOfMonth?: number;
}

export class UpdateSchedulersDto {
  @ApiProperty({
    type: SchedulerSettingsDto,
    description:
      'Emails users whose password expires soon (needs password validity enabled)',
  })
  @ValidateNested()
  @Type(() => SchedulerSettingsDto)
  @IsObject()
  @IsDefined()
  passwordExpiryNotification!: SchedulerSettingsDto;
}

export class SchedulerStateDto extends SchedulerSettingsDto {
  @ApiProperty({ example: 1 })
  declare dayOfWeek: number;

  @ApiProperty({ example: 1 })
  declare dayOfMonth: number;

  @ApiProperty({
    type: Date,
    nullable: true,
    example: '2026-11-16T03:30:00.000Z',
  })
  lastExecutedAt!: Date | null;

  @ApiProperty({
    type: Date,
    nullable: true,
    example: '2026-11-17T03:30:00.000Z',
  })
  nextExecutionAt!: Date | null;

  @ApiProperty({
    enum: SchedulerExecutionStatus,
    enumName: 'SchedulerExecutionStatus',
    example: SchedulerExecutionStatus.Success,
  })
  lastExecutionStatus!: SchedulerExecutionStatus;

  @ApiProperty({
    type: Object,
    nullable: true,
    example: { usersChecked: 12, sent: 3, failed: 0, alreadyNotified: 9 },
  })
  lastExecutionSummary!: Record<string, number | string> | null;
}

export class SchedulersResponseDto {
  @ApiProperty({ type: SchedulerStateDto })
  passwordExpiryNotification!: SchedulerStateDto;
}

export class SchedulerRunResponseDto {
  @ApiProperty({
    enum: SchedulerExecutionStatus,
    enumName: 'SchedulerExecutionStatus',
    example: SchedulerExecutionStatus.Success,
  })
  status!: SchedulerExecutionStatus;

  @ApiProperty({
    type: Object,
    example: { usersChecked: 12, sent: 3, failed: 0, alreadyNotified: 9 },
  })
  summary!: Record<string, number | string>;
}
