import { ApiProperty } from '@nestjs/swagger';

export class KnownDeviceDto {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'Chrome 131 on Windows 10' }) deviceName!: string;
  @ApiProperty({ example: 'desktop' }) deviceType!: string;
  @ApiProperty({ type: String, nullable: true, example: 'Chrome 131' })
  browser!: string | null;
  @ApiProperty({ type: String, nullable: true, example: 'Windows 10' })
  os!: string | null;
  @ApiProperty({ example: '143.110.245.176' }) firstIpAddress!: string;
  @ApiProperty({ example: '143.110.245.176' }) lastIpAddress!: string;
  @ApiProperty({ description: 'First sign-in from this device' })
  firstSeenAt!: Date;
  @ApiProperty() lastSeenAt!: Date;
  @ApiProperty({ example: 12 }) signInCount!: number;
}

export class ForgetDeviceResultDto {
  @ApiProperty() id!: string;
}
