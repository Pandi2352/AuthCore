import {
  Body,
  Controller,
  Header,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';

import { API_TAGS } from '@common/constants/api-tags.constants';
import {
  ApiErrorResponses,
  ApiStandardErrors,
  ApiWrappedResponse,
} from '@common/decorators/api-response.decorator';
import { ClientInfoParam } from '@common/decorators/client-info.decorator';
import { ResponseMessage } from '@common/decorators/response-message.decorator';
import type { ClientInfo } from '@common/interfaces/client-info.interface';

import { AuthService } from './auth.service';
import {
  LOGIN_THROTTLE,
  REFRESH_THROTTLE,
  REGISTER_THROTTLE,
  RESEND_VERIFICATION_THROTTLE,
  VERIFY_EMAIL_THROTTLE,
} from './constants/auth.constants';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { RegisterResponseDto } from './dto/register-response.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { VerifyEmailLinkDto } from './dto/verify-email-link.dto';
import { VerifyEmailOtpDto } from './dto/verify-email-otp.dto';
import { VerifyEmailResponseDto } from './dto/verify-email-response.dto';
import { RegistrationService } from './registration.service';
import { RefreshTokenCookieService } from './services/refresh-token-cookie.service';

@ApiTags(API_TAGS.Auth.name)
@ApiStandardErrors()
@Controller('auth')
export class AuthController {
  constructor(
    private readonly registrationService: RegistrationService,
    private readonly authService: AuthService,
    private readonly refreshTokenCookieService: RefreshTokenCookieService,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: REGISTER_THROTTLE })
  @Header('Cache-Control', 'no-store')
  @ResponseMessage('Registration successful')
  @ApiOperation({
    summary: 'Register a new account',
    description:
      'The flow depends on configuration: `nextStep` tells the client what to do next ' +
      '(VERIFY_EMAIL_OTP, VERIFY_EMAIL_LINK, AWAIT_APPROVAL or LOGIN). ' +
      `Rate limited to ${REGISTER_THROTTLE.limit} requests per minute per IP.`,
  })
  @ApiWrappedResponse(RegisterResponseDto, {
    status: HttpStatus.CREATED,
    description: 'Account created',
  })
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, HttpStatus.CONFLICT)
  register(@Body() dto: RegisterDto): Promise<RegisterResponseDto> {
    return this.registrationService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: LOGIN_THROTTLE })
  @Header('Cache-Control', 'no-store')
  @ResponseMessage('Login successful')
  @ApiOperation({
    summary: 'Sign in with email or username and password',
    description:
      'Send `email` or `username` (allowed identifiers: LOGIN_IDENTIFIERS) plus `password`. ' +
      'Returns a short-lived JWT access token. The refresh token is set as an HttpOnly, Secure, ' +
      'SameSite cookie (`authcore_refresh`, path /api/v1/auth) or returned in the body, per ' +
      'REFRESH_TOKEN_DELIVERY. `rememberMe` makes the session and cookie long-lived.\n\n' +
      'Errors: 401 AUTH_INVALID_CREDENTIALS (wrong password or unknown account: same response); ' +
      '403 AUTH_EMAIL_NOT_VERIFIED / AUTH_ACCOUNT_PENDING_APPROVAL / AUTH_ACCOUNT_SUSPENDED / ' +
      'AUTH_ACCOUNT_INACTIVE / AUTH_ACCOUNT_DISABLED (only after a correct password); ' +
      '429 AUTH_TOO_MANY_FAILED_ATTEMPTS (temporary lock, see Retry-After) or TOO_MANY_REQUESTS ' +
      `(more than ${LOGIN_THROTTLE.limit} requests per minute per IP).`,
  })
  @ApiWrappedResponse(LoginResponseDto, { description: 'Signed in' })
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.FORBIDDEN,
  )
  async login(
    @Body() dto: LoginDto,
    @ClientInfoParam() client: ClientInfo,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponseDto> {
    const { body, session } = await this.authService.login(dto, client);
    this.refreshTokenCookieService.set(response, session);
    return body;
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: REFRESH_THROTTLE })
  @Header('Cache-Control', 'no-store')
  @ResponseMessage('Session refreshed')
  @ApiOperation({
    summary: 'Get a new access token with the refresh token',
    description:
      'Browsers: send no body; the HttpOnly `authcore_refresh` cookie is used, and the request ' +
      'must come from an allowed origin (`Origin` header in CORS_ORIGIN; CSRF protection). ' +
      'Mobile apps (REFRESH_TOKEN_DELIVERY=body / both): send `{ "refreshToken": "..." }`.\n\n' +
      'Every refresh **rotates** the refresh token: a new cookie is set (or a new `refreshToken` ' +
      'returned) and the old token stops working. The session expiry is not extended.\n\n' +
      'Parallel refreshes (several tabs) within REFRESH_TOKEN_REUSE_GRACE_SECONDS get a new access ' +
      'token without rotation. Presenting an older, already-rotated token is treated as theft: the ' +
      'whole session is signed out (401 AUTH_REFRESH_TOKEN_REUSED). Mobile clients must not refresh ' +
      'in parallel.\n\n' +
      'Errors: 401 AUTH_INVALID_REFRESH_TOKEN (missing / expired / revoked) or ' +
      'AUTH_REFRESH_TOKEN_REUSED; 403 AUTH_INVALID_ORIGIN, or an account code ' +
      '(AUTH_ACCOUNT_SUSPENDED, ...) when the account can no longer sign in (session revoked). ' +
      'The cookie is cleared on these errors.',
  })
  @ApiWrappedResponse(LoginResponseDto, { description: 'New access token' })
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN)
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Req() request: Request,
    @ClientInfoParam() client: ClientInfo,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponseDto> {
    const token = this.refreshTokenCookieService.extract(
      request,
      dto.refreshToken,
    );
    const { body, rotation } = await this.authService
      .refresh(token, client)
      .catch((error: unknown) =>
        this.refreshTokenCookieService.clearIfRejected(response, error),
      );
    this.refreshTokenCookieService.apply(response, rotation);
    return body;
  }

  @Post('verify-email/otp')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: VERIFY_EMAIL_THROTTLE })
  @Header('Cache-Control', 'no-store')
  @ResponseMessage('Email verified')
  @ApiOperation({
    summary: 'Verify email with the emailed code',
    description:
      'Available when REGISTRATION_EMAIL_VERIFICATION=otp. A code works once; after too many ' +
      'wrong codes a new one must be requested.',
  })
  @ApiWrappedResponse(VerifyEmailResponseDto)
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND)
  verifyEmailOtp(
    @Body() dto: VerifyEmailOtpDto,
  ): Promise<VerifyEmailResponseDto> {
    return this.registrationService.verifyEmailOtp(dto.email, dto.code);
  }

  @Post('verify-email/link')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: VERIFY_EMAIL_THROTTLE })
  @Header('Cache-Control', 'no-store')
  @ResponseMessage('Email verified')
  @ApiOperation({
    summary: 'Verify email with the token from the emailed link',
    description:
      'Available when REGISTRATION_EMAIL_VERIFICATION=link. The frontend page from ' +
      'EMAIL_VERIFICATION_URL reads `token` from its URL and posts it here. A link works once.',
  })
  @ApiWrappedResponse(VerifyEmailResponseDto)
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND)
  verifyEmailLink(
    @Body() dto: VerifyEmailLinkDto,
  ): Promise<VerifyEmailResponseDto> {
    return this.registrationService.verifyEmailLink(dto.token);
  }

  @Post('verify-email/resend')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: RESEND_VERIFICATION_THROTTLE })
  @Header('Cache-Control', 'no-store')
  @ResponseMessage(
    'If the account exists and still needs verification, a new email has been sent',
  )
  @ApiOperation({
    summary: 'Send a new verification code / link',
    description:
      'Always returns the same response, whether or not the email is registered. ' +
      'A new email is sent at most once per cooldown period and replaces the previous code / link.',
  })
  @ApiWrappedResponse()
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND)
  async resendVerification(@Body() dto: ResendVerificationDto): Promise<null> {
    await this.registrationService.resendVerification(dto.email);
    return null;
  }
}
