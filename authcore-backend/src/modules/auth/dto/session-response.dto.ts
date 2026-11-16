import { ApiProperty } from '@nestjs/swagger';

/** One signed-in device, as shown to its owner. No tokens or internal ids. */
export class SessionResponseDto {
  @ApiProperty({ example: '01a1dfa2-d2dc-7243-a59a-9d952a73f534' })
  id!: string;

  @ApiProperty({ example: 'Chrome 131 on Windows 10' })
  deviceName!: string;

  @ApiProperty({
    example: 'desktop',
    description: 'desktop, mobile, tablet, tv, bot or unknown',
  })
  deviceType!: string;

  @ApiProperty({ type: String, nullable: true, example: 'Chrome 131' })
  browser!: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'Windows 10' })
  os!: string | null;

  @ApiProperty({ example: '203.0.113.10', description: 'IP at sign-in' })
  ipAddress!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: '203.0.113.24',
    description: 'IP of the most recent token refresh',
  })
  lastIpAddress!: string | null;

  @ApiProperty({ example: '2026-11-16T09:00:00.000Z' })
  signedInAt!: Date;

  @ApiProperty({ example: '2026-11-16T10:45:00.000Z' })
  lastUsedAt!: Date;

  @ApiProperty({
    example: '2026-11-23T09:00:00.000Z',
    description: 'The session ends at this time at the latest',
  })
  expiresAt!: Date;

  @ApiProperty({ example: false, description: '"Remember me" session' })
  isPersistent!: boolean;

  @ApiProperty({
    example: true,
    description: 'This is the device making the request',
  })
  isCurrent!: boolean;
}

export class RevokeSessionResponseDto {
  @ApiProperty({ example: '01a1dfa2-d2dc-7243-a59a-9d952a73f534' })
  revokedSessionId!: string;

  @ApiProperty({
    example: false,
    description: 'true if this device signed itself out (same as logout)',
  })
  isCurrentSession!: boolean;
}
