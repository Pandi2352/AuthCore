import { resolveTarget } from '../../target.mjs';

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

/** The admin account of the current target (see target.mjs). */
export function adminCredentials(): { email: string; password: string } {
  const { name, email, password } = resolveTarget();
  if (!email || !password) {
    throw new Error(
      name === 'test'
        ? 'No test admin password: start the test environment once (npm run env:test); it saves E2E_TEST_ADMIN_PASSWORD in playwrite/.env.'
        : 'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD in playwrite/.env for PW_ENV=dev.',
    );
  }
  return { email, password };
}
