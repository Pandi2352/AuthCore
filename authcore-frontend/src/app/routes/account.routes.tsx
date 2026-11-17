import type { RouteObject } from 'react-router-dom';

import { paths } from '@/config';

import { lazyPage, type Crumb, type RouteHandle } from './route-handle';

const account: Crumb = { label: 'My account' };
const crumbs = (label: string): Crumb[] => [account, { label }];

export const accountRoutes: RouteObject[] = [
  {
    path: paths.account.profile,
    handle: { title: 'Profile', breadcrumb: crumbs('Profile') } satisfies RouteHandle,
    lazy: lazyPage(() => import('@/features/account/pages/ProfilePage'), 'ProfilePage'),
  },
  {
    path: paths.account.security,
    handle: { title: 'Security', breadcrumb: crumbs('Security') } satisfies RouteHandle,
    lazy: lazyPage(() => import('@/features/account/pages/SecurityPage'), 'SecurityPage'),
  },
  {
    path: paths.account.sessions,
    handle: {
      title: 'Sessions',
      breadcrumb: crumbs('Sessions'),
      featureFlag: 'account.sessionsPage',
    } satisfies RouteHandle,
    lazy: lazyPage(() => import('@/features/account/pages/SessionsPage'), 'SessionsPage'),
  },
  {
    path: paths.account.activity,
    handle: {
      title: 'Activity',
      breadcrumb: crumbs('Activity'),
      featureFlag: 'account.activityPage',
    } satisfies RouteHandle,
    lazy: lazyPage(() => import('@/features/account/pages/ActivityPage'), 'ActivityPage'),
  },
];
