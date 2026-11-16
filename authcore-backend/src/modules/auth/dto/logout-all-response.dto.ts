import { ApiProperty } from '@nestjs/swagger';

export class LogoutAllResponseDto {
  @ApiProperty({
    example: 3,
    description: 'Number of sessions (devices) that were signed out',
  })
  revokedSessionCount!: number;

  @ApiProperty({
    example: false,
    description: 'Whether the current device is still signed in',
  })
  isCurrentSessionKept!: boolean;
}
