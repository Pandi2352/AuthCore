import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { UserResponseDto } from '@modules/users/dto/user-response.dto';

export class LoginResponseDto {
  @ApiProperty({ type: UserResponseDto })
  user!: UserResponseDto;

  @ApiProperty({
    example: false,
    description:
      'Signed in from a device (browser + OS) not seen before; the user was emailed (if loginAlerts is on)',
  })
  isNewDevice!: boolean;

  @ApiProperty({
    description: 'JWT access token. Send as `Authorization: Bearer <token>`.',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken!: string;

  @ApiProperty({ example: 'Bearer', enum: ['Bearer'] })
  tokenType!: 'Bearer';

  @ApiProperty({
    example: 900,
    description: 'Access token lifetime in seconds',
  })
  expiresIn!: number;

  @ApiProperty({
    type: Date,
    nullable: true,
    example: null,
    description:
      'When the password expires (null when the policy has no password validity)',
  })
  passwordExpiresAt!: Date | null;

  @ApiProperty({
    example: false,
    description:
      'true: the password has expired and must be changed. Until then only ' +
      'PATCH /auth/change-password, GET /auth/me and logout work (403 AUTH_PASSWORD_EXPIRED).',
  })
  isPasswordChangeRequired!: boolean;

  @ApiPropertyOptional({
    description:
      'Only when REFRESH_TOKEN_DELIVERY is `body` or `both` (mobile apps). ' +
      'With `cookie` (default) it is set as an HttpOnly cookie instead and never appears in JSON.',
    example: 'q7Cw0p0Gk1H8mK3x9V2bLZsYtR4uE6aN1oFjD5cWhPg',
  })
  refreshToken?: string;

  @ApiPropertyOptional({
    description:
      'When the refresh token / session expires (body delivery only).',
    example: '2026-11-23T10:00:00.000Z',
  })
  refreshTokenExpiresAt?: Date;
}
