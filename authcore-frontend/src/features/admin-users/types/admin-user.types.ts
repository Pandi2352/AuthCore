export type AdminUserStatus =
  | 'PENDING_VERIFICATION'
  | 'PENDING_APPROVAL'
  | 'ACTIVE'
  | 'REJECTED'
  | 'INACTIVE'
  | 'SUSPENDED'
  | 'BANNED';
export type AdminUserRole = 'USER' | 'ADMIN';
/** The cards on the search page: active (recent sign-in), dormant (none lately), inactive (other status). */
export type UserActivity = 'ACTIVE' | 'DORMANT' | 'INACTIVE';

/** GET /admin/users item. */
export interface AdminUser {
  id: string;
  email: string;
  username: string | null;
  firstName: string;
  lastName: string | null;
  status: AdminUserStatus;
  role: AdminUserRole;
  isEmailVerified: boolean;
  mustChangePassword: boolean;
  source: 'REGISTRATION' | 'ADMIN' | 'INVITE' | 'SYSTEM';
  statusReason: string | null;
  deletionScheduledAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Position in the whole result (1-based), added by the API client for the "#" column. */
  rowNumber: number;
}

/** GET /admin/users/:id */
export interface AdminUserDetails extends Omit<AdminUser, 'rowNumber'> {
  activeSessionCount: number;
  groups: Array<{ id: string; name: string }>;
  isLocked: boolean;
  attributes: Record<string, unknown>;
  missingRequired: string[];
}

/** GET /admin/users/stats */
export interface UserStats {
  total: number;
  active: number;
  dormant: number;
  inactive: number;
  /** ADMIN role. */
  admins: number;
  /** Email address confirmed. */
  verified: number;
  neverSignedIn: number;
  /** Created in the last 30 days. */
  newLast30Days: number;
  dormantAfterDays: number;
  byStatus: Partial<Record<AdminUserStatus, number>>;
}

/** GET /admin/users/reports item. */
export interface UserReport {
  id: string;
  status: 'PENDING' | 'READY' | 'FAILED';
  format: 'CSV';
  fileName: string;
  rowCount: number | null;
  fileSize: number | null;
  filters: Record<string, unknown>;
  isTruncated: boolean;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
  expiresAt: string;
}

/** Statuses an admin can set (PATCH /admin/users/:id/status). */
export const SETTABLE_STATUSES = ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'BANNED'] as const;
export type SettableStatus = (typeof SETTABLE_STATUSES)[number];
