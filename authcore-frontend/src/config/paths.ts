/**
 * Every URL of the app: constants and builders. Routes, links, redirects and
 * the navigation config use these — never a path string written elsewhere.
 * (Kept in config/ so navigation.config.ts can use it.)
 */
const segment = (value: string): string => encodeURIComponent(value);

export const paths = {
  root: '/',
  dashboard: '/dashboard',

  auth: {
    login: '/login',
    register: '/register',
    verifyEmail: '/verify-email',
    forgotPassword: '/forgot-password',
    resetPassword: '/reset-password',
    recovery: '/recovery',
    acceptInvite: '/accept-invite',
  },

  account: {
    profile: '/profile',
    security: '/security',
    sessions: '/sessions',
    activity: '/activity',
    devices: '/devices',
    preferences: '/preferences',
  },

  admin: {
    root: '/admin',
    users: '/admin/users',
    userCreate: '/admin/users/new',
    usersBulk: '/admin/users/bulk',
    userDetail: (id: string) => `/admin/users/${segment(id)}`,
    invites: '/admin/invites',
    roles: '/admin/access/roles',
    permissions: '/admin/access/permissions',
    groups: '/admin/access/groups',
    assignments: '/admin/access/assignments',
    auditLog: '/admin/access/audit-log',
    passwordPolicy: '/admin/security/password-policy',
    passwordPolicyNew: '/admin/security/password-policy/new',
    passwordPolicyEdit: (id: string) => `/admin/security/password-policy/${segment(id)}`,
    userSchema: '/admin/security/schemas',
    activity: '/admin/monitoring/activity',
  },

  settings: {
    root: '/settings',
    general: '/settings/general',
    appearance: '/settings/appearance',
    business: '/settings/business',
    storage: '/settings/storage',
  },

  errors: {
    forbidden: '/403',
    notFound: '/404',
  },

  /** Development-only pages (not routed in production builds). */
  dev: {
    ui: '/dev/ui',
    api: '/dev/api',
  },
} as const;

/**
 * Route patterns with dynamic segments, for route definitions only. Links use the builders
 * above (paths.admin.userDetail(id)); pages read params with useRequiredParam('id').
 */
export const routePatterns = {
  adminUserDetail: '/admin/users/:id',
  adminPasswordPolicyEdit: '/admin/security/password-policy/:id',
} as const;

/** Path with query parameters (undefined / empty values are left out). */
export function withQuery(
  path: string,
  query: Record<string, string | number | boolean | undefined>,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}
