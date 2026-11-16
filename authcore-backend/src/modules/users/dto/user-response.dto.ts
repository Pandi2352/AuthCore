import { ApiProperty } from '@nestjs/swagger';

import { UserRole } from '../enums/user-role.enum';
import { UserSource } from '../enums/user-source.enum';
import { UserStatus } from '../enums/user-status.enum';

export class NotificationPreferencesDto {
  @ApiProperty({
    example: false,
    description: 'Product news and announcements',
  })
  productUpdates!: boolean;

  @ApiProperty({ example: true, description: '"New sign-in" alerts' })
  loginAlerts!: boolean;
}

export class UserPreferencesDto {
  @ApiProperty({ example: 'en', description: 'BCP 47 language tag' })
  language!: string;

  @ApiProperty({ example: 'Asia/Kolkata', description: 'IANA time zone' })
  timezone!: string;

  @ApiProperty({ type: NotificationPreferencesDto })
  notifications!: NotificationPreferencesDto;
}

/** Public view of a user. Never contains the password hash or internal fields. */
export class UserResponseDto {
  @ApiProperty({ example: '01a1df95-4816-7727-bab3-ca48f2d57e54' })
  id!: string;

  @ApiProperty({ example: 'jane.doe@example.com' })
  email!: string;

  @ApiProperty({ type: String, nullable: true, example: 'janedoe' })
  username!: string | null;

  @ApiProperty({ example: 'Jane' })
  firstName!: string;

  @ApiProperty({ type: String, nullable: true, example: 'Doe' })
  lastName!: string | null;

  @ApiProperty({
    enum: UserStatus,
    enumName: 'UserStatus',
    example: UserStatus.PendingVerification,
  })
  status!: UserStatus;

  @ApiProperty({ enum: UserRole, enumName: 'UserRole', example: UserRole.User })
  role!: UserRole;

  @ApiProperty({ example: false })
  isEmailVerified!: boolean;

  @ApiProperty({ type: Date, nullable: true, example: null })
  emailVerifiedAt!: Date | null;

  @ApiProperty({
    example: '2026-11-15T10:00:00.000Z',
    description:
      'When the password was last set (password expiry is counted from here)',
  })
  passwordChangedAt!: Date;

  @ApiProperty({
    example: false,
    description: 'An admin requires a password change at the next sign-in',
  })
  mustChangePassword!: boolean;

  @ApiProperty({ type: UserPreferencesDto })
  preferences!: UserPreferencesDto;

  @ApiProperty({
    enum: UserSource,
    enumName: 'UserSource',
    example: UserSource.Registration,
  })
  source!: UserSource;

  @ApiProperty({
    type: Date,
    nullable: true,
    example: null,
    description:
      'Set when the user asked to delete the account (purged after this date unless recovered)',
  })
  deletionScheduledAt!: Date | null;

  @ApiProperty({
    type: Date,
    nullable: true,
    example: '2026-11-15T10:00:00.000Z',
  })
  lastLoginAt!: Date | null;

  @ApiProperty({ example: '2026-11-15T10:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-11-15T10:00:00.000Z' })
  updatedAt!: Date;
}

/** What admins see in addition: status history and soft-delete info. */
export class AdminUserResponseDto extends UserResponseDto {
  @ApiProperty({
    type: String,
    nullable: true,
    example: 'Repeated policy violations',
  })
  statusReason!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Admin id, the user\'s own id (self-deactivation) or "system"',
  })
  statusChangedBy!: string | null;

  @ApiProperty({ type: Date, nullable: true })
  statusChangedAt!: Date | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Admin / inviter who created the account',
  })
  createdBy!: string | null;

  @ApiProperty({
    type: Date,
    nullable: true,
    description: 'Soft-deleted by an admin (restorable)',
  })
  deletedAt!: Date | null;

  @ApiProperty({ type: String, nullable: true })
  deletedBy!: string | null;
}
