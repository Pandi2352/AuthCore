import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';

/**
 * Browsers send no body: the refresh token comes from the HttpOnly cookie.
 * Mobile apps (REFRESH_TOKEN_DELIVERY=body or both) send it here.
 */
export class RefreshTokenDto {
  @ApiPropertyOptional({
    description:
      'Refresh token from the sign-in / previous refresh response. Only for body delivery (mobile apps); browsers use the cookie.',
    example: 'q7Cw0p0Gk1H8mK3x9V2bLZsYtR4uE6aN1oFjD5cWhPg',
  })
  @IsOptional()
  @Matches(/^[A-Za-z0-9_-]{43}$/, { message: 'refreshToken is not valid' })
  @IsString()
  refreshToken?: string;
}
