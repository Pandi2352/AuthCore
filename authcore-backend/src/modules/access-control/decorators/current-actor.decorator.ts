import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

import type { Actor } from '../interfaces/actor.interface';

const MAX_USER_AGENT_LENGTH = 512;

/**
 * The signed-in user + where the request comes from, for access-control
 * changes (audit trail, escalation checks). Protected routes only.
 */
export const CurrentActor = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Actor => {
    const request = context.switchToHttp().getRequest<Request>();
    if (!request.auth) {
      throw new Error('CurrentActor used on a route without authentication');
    }
    return {
      auth: request.auth,
      client: {
        ipAddress: request.ip ?? request.socket.remoteAddress ?? 'unknown',
        userAgent: (request.get('user-agent') ?? '').slice(
          0,
          MAX_USER_AGENT_LENGTH,
        ),
      },
    };
  },
);
