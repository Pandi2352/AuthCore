import type { RouteObject } from 'react-router-dom';

import { paths } from '@/config';

import { lazyPage, type RouteHandle } from './route-handle';

/**
 * Administration area. Real pages are added here as the admin modules are built (Level 2);
 * until then every admin menu item shows a "not built yet" page (planned.routes.tsx).
 */
export const adminRoutes: RouteObject[] = [
  {
    path: paths.admin.root,
    handle: {
      title: 'Administration',
      breadcrumb: 'Administration',
      featureFlag: 'admin.enabled',
      navGroupId: 'admin',
      description: 'Users, access control, security settings and sign-in activity.',
    } satisfies RouteHandle,
    lazy: lazyPage(() => import('@/pages/PlannedModulePage'), 'PlannedModulePage'),
  },
  {
    path: paths.admin.users,
    handle: {
      title: 'Users',
      breadcrumb: [{ label: 'Administration' }, { label: 'Users' }],
      featureFlag: 'admin.enabled',
      permission: 'USER_READ',
    } satisfies RouteHandle,
    lazy: lazyPage(() => import('@/features/admin-users/pages/UsersListPage'), 'UsersListPage'),
  },
];
