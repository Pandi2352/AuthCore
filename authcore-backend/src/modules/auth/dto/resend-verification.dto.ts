import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsDefined, IsEmail, IsString, MaxLength } from 'class-validator';

import { trimLower } from '@common/utils/transform.util';

export class ResendVerificationDto {
  @ApiProperty({ example: 'jane.doe@example.com' })
  @Transform(trimLower)
  @IsEmail()
  @MaxLength(254)
  @IsString()
  @IsDefined({ message: 'email is required' })
  email!: string;
}
