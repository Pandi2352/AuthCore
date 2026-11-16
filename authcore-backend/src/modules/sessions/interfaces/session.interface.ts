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

/** The parts of a session the refresh flow needs. */
export interface SessionSummary {
  sessionId: string;
  userId: string;
  tokenFamilyId: string;
  expiresAt: Date;
  isPersistent: boolean;
  rotationCount: number;
}

/**
 * Outcome of presenting a refresh token:
 * - rotated:  valid current token → new refresh token issued
 * - grace:    the token rotated a moment ago (parallel request) → no new refresh token
 * - reused:   an old, already-rotated token → the whole family has been revoked
 * - invalid:  unknown, expired or revoked
 */
export type RefreshTokenUseResult =
  | { kind: 'rotated'; session: SessionSummary; refreshToken: string }
  | { kind: 'grace'; session: SessionSummary }
  | { kind: 'reused'; userId: string; tokenFamilyId: string; sessionId: string }
  | { kind: 'invalid' };
