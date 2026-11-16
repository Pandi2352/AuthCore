import { ApiProperty } from '@nestjs/swagger';

import { UserResponseDto } from '@modules/users/dto/user-response.dto';

import { RegistrationNextStep } from '../enums/registration-next-step.enum';

export class RegisterResponseDto {
  @ApiProperty({ type: UserResponseDto })
  user!: UserResponseDto;

  @ApiProperty({
    enum: RegistrationNextStep,
    enumName: 'RegistrationNextStep',
    example: RegistrationNextStep.VerifyEmailOtp,
    description: 'What the client should do next.',
  })
  nextStep!: RegistrationNextStep;

  @ApiProperty({
    example: true,
    description:
      'False if a verification email was needed but could not be sent; the user can request a new one.',
  })
  isVerificationEmailSent!: boolean;
}
