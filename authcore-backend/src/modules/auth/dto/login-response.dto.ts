import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { UserResponseDto } from '@modules/users/dto/user-response.dto';

export class LoginResponseDto {
  @ApiProperty({ type: UserResponseDto })
  user!: UserResponseDto;

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
