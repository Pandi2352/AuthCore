import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsDefined,
  IsEmail,
  IsEnum,
  IsIn,
  IsNotIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

import { Match } from '@common/decorators/match.decorator';
import { ListQueryDto } from '@common/dto/list-query.dto';
import {
  trim,
  trimLower,
  trimOrUndefined,
  trimUpper,
} from '@common/utils/transform.util';
import { MAX_BULK_ITEMS } from '@modules/access-control/constants/access-control.constants';
import {
  PERSON_NAME_PATTERN,
  RESERVED_USERNAMES,
  USERNAME_PATTERN,
} from '@modules/auth/constants/auth.constants';
import { IsNewPassword } from '@modules/auth/decorators/new-password.decorator';
import { UserResponseDto } from '@modules/users/dto/user-response.dto';

import { InviteStatus } from '../enums/invite-status.enum';

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
export const INVITE_SORT_FIELDS = [
  'createdAt',
  'expiresAt',
  'email',
  'status',
] as const;
const lowerIds = ({ value }: { value: unknown }): unknown =>
  Array.isArray(value)
    ? (value as unknown[]).map((v: unknown) =>
        typeof v === 'string' ? v.trim().toLowerCase() : v,
      )
    : value;

export class InvitePersonDto {
  @ApiProperty({ example: 'new.person@example.com' })
  @IsEmail()
  @MaxLength(254)
  @Transform(trimLower)
  @IsString()
  @IsDefined({ message: 'email is required' })
  email!: string;

  @ApiPropertyOptional({ example: 'Priya', maxLength: 50 })
  @Matches(PERSON_NAME_PATTERN, {
    message: 'firstName contains characters that are not allowed',
  })
  @Length(1, 50)
  @Transform(trimOrUndefined)
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiPropertyOptional({ example: 'Sharma', maxLength: 50 })
  @Matches(PERSON_NAME_PATTERN, {
    message: 'lastName contains characters that are not allowed',
  })
  @Length(1, 50)
  @Transform(trimOrUndefined)
  @IsString()
  @IsOptional()
  lastName?: string;
}

class InviteOptionsDto {
  @ApiPropertyOptional({
    type: [String],
    description:
      'Groups the person joins on acceptance (you can only grant permissions you hold)',
  })
  @IsUUID('all', { each: true })
  @ArrayUnique()
  @ArrayMaxSize(MAX_BULK_ITEMS)
  @IsArray()
  @Transform(lowerIds)
  @IsOptional()
  groupIds?: string[];

  @ApiPropertyOptional({
    example: 'Welcome to the team!',
    maxLength: 500,
    description: 'Shown in the invitation email',
  })
  @MaxLength(500)
  @Transform(trimOrUndefined)
  @IsString()
  @IsOptional()
  message?: string;
}

export class CreateInviteDto extends InvitePersonDto {
  @ApiPropertyOptional({ type: [String] })
  @IsUUID('all', { each: true })
  @ArrayUnique()
  @ArrayMaxSize(MAX_BULK_ITEMS)
  @IsArray()
  @Transform(lowerIds)
  @IsOptional()
  groupIds?: string[];

  @ApiPropertyOptional({ example: 'Welcome to the team!', maxLength: 500 })
  @MaxLength(500)
  @Transform(trimOrUndefined)
  @IsString()
  @IsOptional()
  message?: string;
}

export class BulkInviteDto extends InviteOptionsDto {
  @ApiProperty({
    type: [InvitePersonDto],
    maxItems: MAX_BULK_ITEMS,
    description: 'Same groupIds / message for everyone',
  })
  @ValidateNested({ each: true })
  @Type(() => InvitePersonDto)
  @ArrayMaxSize(MAX_BULK_ITEMS)
  @ArrayMinSize(1)
  @IsArray()
  @IsDefined({ message: 'invites is required' })
  invites!: InvitePersonDto[];
}

export class InviteTokenDto {
  @ApiProperty({
    example: 'q7Cw0p0Gk1H8mK3x9V2bLZsYtR4uE6aN1oFjD5cWhPg',
    description: 'The `token` parameter from the invitation link',
  })
  @Matches(TOKEN_PATTERN, { message: 'token is not valid' })
  @Transform(trim)
  @IsString()
  @IsDefined({ message: 'token is required' })
  token!: string;
}

export class AcceptInviteDto extends InviteTokenDto {
  @ApiProperty({
    example: 'Str0ng!Passw0rd',
    format: 'password',
    description: 'Password policy applies',
  })
  @IsNewPassword('password')
  password!: string;

  @ApiProperty({ example: 'Str0ng!Passw0rd', format: 'password' })
  @Match('password')
  @IsString()
  @IsDefined({ message: 'confirmPassword is required' })
  confirmPassword!: string;

  @ApiPropertyOptional({
    example: 'Priya',
    description:
      'Defaults to the name in the invite (required if the invite has none)',
  })
  @Matches(PERSON_NAME_PATTERN, {
    message: 'firstName contains characters that are not allowed',
  })
  @Length(1, 50)
  @Transform(trimOrUndefined)
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiPropertyOptional({ example: 'Sharma' })
  @Matches(PERSON_NAME_PATTERN, {
    message: 'lastName contains characters that are not allowed',
  })
  @Length(1, 50)
  @Transform(trimOrUndefined)
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiPropertyOptional({ example: 'priya' })
  @IsNotIn([...RESERVED_USERNAMES], { message: 'username is not available' })
  @Matches(USERNAME_PATTERN, {
    message:
      "username must be 3–30 characters: letters, numbers, '.', '_' or '-'",
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && value.trim() !== ''
      ? value.trim().toLowerCase()
      : undefined,
  )
  @IsString()
  @IsOptional()
  username?: string;
}

export class InviteListQueryDto extends ListQueryDto {
  @ApiPropertyOptional({ enum: InviteStatus })
  @IsEnum(InviteStatus)
  @Transform(trimUpper)
  @IsOptional()
  status?: InviteStatus;

  @ApiPropertyOptional({ description: 'Invites sent by this user id' })
  @IsUUID('all')
  @Transform(trimLower)
  @IsOptional()
  invitedBy?: string;

  @ApiPropertyOptional({ enum: INVITE_SORT_FIELDS, default: 'createdAt' })
  @IsIn(INVITE_SORT_FIELDS)
  @IsOptional()
  sortBy?: (typeof INVITE_SORT_FIELDS)[number];
}

export class InviterDto {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'Ops Admin' }) name!: string;
}

export class InviteResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'new.person@example.com' }) email!: string;
  @ApiProperty({ type: String, nullable: true }) firstName!: string | null;
  @ApiProperty({ type: String, nullable: true }) lastName!: string | null;
  @ApiProperty({
    enum: InviteStatus,
    description: 'EXPIRED = pending past its expiry date',
  })
  status!: InviteStatus;
  @ApiProperty({ type: [String] }) groupIds!: string[];
  @ApiProperty({ type: String, nullable: true }) message!: string | null;
  @ApiProperty() expiresAt!: Date;
  @ApiProperty({ type: InviterDto, nullable: true })
  invitedBy!: InviterDto | null;
  @ApiProperty({ example: 0 }) resendCount!: number;
  @ApiProperty() lastSentAt!: Date;
  @ApiProperty({ type: Date, nullable: true }) acceptedAt!: Date | null;
  @ApiProperty({ type: String, nullable: true }) acceptedUserId!: string | null;
  @ApiProperty({ type: Date, nullable: true }) revokedAt!: Date | null;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}

export class BulkInviteSkippedDto {
  @ApiProperty() email!: string;
  @ApiProperty({
    enum: ['ALREADY_REGISTERED', 'ALREADY_INVITED', 'DUPLICATE_IN_REQUEST'],
  })
  reason!: string;
}

export class BulkInviteResultDto {
  @ApiProperty({ example: 2 }) createdCount!: number;
  @ApiProperty({ type: [InviteResponseDto] }) created!: InviteResponseDto[];
  @ApiProperty({ type: [BulkInviteSkippedDto] })
  skipped!: BulkInviteSkippedDto[];
}

/** What the invitee sees before accepting (public). */
export class InvitePublicInfoDto {
  @ApiProperty({ example: 'new.person@example.com' }) email!: string;
  @ApiProperty({ type: String, nullable: true }) firstName!: string | null;
  @ApiProperty({ type: String, nullable: true }) lastName!: string | null;
  @ApiProperty({ example: 'Ops Admin' }) invitedByName!: string;
  @ApiProperty({ example: 'AuthCore' }) appName!: string;
  @ApiProperty() expiresAt!: Date;
  @ApiProperty({ enum: InviteStatus }) status!: InviteStatus;
  @ApiProperty({ example: true, description: 'Can be accepted now' })
  isAcceptable!: boolean;
}

export class AcceptInviteResponseDto {
  @ApiProperty({ type: UserResponseDto }) user!: UserResponseDto;
  @ApiProperty({ example: 1, description: 'Groups joined' })
  groupsJoined!: number;
}
