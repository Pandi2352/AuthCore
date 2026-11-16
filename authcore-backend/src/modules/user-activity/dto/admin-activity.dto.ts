import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDate,
  IsEnum,
  IsIn,
  IsIP,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

import { PaginationQueryDto } from '@common/dto/pagination-query.dto';
import { trimLower, trimOrUndefined } from '@common/utils/transform.util';

import { ActivityEvent } from '../enums/user-activity.enum';
import { UserActivityDto } from './user-activity.dto';

/** Sign-in related events: the "login history" view. */
export const LOGIN_HISTORY_EVENTS: readonly ActivityEvent[] = [
  ActivityEvent.Login,
  ActivityEvent.LoginFailed,
  ActivityEvent.NewDeviceLogin,
  ActivityEvent.AccountLocked,
  ActivityEvent.Logout,
  ActivityEvent.LogoutAll,
];

const toBoolean = ({ value }: { value: unknown }): unknown =>
  value === 'true' ? true : value === 'false' ? false : value;

/** "LOGIN, login_failed" or ["LOGIN"] → ["LOGIN", "LOGIN_FAILED"]. */
const toEventList = ({ value }: { value: unknown }): unknown => {
  const parts = typeof value === 'string' ? value.split(',') : value;
  return Array.isArray(parts)
    ? [
        ...new Set(
          parts
            .filter((p): p is string => typeof p === 'string')
            .map((p) => p.trim().toUpperCase())
            .filter(Boolean),
        ),
      ]
    : value;
};

export class AdminActivityQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'One user' })
  @IsUUID('all')
  @Transform(trimLower)
  @IsOptional()
  userId?: string;

  @ApiPropertyOptional({
    description: 'Users whose email / name contains this text',
    example: 'jane',
  })
  @MaxLength(100)
  @IsString()
  @Transform(trimOrUndefined)
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    description: 'Comma-separated events (GET /admin/activity/event-types)',
    example: 'LOGIN_FAILED,ACCOUNT_LOCKED',
  })
  @IsEnum(ActivityEvent, { each: true })
  @ArrayMaxSize(30)
  @IsArray()
  @Transform(toEventList)
  @IsOptional()
  events?: ActivityEvent[];

  @ApiPropertyOptional({
    description: 'Only successful (true) or failed (false) events',
  })
  @IsBoolean()
  @Transform(toBoolean)
  @IsOptional()
  isSuccess?: boolean;

  @ApiPropertyOptional({ example: '143.110.245.176' })
  @IsIP()
  @Transform(trimOrUndefined)
  @IsOptional()
  ipAddress?: string;

  @ApiPropertyOptional({
    example: 'mobile',
    description: 'desktop, mobile, tablet, tv, bot, unknown',
  })
  @MaxLength(20)
  @IsString()
  @Transform(trimLower)
  @IsOptional()
  deviceType?: string;

  @ApiPropertyOptional({
    example: 'chrome',
    description: 'Browser contains (case-insensitive)',
  })
  @MaxLength(50)
  @IsString()
  @Transform(trimOrUndefined)
  @IsOptional()
  browser?: string;

  @ApiPropertyOptional({ example: '2026-11-01T00:00:00Z' })
  @IsDate()
  @Type(() => Date)
  @IsOptional()
  from?: Date;

  @ApiPropertyOptional({ example: '2026-11-30T23:59:59Z' })
  @IsDate()
  @Type(() => Date)
  @IsOptional()
  to?: Date;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsIn(['asc', 'desc'])
  @IsOptional()
  sortOrder?: 'asc' | 'desc';
}

export class ActivityUserRefDto {
  @ApiProperty() id!: string;
  @ApiProperty() email!: string;
  @ApiProperty() firstName!: string;
  @ApiProperty({ type: String, nullable: true }) lastName!: string | null;
}

export class AdminActivityDto extends UserActivityDto {
  @ApiProperty() userId!: string;

  @ApiProperty({
    type: ActivityUserRefDto,
    nullable: true,
    description: 'null if the user was deleted',
  })
  user!: ActivityUserRefDto | null;

  @ApiProperty({ type: String, nullable: true }) sessionId!: string | null;
}

export class ActivityEventTypeDto {
  @ApiProperty({ example: 'LOGIN_FAILED' }) value!: string;
  @ApiProperty({ example: 'Login failed' }) label!: string;
  @ApiProperty({ description: 'Shown in the login history view' })
  isLoginEvent!: boolean;
}
