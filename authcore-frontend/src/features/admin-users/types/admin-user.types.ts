export type AdminUserStatus = 'active' | 'invited' | 'suspended' | 'pending';
export type AdminUserRole = 'admin' | 'manager' | 'member' | 'viewer';

/** A user as listed in administration (shape of the future GET /admin/users items). */
export interface AdminUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: AdminUserRole;
  status: AdminUserStatus;
  /** Active sessions right now. */
  sessions: number;
  /** Successful sign-ins, all time. */
  signIns: number;
  lastActiveAt: string | null;
  createdAt: string;
}
