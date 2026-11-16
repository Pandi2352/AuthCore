import type { ClientInfo } from '@common/interfaces/client-info.interface';

export interface CreateSessionInput {
  userId: string;
  isPersistent: boolean;
  client: ClientInfo;
}

/** Result of creating a session. The refresh token exists only here, never stored. */
export interface CreatedSession {
  sessionId: string;
  refreshToken: string;
  expiresAt: Date;
  isPersistent: boolean;
  /** Sessions signed out because the user had too many. */
  revokedSessionIds: string[];
}
