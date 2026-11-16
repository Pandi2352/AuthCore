import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsDefined, IsString, Matches } from 'class-validator';

import { trim } from '@common/utils/transform.util';

export class VerifyEmailLinkDto {
  @ApiProperty({
    example: 'q7Cw0p0Gk1H8mK3x9V2bLZsYtR4uE6aN1oFjD5cWhPg',
    description: 'The `token` query parameter from the verification link',
  })
  @Transform(trim)
  @Matches(/^[A-Za-z0-9_-]{43}$/, { message: 'token is not valid' })
  @IsString()
  @IsDefined({ message: 'token is required' })
  token!: string;
}
