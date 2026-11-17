import type { AdminUser, AdminUserRole, AdminUserStatus } from '../types/admin-user.types';

export const ROLE_LABEL: Record<AdminUserRole, string> = {
  admin: 'Admin',
  manager: 'Manager',
  member: 'Member',
  viewer: 'Viewer',
};

export const STATUS_LABEL: Record<AdminUserStatus, string> = {
  active: 'Active',
  invited: 'Invited',
  suspended: 'Suspended',
  pending: 'Pending approval',
};

export const fullName = (user: AdminUser) => `${user.firstName} ${user.lastName}`;
