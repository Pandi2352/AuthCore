import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDefined,
  IsEmail,
  IsEnum,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
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
import { UpdateProfileDto } from '@modules/account/dto/account.dto';
import { PERSON_NAME_PATTERN } from '@modules/auth/constants/auth.constants';
import { IsNewPassword } from '@modules/auth/decorators/new-password.decorator';
import { AdminUserResponseDto } from '@modules/users/dto/user-response.dto';
import { UserRole } from '@modules/users/enums/user-role.enum';
import { UserSource } from '@modules/users/enums/user-source.enum';
import { UserStatus } from '@modules/users/enums/user-status.enum';

export const ADMIN_USER_SORT_FIELDS = [
  'email',
  'firstName',
  'lastName',
  'status',
  'createdAt',
  'updatedAt',
  'lastLoginAt',
] as const;
export const ADMIN_SETTABLE_STATUSES = [
  UserStatus.Active,
  UserStatus.Inactive,
  UserStatus.Suspended,
  UserStatus.Banned,
] as const;

const toBoolean = ({ value }: { value: unknown }): unknown =>
  value === 'true' ? true : value === 'false' ? false : value;
const lowerIds = ({ value }: { value: unknown }): unknown =>
  Array.isArray(value)
    ? (value as unknown[]).map((v: unknown) =>
        typeof v === 'string' ? v.trim().toLowerCase() : v,
      )
    : value;

export class AdminUserListQueryDto extends ListQueryDto {
  @ApiPropertyOptional({ enum: UserStatus })
  @IsEnum(UserStatus)
  @Transform(trimUpper)
  @IsOptional()
  status?: UserStatus;

  @ApiPropertyOptional({ enum: UserRole })
  @IsEnum(UserRole)
  @Transform(trimUpper)
  @IsOptional()
  role?: UserRole;

  @ApiPropertyOptional({ enum: UserSource })
  @IsEnum(UserSource)
  @Transform(trimUpper)
  @IsOptional()
  source?: UserSource;

  @ApiPropertyOptional()
  @IsBoolean()
  @Transform(toBoolean)
  @IsOptional()
  isEmailVerified?: boolean;

  @ApiPropertyOptional({
    description: 'Accounts waiting for their scheduled deletion',
  })
  @IsBoolean()
  @Transform(toBoolean)
  @IsOptional()
  isPendingDeletion?: boolean;

  @ApiPropertyOptional({
    enum: ['EXCLUDE', 'ONLY', 'INCLUDE'],
    default: 'EXCLUDE',
    description: 'Soft-deleted users',
  })
  @IsIn(['EXCLUDE', 'ONLY', 'INCLUDE'])
  @Transform(trimUpper)
  @IsOptional()
  deleted?: 'EXCLUDE' | 'ONLY' | 'INCLUDE';

  @ApiPropertyOptional({
    type: Object,
    example: { employee_id: 'E123' },
    description:
      'Filter by searchable custom variables: ?attr[employee_id]=E123 (exact, case-insensitive)',
  })
  @IsObject()
  @IsOptional()
  attr?: Record<string, string>;

  @ApiPropertyOptional({ enum: ADMIN_USER_SORT_FIELDS, default: 'createdAt' })
  @IsIn(ADMIN_USER_SORT_FIELDS)
  @IsOptional()
  sortBy?: (typeof ADMIN_USER_SORT_FIELDS)[number];
}

export class AdminCreateUserDto {
  @ApiProperty({ example: 'sam.lee@example.com' })
  @IsEmail()
  @MaxLength(254)
  @Transform(trimLower)
  @IsString()
  @IsDefined({ message: 'email is required' })
  email!: string;

  @ApiProperty({ example: 'Sam', maxLength: 50 })
  @Matches(PERSON_NAME_PATTERN, {
    message: 'firstName contains characters that are not allowed',
  })
  @Length(1, 50)
  @Transform(trim)
  @IsString()
  @IsDefined({ message: 'firstName is required' })
  firstName!: string;

  @ApiPropertyOptional({ example: 'Lee', maxLength: 50 })
  @Matches(PERSON_NAME_PATTERN, {
    message: 'lastName contains characters that are not allowed',
  })
  @Length(1, 50)
  @Transform(trimOrUndefined)
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiPropertyOptional({ example: 'samlee' })
  @Matches(/^[a-z0-9](?:[a-z0-9._-]{1,28})[a-z0-9]$/, {
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

  @ApiProperty({
    description:
      'Initial password (password policy applies). Give it to the user securely; it is never emailed.',
    example: 'Initial#Pass2026',
    format: 'password',
  })
  @IsNewPassword('password')
  password!: string;

  @ApiPropertyOptional({
    default: true,
    description: 'The user must choose a new password at the first sign-in',
  })
  @IsBoolean()
  @IsOptional()
  mustChangePassword?: boolean;

  @ApiPropertyOptional({
    default: true,
    description: 'The admin vouches for the address (no verification email)',
  })
  @IsBoolean()
  @IsOptional()
  isEmailVerified?: boolean;

  @ApiPropertyOptional({
    type: [String],
    description:
      'Add the user to these groups (you can only grant permissions you hold)',
  })
  @IsUUID('all', { each: true })
  @ArrayUnique()
  @ArrayMaxSize(MAX_BULK_ITEMS)
  @IsArray()
  @Transform(lowerIds)
  @IsOptional()
  groupIds?: string[];

  @ApiPropertyOptional({
    type: Object,
    example: { employee_id: 'E123', designation: 'Engineer' },
    description:
      'Custom variable values (admin rules: internal and read-only allowed)',
  })
  @IsObject()
  @IsOptional()
  attributes?: Record<string, unknown>;

  @ApiPropertyOptional({
    default: true,
    description:
      'Email the user that an account was created (without the password)',
  })
  @IsBoolean()
  @IsOptional()
  sendWelcomeEmail?: boolean;
}

export class AdminUpdateUserDto extends UpdateProfileDto {
  @ApiPropertyOptional({
    example: true,
    description: 'The "Email verified" toggle',
  })
  @IsBoolean()
  @IsOptional()
  isEmailVerified?: boolean;

  @ApiPropertyOptional({
    example: 'sam.new@example.com',
    description:
      'Changed directly (the admin vouches for it); the old address is notified',
  })
  @IsEmail()
  @MaxLength(254)
  @Transform(trimLower)
  @IsString()
  @IsOptional()
  email?: string;
}

export class AdminSetStatusDto {
  @ApiProperty({ enum: ADMIN_SETTABLE_STATUSES, example: UserStatus.Suspended })
  @IsIn(ADMIN_SETTABLE_STATUSES)
  @Transform(trimUpper)
  @IsDefined({ message: 'status is required' })
  status!: (typeof ADMIN_SETTABLE_STATUSES)[number];

  @ApiPropertyOptional({
    example: 'Repeated policy violations',
    maxLength: 500,
    description: 'Stored, and included in the email to the user',
  })
  @MaxLength(500)
  @Transform(trimOrUndefined)
  @IsString()
  @IsOptional()
  reason?: string;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  notifyUser?: boolean;
}

export class AdminSetRoleDto {
  @ApiProperty({ enum: UserRole, example: UserRole.Admin })
  @IsEnum(UserRole)
  @Transform(trimUpper)
  @IsDefined({ message: 'role is required' })
  role!: UserRole;
}

/** "Reset password" panel: the admin sets (or generates) the new password. */
export class AdminSetPasswordDto {
  @ApiProperty({
    example: 'Gen3rated!Pass26',
    format: 'password',
    description:
      'Password policy and history apply. Use POST /password-policies/generate-password for "Generate".',
  })
  @IsNewPassword('newPassword')
  newPassword!: string;

  @ApiProperty({ example: 'Gen3rated!Pass26', format: 'password' })
  @Match('newPassword')
  @IsString()
  @IsDefined({ message: 'confirmPassword is required' })
  confirmPassword!: string;

  @ApiPropertyOptional({
    default: true,
    description:
      'Email the user that the password was reset (the password itself is never emailed). SMS needs an SMS provider (not available yet).',
  })
  @IsBoolean()
  @IsOptional()
  notifyByEmail?: boolean;

  @ApiPropertyOptional({
    default: false,
    description:
      '"Reset password on next login": the user must choose a new password at the next sign-in',
  })
  @IsBoolean()
  @IsOptional()
  requireChangeOnNextLogin?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  signOutAllSessions?: boolean;
}

export class ForcePasswordResetDto {
  @ApiPropertyOptional({
    default: true,
    description: 'Also sign the user out everywhere',
  })
  @IsBoolean()
  @IsOptional()
  signOutAllSessions?: boolean;
}

export class AdminReasonDto {
  @ApiPropertyOptional({ maxLength: 500 })
  @MaxLength(500)
  @Transform(trimOrUndefined)
  @IsString()
  @IsOptional()
  reason?: string;
}

export class AdminUserGroupDto {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'GRP-DEV' }) groupId!: string;
  @ApiProperty({ example: 'Development' }) groupName!: string;
}

export class AdminUserDetailsDto extends AdminUserResponseDto {
  @ApiProperty({ example: 2 }) activeSessionCount!: number;
  @ApiProperty({ type: [AdminUserGroupDto] }) groups!: AdminUserGroupDto[];
  @ApiProperty({
    type: [String],
    description: 'Effective permission keys (through groups → roles)',
  })
  permissionKeys!: string[];
  @ApiProperty({
    example: false,
    description:
      'Sign-in locked after failed attempts: the whole account, or one or more IP addresses (lockedIpCount)',
  })
  isLocked!: boolean;
  @ApiProperty({ type: Date, nullable: true }) lockedUntil!: Date | null;
  @ApiProperty({
    example: 1,
    description:
      'IP addresses currently locked out of this account (others can still sign in)',
  })
  lockedIpCount!: number;
  @ApiProperty({
    type: Object,
    description:
      'Custom variable values (incl. internal ones; never passwords)',
  })
  attributes!: Record<string, unknown>;
  @ApiProperty({ type: [String] }) missingRequired!: string[];
  @ApiProperty({
    type: Date,
    nullable: true,
    description:
      '"Last activity on": latest sign-in, session use or account activity',
  })
  lastActivityAt!: Date | null;
}

export class AdminSessionDto {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'Chrome 131 on Windows 10' }) deviceName!: string;
  @ApiProperty({ type: String, nullable: true }) ipAddress!: string | null;
  @ApiProperty() signedInAt!: Date;
  @ApiProperty({ type: Date, nullable: true }) lastUsedAt!: Date | null;
  @ApiProperty() expiresAt!: Date;
}

export class CountResultDto {
  @ApiProperty({ example: 2 }) count!: number;
}

export class PasswordResetSentDto {
  @ApiProperty({ example: 'sam.lee@example.com' }) sentTo!: string;
  @ApiProperty({ example: 15 }) expiresInMinutes!: number;
}

export class PurgeRunDto {
  @ApiProperty({
    example: false,
    description: 'true: another instance is purging right now',
  })
  isLocked!: boolean;
  @ApiProperty({ type: [String] }) purgedUserIds!: string[];
}
