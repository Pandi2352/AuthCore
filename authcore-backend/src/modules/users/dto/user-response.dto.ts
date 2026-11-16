import { ApiProperty } from '@nestjs/swagger';

import { UserRole } from '../enums/user-role.enum';
import { UserStatus } from '../enums/user-status.enum';

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

  @ApiProperty({ example: '2026-11-15T10:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-11-15T10:00:00.000Z' })
  updatedAt!: Date;
}
