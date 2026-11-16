import {
  Controller,
  Delete,
  Get,
  Header,
  HttpStatus,
  Param,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';

import { API_TAGS } from '@common/constants/api-tags.constants';
import {
  ApiErrorResponses,
  ApiStandardErrors,
  ApiWrappedResponse,
} from '@common/decorators/api-response.decorator';
import { ClientInfoParam } from '@common/decorators/client-info.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { ResponseMessage } from '@common/decorators/response-message.decorator';
import type { AuthContext } from '@common/interfaces/auth-context.interface';
import type { ClientInfo } from '@common/interfaces/client-info.interface';
import { ParseIdPipe } from '@common/pipes/parse-id.pipe';

import {
  RevokeSessionResponseDto,
  SessionResponseDto,
} from './dto/session-response.dto';
import { RefreshTokenCookieService } from './services/refresh-token-cookie.service';
import { SessionManagementService } from './services/session-management.service';

/** The signed-in user's own devices. All routes require an access token. */
@ApiTags(API_TAGS.Sessions.name)
@ApiBearerAuth('access-token')
@ApiStandardErrors()
@Controller('auth/sessions')
export class SessionManagementController {
  constructor(
    private readonly sessionManagementService: SessionManagementService,
    private readonly refreshTokenCookieService: RefreshTokenCookieService,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @ResponseMessage('Active sessions')
  @ApiOperation({
    summary: 'List my active sessions (signed-in devices)',
    description:
      'Most recently used first. `isCurrent` marks the device making the request. ' +
      'Bounded by MAX_SESSIONS_PER_USER, so the list is not paginated.',
  })
  @ApiWrappedResponse(SessionResponseDto, { isArray: true })
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED)
  list(@CurrentUser() auth: AuthContext): Promise<SessionResponseDto[]> {
    return this.sessionManagementService.list(auth);
  }

  @Get(':sessionId')
  @Header('Cache-Control', 'no-store')
  @ResponseMessage('Session details')
  @ApiOperation({
    summary: 'Get one of my sessions',
    description:
      '404 if the session does not exist, belongs to someone else, or is no longer active.',
  })
  @ApiWrappedResponse(SessionResponseDto)
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.NOT_FOUND,
  )
  get(
    @CurrentUser() auth: AuthContext,
    @Param('sessionId', ParseIdPipe) sessionId: string,
  ): Promise<SessionResponseDto> {
    return this.sessionManagementService.get(auth, sessionId);
  }

  @Delete(':sessionId')
  @Header('Cache-Control', 'no-store')
  @ResponseMessage('Session signed out')
  @ApiOperation({
    summary: 'Sign out one of my devices',
    description:
      'Revokes the session: its access and refresh tokens stop working immediately. ' +
      'Revoking the current session is the same as logout (the refresh cookie is cleared). ' +
      '404 if the session does not exist, belongs to someone else, or is no longer active.',
  })
  @ApiWrappedResponse(RevokeSessionResponseDto)
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.NOT_FOUND,
  )
  async revoke(
    @CurrentUser() auth: AuthContext,
    @Param('sessionId', ParseIdPipe) sessionId: string,
    @ClientInfoParam() client: ClientInfo,
    @Res({ passthrough: true }) response: Response,
  ): Promise<RevokeSessionResponseDto> {
    const result = await this.sessionManagementService.revoke(
      auth,
      sessionId,
      client,
    );
    if (result.isCurrentSession) {
      this.refreshTokenCookieService.clear(response);
    }
    return result;
  }
}
