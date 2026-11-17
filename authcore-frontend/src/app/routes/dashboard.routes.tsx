import type { RouteObject } from 'react-router-dom';

import { paths } from '@/config';

import { lazyPage, type RouteHandle } from './route-handle';

export const dashboardRoutes: RouteObject[] = [
  {
    path: paths.dashboard,
    handle: { title: 'Dashboard', breadcrumb: 'Dashboard' } satisfies RouteHandle,
    lazy: lazyPage(() => import('@/features/dashboard/pages/DashboardPage'), 'DashboardPage'),
  },
];
