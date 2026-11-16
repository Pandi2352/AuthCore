import {
  Body,
  Controller,
  Header,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { API_TAGS } from '@common/constants/api-tags.constants';
import { AllowExpiredPassword } from '@common/decorators/allow-expired-password.decorator';
import {
  ApiErrorResponses,
  ApiStandardErrors,
  ApiWrappedResponse,
} from '@common/decorators/api-response.decorator';
import { ClientInfoParam } from '@common/decorators/client-info.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { Public } from '@common/decorators/public.decorator';
import { ResponseMessage } from '@common/decorators/response-message.decorator';
import type { AuthContext } from '@common/interfaces/auth-context.interface';
import type { ClientInfo } from '@common/interfaces/client-info.interface';

import {
  CHANGE_PASSWORD_THROTTLE,
  FORGOT_PASSWORD_THROTTLE,
  RESET_PASSWORD_THROTTLE,
  VERIFY_RESET_THROTTLE,
} from './constants/auth.constants';
import {
  ChangePasswordDto,
  ChangePasswordResponseDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  VerifyResetTokenDto,
  VerifyResetTokenResponseDto,
} from './dto/password.dto';
import { PasswordManagementService } from './services/password-management.service';

export const FORGOT_PASSWORD_MESSAGE =
  'If an account exists for this email, a password reset email has been sent';

/** Forgot / reset password (public) and change password (signed in). */
@ApiTags(API_TAGS.Password.name)
@ApiStandardErrors()
@Controller('auth')
export class PasswordController {
  constructor(
    private readonly passwordManagementService: PasswordManagementService,
  ) {}

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: FORGOT_PASSWORD_THROTTLE })
  @Header('Cache-Control', 'no-store')
  @ResponseMessage(FORGOT_PASSWORD_MESSAGE)
  @ApiOperation({
    summary: 'Request a password reset email',
    description:
      'Emails a reset code (PASSWORD_RESET_METHOD=otp) or reset link (link). The response is ' +
      'identical whether or not the email is registered, and the email is sent in the background, ' +
      'so neither the response nor its timing reveals which emails have accounts.\n\n' +
      'Suspended, banned, rejected and deactivated accounts get no email. A new request replaces ' +
      'the previous code / link; within PASSWORD_RESET_RESEND_COOLDOWN_SECONDS no new email is sent.',
  })
  @ApiWrappedResponse()
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, HttpStatus.TOO_MANY_REQUESTS)
  forgotPassword(
    @Body() dto: ForgotPasswordDto,
    @ClientInfoParam() client: ClientInfo,
  ): null {
    this.passwordManagementService.forgotPassword(dto.email, client);
    return null;
  }

  @Public()
  @Post('verify-reset-token')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: VERIFY_RESET_THROTTLE })
  @Header('Cache-Control', 'no-store')
  @ResponseMessage('Reset code verified')
  @ApiOperation({
    summary: 'Verify the reset code or link',
    description:
      'OTP method: `{ email, code }`. Link method: `{ token }` from the link. Returns a single-use ' +
      '`resetToken` for POST /auth/reset-password, valid PASSWORD_RESET_AUTH_TTL_MINUTES. The code ' +
      'stops working once verified.\n\nErrors: 400 AUTH_INVALID_RESET_CODE; 400 ' +
      'AUTH_RESET_ATTEMPTS_EXCEEDED after PASSWORD_RESET_MAX_ATTEMPTS wrong codes (request a new one).',
  })
  @ApiWrappedResponse(VerifyResetTokenResponseDto)
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.NOT_FOUND,
    HttpStatus.TOO_MANY_REQUESTS,
  )
  verifyResetToken(
    @Body() dto: VerifyResetTokenDto,
    @ClientInfoParam() client: ClientInfo,
  ): Promise<VerifyResetTokenResponseDto> {
    return this.passwordManagementService.verifyResetToken(dto, client);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: RESET_PASSWORD_THROTTLE })
  @Header('Cache-Control', 'no-store')
  @ResponseMessage('Password reset. Sign in with your new password.')
  @ApiOperation({
    summary: 'Set a new password with the reset token',
    description:
      'Sets the new password, signs out ALL sessions, clears any sign-in lockout and emails a ' +
      'confirmation. The resetToken works once. If the new password is rejected (strength, ' +
      'personal info, reuse) the token stays valid for another try.\n\nErrors: 400 ' +
      'AUTH_INVALID_RESET_TOKEN, 400 VALIDATION_ERROR, 400 AUTH_PASSWORD_REUSED.',
  })
  @ApiWrappedResponse()
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.FORBIDDEN,
    HttpStatus.TOO_MANY_REQUESTS,
  )
  async resetPassword(
    @Body() dto: ResetPasswordDto,
    @ClientInfoParam() client: ClientInfo,
  ): Promise<null> {
    await this.passwordManagementService.resetPassword(dto, client);
    return null;
  }

  @Patch('change-password')
  @AllowExpiredPassword()
  @Throttle({ default: CHANGE_PASSWORD_THROTTLE })
  @Header('Cache-Control', 'no-store')
  @ApiBearerAuth('access-token')
  @ResponseMessage('Password changed')
  @ApiOperation({
    summary: 'Change my password',
    description:
      'Requires `Authorization: Bearer <accessToken>`. This device stays signed in; all other ' +
      'devices are signed out. Wrong current passwords count toward the sign-in lockout.\n\n' +
      'Errors: 400 AUTH_INVALID_CURRENT_PASSWORD, 400 VALIDATION_ERROR, 400 AUTH_PASSWORD_REUSED, ' +
      '429 AUTH_TOO_MANY_FAILED_ATTEMPTS.',
  })
  @ApiWrappedResponse(ChangePasswordResponseDto)
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.TOO_MANY_REQUESTS,
  )
  changePassword(
    @CurrentUser() auth: AuthContext,
    @Body() dto: ChangePasswordDto,
    @ClientInfoParam() client: ClientInfo,
  ): Promise<ChangePasswordResponseDto> {
    return this.passwordManagementService.changePassword(auth, dto, client);
  }
}
