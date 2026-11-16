import { ApiProperty } from '@nestjs/swagger';

import { RegistrationNextStep } from '../enums/registration-next-step.enum';

export class VerifyEmailResponseDto {
  @ApiProperty({
    enum: RegistrationNextStep,
    enumName: 'RegistrationNextStep',
    example: RegistrationNextStep.Login,
    description: 'LOGIN, or AWAIT_APPROVAL when an administrator must approve.',
  })
  nextStep!: RegistrationNextStep;
}
