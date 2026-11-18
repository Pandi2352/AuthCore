import type {
  AdminUser,
  AdminUserRole,
  AdminUserStatus,
  UserActivity,
} from '../types/admin-user.types';

export const ROLE_LABEL: Record<AdminUserRole, string> = {
  ADMIN: 'Admin',
  USER: 'User',
};

export const STATUS_LABEL: Record<AdminUserStatus, string> = {
  ACTIVE: 'Active',
  PENDING_VERIFICATION: 'Email not verified',
  PENDING_APPROVAL: 'Pending approval',
  INACTIVE: 'Deactivated',
  SUSPENDED: 'Suspended',
  BANNED: 'Banned',
  REJECTED: 'Rejected',
};

export const STATUS_TONE: Record<
  AdminUserStatus,
  'success' | 'warning' | 'danger' | 'neutral' | 'info'
> = {
  ACTIVE: 'success',
  PENDING_VERIFICATION: 'info',
  PENDING_APPROVAL: 'warning',
  INACTIVE: 'neutral',
  SUSPENDED: 'danger',
  BANNED: 'danger',
  REJECTED: 'neutral',
};

export const ACTIVITY_LABEL: Record<UserActivity, string> = {
  ACTIVE: 'Active',
  DORMANT: 'Dormant',
  INACTIVE: 'Inactive',
};

export const fullName = (user: Pick<AdminUser, 'firstName' | 'lastName'>) =>
  [user.firstName, user.lastName].filter(Boolean).join(' ');

/** Active account without a sign-in for `days` days (or never). */
export function isDormant(user: Pick<AdminUser, 'status' | 'lastLoginAt'>, days: number): boolean {
  if (user.status !== 'ACTIVE') return false;
  if (!user.lastLoginAt) return true;
  return Date.now() - new Date(user.lastLoginAt).getTime() > days * 24 * 60 * 60 * 1000;
}
