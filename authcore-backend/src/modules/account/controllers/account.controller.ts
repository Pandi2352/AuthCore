import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';

import { API_TAGS } from '@common/constants/api-tags.constants';
import {
  ApiErrorResponses,
  ApiPaginatedResponse,
  ApiStandardErrors,
  ApiWrappedResponse,
} from '@common/decorators/api-response.decorator';
import { ClientInfoParam } from '@common/decorators/client-info.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { ResponseMessage } from '@common/decorators/response-message.decorator';
import type { Paginated } from '@common/interfaces/api-response.interface';
import type { AuthContext } from '@common/interfaces/auth-context.interface';
import type { ClientInfo } from '@common/interfaces/client-info.interface';
import { RefreshTokenCookieService } from '@modules/auth/services/refresh-token-cookie.service';
import {
  ActivityQueryDto,
  UserActivityDto,
} from '@modules/user-activity/dto/user-activity.dto';
import { UserActivityService } from '@modules/user-activity/user-activity.service';
import {
  ProfileQueryDto,
  UpdateAttributesDto,
} from '@modules/user-schema/dto/user-attribute.dto';
import { UserResponseDto } from '@modules/users/dto/user-response.dto';

import {
  ChangeEmailDto,
  CloseAccountDto,
  DeletionScheduledDto,
  EmailChangeStartedDto,
  EmailCodeDto,
  ProfileResponseDto,
  UpdatePreferencesDto,
  UpdateProfileDto,
} from '../dto/account.dto';
import { AccountService } from '../services/account.service';

const SENSITIVE_THROTTLE = { limit: 5, ttl: 60_000 } as const;
const AUTH_ERRORS = [HttpStatus.BAD_REQUEST, HttpStatus.UNAUTHORIZED] as const;

/** The signed-in user's own account. */
@ApiTags(API_TAGS.Account.name)
@ApiBearerAuth('access-token')
@ApiStandardErrors()
@Controller('users/me')
export class AccountController {
  constructor(
    private readonly accountService: AccountService,
    private readonly refreshTokenCookieService: RefreshTokenCookieService,
    private readonly activityService: UserActivityService,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @ResponseMessage('My profile')
  @ApiOperation({
    summary: 'My profile',
    description:
      'Profile, status, preferences and custom variable values (`include` adds returned=REQUEST ones), plus missingRequired.',
  })
  @ApiWrappedResponse(ProfileResponseDto)
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED)
  getProfile(
    @CurrentUser() auth: AuthContext,
    @Query() query: ProfileQueryDto,
  ): Promise<ProfileResponseDto> {
    return this.accountService.getProfile(auth, splitList(query.include));
  }

  @Patch('attributes')
  @Header('Cache-Control', 'no-store')
  @ResponseMessage('Personal details updated')
  @ApiOperation({
    summary: 'Update my personal details (custom variables)',
    description:
      '{ attributes: { name: value } } validated against the user schema (GET /user-schema/form): types, options, ' +
      'limits, required, unique, read-only / immutable, internal. given_name / family_name / preferred_username map to ' +
      'the built-in fields; email and password have their own endpoints. Groups (address) merge; null clears.',
  })
  @ApiWrappedResponse(ProfileResponseDto)
  @ApiErrorResponses(...AUTH_ERRORS, HttpStatus.CONFLICT)
  updateAttributes(
    @CurrentUser() auth: AuthContext,
    @Body() dto: UpdateAttributesDto,
    @ClientInfoParam() client: ClientInfo,
  ): Promise<ProfileResponseDto> {
    return this.accountService.updateAttributes(auth, dto.attributes, client);
  }

  @Get('activity')
  @Header('Cache-Control', 'no-store')
  @ResponseMessage('My recent activity')
  @ApiOperation({
    summary: 'My recent activity',
    description:
      'Sign-ins (incl. failed ones), logouts, password / email changes on my account, with device, browser and IP. Newest first.',
  })
  @ApiPaginatedResponse(UserActivityDto)
  @ApiErrorResponses(...AUTH_ERRORS)
  activity(
    @CurrentUser() auth: AuthContext,
    @Query() query: ActivityQueryDto,
  ): Promise<Paginated<UserActivityDto>> {
    return this.activityService.list(auth.userId, query);
  }

  @Patch()
  @Header('Cache-Control', 'no-store')
  @ResponseMessage('Profile updated')
  @ApiOperation({
    summary: 'Update my profile',
    description:
      'firstName, lastName, username (same rules as registration; null removes lastName / username). 409 if the username is taken.',
  })
  @ApiWrappedResponse(UserResponseDto)
  @ApiErrorResponses(...AUTH_ERRORS, HttpStatus.CONFLICT)
  updateProfile(
    @CurrentUser() auth: AuthContext,
    @Body() dto: UpdateProfileDto,
  ): Promise<UserResponseDto> {
    return this.accountService.updateProfile(auth, dto);
  }

  @Patch('preferences')
  @Header('Cache-Control', 'no-store')
  @ResponseMessage('Preferences updated')
  @ApiOperation({
    summary: 'Update my preferences',
    description:
      'language, timezone (IANA), notifications.productUpdates / loginAlerts. Send only what changes.',
  })
  @ApiWrappedResponse(UserResponseDto)
  @ApiErrorResponses(...AUTH_ERRORS)
  updatePreferences(
    @CurrentUser() auth: AuthContext,
    @Body() dto: UpdatePreferencesDto,
  ): Promise<UserResponseDto> {
    return this.accountService.updatePreferences(auth, dto);
  }

  @Post('email/change')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: SENSITIVE_THROTTLE })
  @Header('Cache-Control', 'no-store')
  @ResponseMessage('Confirmation code sent to the new email address')
  @ApiOperation({
    summary: 'Change my email: step 1',
    description:
      'Needs the current password (wrong ones count toward the sign-in lockout). Sends a 6-digit code to the NEW ' +
      'address; nothing changes until it is confirmed. 409 ACCOUNT_EMAIL_IN_USE; 429 within the resend cooldown.',
  })
  @ApiWrappedResponse(EmailChangeStartedDto)
  @ApiErrorResponses(
    ...AUTH_ERRORS,
    HttpStatus.CONFLICT,
    HttpStatus.TOO_MANY_REQUESTS,
  )
  requestEmailChange(
    @CurrentUser() auth: AuthContext,
    @Body() dto: ChangeEmailDto,
    @ClientInfoParam() client: ClientInfo,
  ): Promise<EmailChangeStartedDto> {
    return this.accountService.requestEmailChange(auth, dto, client);
  }

  @Post('email/confirm')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Header('Cache-Control', 'no-store')
  @ResponseMessage('Email address changed')
  @ApiOperation({
    summary: 'Change my email: step 2',
    description:
      'The code from the new address switches the sign-in email (verified); the old address gets a notice. 5 wrong codes cancel the request.',
  })
  @ApiWrappedResponse(UserResponseDto)
  @ApiErrorResponses(...AUTH_ERRORS, HttpStatus.CONFLICT)
  confirmEmailChange(
    @CurrentUser() auth: AuthContext,
    @Body() dto: EmailCodeDto,
    @ClientInfoParam() client: ClientInfo,
  ): Promise<UserResponseDto> {
    return this.accountService.confirmEmailChange(auth, dto.code, client);
  }

  @Post('deactivate')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: SENSITIVE_THROTTLE })
  @Header('Cache-Control', 'no-store')
  @ResponseMessage('Account deactivated')
  @ApiOperation({
    summary: 'Deactivate my account',
    description:
      'Needs the current password. Status INACTIVE, all devices signed out, confirmation email. Reactivate with ' +
      'POST /account/recovery/request. The last ADMIN cannot deactivate themselves (409).',
  })
  @ApiWrappedResponse()
  @ApiErrorResponses(...AUTH_ERRORS, HttpStatus.CONFLICT)
  async deactivate(
    @CurrentUser() auth: AuthContext,
    @Body() dto: CloseAccountDto,
    @ClientInfoParam() client: ClientInfo,
    @Res({ passthrough: true }) response: Response,
  ): Promise<null> {
    await this.accountService.deactivate(auth, dto, client);
    this.refreshTokenCookieService.clear(response);
    return null;
  }

  @Delete()
  @Throttle({ default: SENSITIVE_THROTTLE })
  @Header('Cache-Control', 'no-store')
  @ResponseMessage('Account deletion scheduled')
  @ApiOperation({
    summary: 'Delete my account',
    description:
      'Needs the current password (JSON body). The account is deactivated now and permanently deleted with its ' +
      'data after ACCOUNT_DELETION_GRACE_DAYS (default 14) unless recovered with account recovery. All devices ' +
      'signed out; confirmation email.',
  })
  @ApiWrappedResponse(DeletionScheduledDto)
  @ApiErrorResponses(...AUTH_ERRORS, HttpStatus.CONFLICT)
  async requestDeletion(
    @CurrentUser() auth: AuthContext,
    @Body() dto: CloseAccountDto,
    @ClientInfoParam() client: ClientInfo,
    @Res({ passthrough: true }) response: Response,
  ): Promise<DeletionScheduledDto> {
    const result = await this.accountService.requestDeletion(auth, dto, client);
    this.refreshTokenCookieService.clear(response);
    return result;
  }
}

function splitList(value: string | undefined): string[] {
  return value
    ? value
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean)
    : [];
}
