import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class LogoutAllDto {
  @ApiPropertyOptional({
    description:
      'true = sign out all OTHER devices and stay signed in here. ' +
      'false (default) = sign out everywhere, including this device.',
    default: false,
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  keepCurrentSession?: boolean;
}
