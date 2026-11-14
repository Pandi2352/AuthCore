/**
 * Swagger tags = API groups. Use these constants in @ApiTags() so names
 * stay consistent. Add one entry per feature module, in the order it should
 * appear in the docs.
 */
export const API_TAGS = {
  App: { name: 'App', description: 'Application info' },
  Health: {
    name: 'Health',
    description: 'Liveness and readiness checks for load balancers',
  },
} as const;

export type ApiTagName = (typeof API_TAGS)[keyof typeof API_TAGS]['name'];
