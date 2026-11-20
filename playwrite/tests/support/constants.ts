/** Frontend routes (kept in step with authcore-frontend/src/config/paths.ts). */
export const ROUTES = {
  login: '/login',
  dashboard: '/dashboard',
  profile: '/profile',
  users: '/admin/users',
  userCreate: '/admin/users/new',
  usersBulk: '/admin/users/bulk',
  invites: '/admin/invites',
  roles: '/admin/access/roles',
  groups: '/admin/access/groups',
  auditLog: '/admin/access/audit-log',
  activity: '/admin/monitoring/activity',
  schemas: '/admin/security/schemas',
  passwordPolicy: '/admin/security/password-policy',
  appearance: '/settings/appearance',
  business: '/settings/business',
  storage: '/settings/storage',
} as const;

/** The test account, from .env (see .env.example). */
export function adminCredentials(): { email: string; password: string } {
  const email = process.env.E2E_ADMIN_EMAIL;
  const password = process.env.E2E_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error(
      'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD in playwrite/.env (copy .env.example).',
    );
  }
  return { email, password };
}
