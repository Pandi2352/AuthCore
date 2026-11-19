export type InviteStatus = 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';

/** GET /user-invites item. */
export interface Invite {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  status: InviteStatus;
  groupIds: string[];
  message: string | null;
  language: string | null;
  expiresAt: string;
  invitedBy: { id: string; name: string } | null;
  resendCount: number;
  lastSentAt: string;
  acceptedAt: string | null;
  acceptedUserId: string | null;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InvitePerson {
  email: string;
  firstName?: string;
  lastName?: string;
  language?: string;
}

export interface InviteOptions {
  /** Groups the person joins on acceptance. */
  groupIds?: string[];
  message?: string;
}

export type BulkSkipReason = 'ALREADY_REGISTERED' | 'ALREADY_INVITED' | 'DUPLICATE_IN_REQUEST';

export interface BulkInviteResult {
  createdCount: number;
  created: Invite[];
  skipped: Array<{ email: string; reason: BulkSkipReason }>;
}

/** A self-registered account (GET /admin/users?source=REGISTRATION). */
export interface RegisteredUser {
  id: string;
  email: string;
  username: string | null;
  firstName: string;
  lastName: string | null;
  status: string;
  isEmailVerified: boolean;
  source: string;
  lastLoginAt: string | null;
  createdAt: string;
}

/** GET /groups/dropdown */
export interface GroupOption {
  id: string;
  label: string;
  key?: string;
  parentId?: string | null;
}

export const MAX_BULK_INVITES = 100;
export const INVITE_MESSAGE_MAX = 500;

/** GET /user-invites/stats */
export interface InviteStats {
  total: number;
  /** Still waiting (link valid). */
  pending: number;
  accepted: number;
  /** Link ran out before it was used. */
  expired: number;
  revoked: number;
  sentLast7Days: number;
  /** Accounts created on the sign-up page. */
  registered: number;
  /** Accepted of accepted + expired + revoked, in %; null before any. */
  acceptanceRate: number | null;
}
