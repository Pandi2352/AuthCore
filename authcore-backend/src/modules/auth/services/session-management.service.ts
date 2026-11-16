import { HttpStatus, Injectable, Logger } from '@nestjs/common';

import { ErrorCode } from '@common/constants/error-codes.constants';
import { AppException } from '@common/exceptions/app.exception';
import type { AuthContext } from '@common/interfaces/auth-context.interface';
import type { ClientInfo } from '@common/interfaces/client-info.interface';
import type { Session } from '@modules/sessions/schemas/session.schema';
import { SessionsService } from '@modules/sessions/sessions.service';
import { ActivityEvent } from '@modules/user-activity/enums/user-activity.enum';
import { UserActivityService } from '@modules/user-activity/user-activity.service';

import {
  RevokeSessionResponseDto,
  SessionResponseDto,
} from '../dto/session-response.dto';

/**
 * "My devices": a user lists and signs out their own sessions. Another user's
 * session, or a revoked / expired one, is reported as not found (404), so
 * session ids can't be probed.
 */
@Injectable()
export class SessionManagementService {
  private readonly logger = new Logger(SessionManagementService.name);

  constructor(
    private readonly sessionsService: SessionsService,
    private readonly activityService: UserActivityService,
  ) {}

  async list(auth: AuthContext): Promise<SessionResponseDto[]> {
    const sessions = await this.sessionsService.listActiveForUser(auth.userId);
    return sessions.map((session) => toSessionResponse(session, auth));
  }

  async get(auth: AuthContext, sessionId: string): Promise<SessionResponseDto> {
    const session = await this.sessionsService.findActiveForUser(
      sessionId,
      auth.userId,
    );
    if (!session) {
      throw sessionNotFound();
    }
    return toSessionResponse(session, auth);
  }

  /**
   * Signs one of the user's devices out. Revoking the current session is the
   * same as logout (the controller then clears the refresh cookie).
   */
  async revoke(
    auth: AuthContext,
    sessionId: string,
    client: ClientInfo,
  ): Promise<RevokeSessionResponseDto> {
    const isCurrentSession = sessionId === auth.sessionId;
    const target = await this.sessionsService.findActiveForUser(
      sessionId,
      auth.userId,
    );
    const isRevoked = await this.sessionsService.revokeForUser(
      sessionId,
      auth.userId,
      isCurrentSession ? 'logout' : 'revoked_by_user',
    );
    if (!isRevoked) {
      throw sessionNotFound();
    }
    await this.activityService.record({
      userId: auth.userId,
      event: ActivityEvent.SessionRevoked,
      client,
      sessionId: auth.sessionId,
      details: {
        revokedSessionId: sessionId,
        isCurrentSession,
        deviceName: target?.deviceName ?? null,
        deviceIpAddress: target?.ipAddress ?? null,
      },
    });
    this.logger.log({
      message: 'Session revoked by user',
      userId: auth.userId,
      sessionId: auth.sessionId,
      revokedSessionId: sessionId,
      isCurrentSession,
      ipAddress: client.ipAddress,
    });
    return { revokedSessionId: sessionId, isCurrentSession };
  }
}

function sessionNotFound(): AppException {
  return new AppException(
    HttpStatus.NOT_FOUND,
    ErrorCode.NotFound,
    'Session not found',
  );
}

/** Fields listed explicitly: token hashes and family ids never leave the server. */
function toSessionResponse(
  session: Session,
  auth: AuthContext,
): SessionResponseDto {
  return {
    id: session._id,
    deviceName: session.deviceName,
    deviceType: session.deviceType,
    browser: session.browser,
    os: session.os,
    ipAddress: session.ipAddress,
    lastIpAddress: session.lastIpAddress,
    signedInAt: session.createdAt,
    lastUsedAt: session.lastUsedAt,
    expiresAt: session.expiresAt,
    isPersistent: session.isPersistent,
    isCurrent: session._id === auth.sessionId,
  };
}
