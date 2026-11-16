import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional } from 'class-validator';

import { PaginationQueryDto } from '@common/dto/pagination-query.dto';
import { trimUpper } from '@common/utils/transform.util';

import { ActivityEvent, VerificationType } from '../enums/user-activity.enum';

export class ActivityQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ActivityEvent })
  @IsEnum(ActivityEvent)
  @Transform(trimUpper)
  @IsOptional()
  event?: ActivityEvent;
}

export class UserActivityDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: ActivityEvent, example: ActivityEvent.Login })
  event!: ActivityEvent;
  @ApiProperty({ enum: VerificationType, example: VerificationType.Password })
  verificationType!: VerificationType;
  @ApiProperty({ example: true }) isSuccess!: boolean;
  @ApiProperty({
    example: '2026-11-16T06:07:00.000Z',
    description: 'Event date and time',
  })
  occurredAt!: Date;
  @ApiProperty({ type: String, nullable: true, example: 'desktop' })
  deviceType!: string | null;
  @ApiProperty({ type: String, nullable: true, example: 'Windows 10' }) os!:
    string | null;
  @ApiProperty({ type: String, nullable: true, example: 'Chrome 131' })
  browser!: string | null;
  @ApiProperty({ type: String, nullable: true, example: '143.110.245.176' })
  ipAddress!: string | null;
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Set when an admin caused the event',
  })
  actorId!: string | null;
  @ApiProperty({ type: Object, nullable: true }) details!: Record<
    string,
    unknown
  > | null;
}
