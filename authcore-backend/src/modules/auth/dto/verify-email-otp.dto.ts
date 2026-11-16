import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDefined,
  IsEmail,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

import { trim, trimLower } from '@common/utils/transform.util';

export class VerifyEmailOtpDto {
  @ApiProperty({ example: 'jane.doe@example.com' })
  @Transform(trimLower)
  @IsEmail()
  @MaxLength(254)
  @IsString()
  @IsDefined({ message: 'email is required' })
  email!: string;

  @ApiProperty({ example: '042917', description: 'The code from the email' })
  @Transform(trim)
  @Matches(/^\d{6,8}$/, { message: 'code must be 6–8 digits' })
  @IsString()
  @IsDefined({ message: 'code is required' })
  code!: string;
}
