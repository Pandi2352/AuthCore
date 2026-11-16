/**
 * Swagger tags = API groups. Use these constants in @ApiTags() so names
 * stay consistent. Add one entry per feature module, in the order it should
 * appear in the docs.
 */
export const API_TAGS = {
  App: { name: 'App', description: 'Application info' },
  Auth: {
    name: 'Auth',
    description: 'Registration and sign-in',
  },
  Password: {
    name: 'Password',
    description: 'Forgot / reset password and change password',
  },
  PasswordPolicy: {
    name: 'Password Policy',
    description:
      'Password rules, expiry and scheduled reminders (admin); requirements and pre-check (public)',
  },
  Sessions: {
    name: 'Sessions',
    description: 'My signed-in devices: list and sign out',
  },
  Health: {
    name: 'Health',
    description: 'Liveness and readiness checks for load balancers',
  },
} as const;

export type ApiTagName = (typeof API_TAGS)[keyof typeof API_TAGS]['name'];
