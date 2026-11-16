import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

import type { ClientInfo } from '@common/interfaces/client-info.interface';

const MAX_USER_AGENT_LENGTH = 512;

/**
 * Injects the caller's IP and user agent:
 *   login(@ClientInfo() client: ClientInfo) { ... }
 *
 * The IP respects TRUST_PROXY_HOPS (real client IP behind load balancers).
 * The user agent is truncated, since it is client-controlled.
 */
export const ClientInfoParam = createParamDecorator(
  (_data: unknown, context: ExecutionContext): ClientInfo => {
    const request = context.switchToHttp().getRequest<Request>();
    const userAgent = request.get('user-agent') ?? '';
    return {
      ipAddress: request.ip ?? request.socket.remoteAddress ?? 'unknown',
      userAgent: userAgent.slice(0, MAX_USER_AGENT_LENGTH),
    };
  },
);
