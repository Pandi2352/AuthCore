import { Navigate, type RouteObject } from 'react-router-dom';

import { paths } from '@/config';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { RouteErrorPage } from '@/pages/RouteErrorPage';

import { FullPageLoader } from '../layouts/components/FullPageLoader';
import { RequireAuth } from '../layouts/guards/RequireAuth';
import { RequireGuest } from '../layouts/guards/RequireGuest';
import { RootLayout } from '../layouts/RootLayout';
import { accountRoutes } from './account.routes';
import { adminRoutes } from './admin.routes';
import { guestAuthRoutes, openAuthRoutes } from './auth.routes';
import { dashboardRoutes } from './dashboard.routes';
import { devRoutes } from './dev.routes';
import { collectPaths, plannedRoutes } from './planned.routes';
import { publicRoutes } from './public.routes';
import { lazyPage, type RouteHandle } from './route-handle';
import { settingsRoutes } from './settings.routes';

/** Old URLs → new ones (keep bookmarks and emailed links working after a rename). */
const redirects: Array<{ from: string; to: string }> = [
  { from: '/home', to: paths.dashboard },
  { from: '/account', to: paths.account.profile },
];

const appRoutes: RouteObject[] = [
  ...dashboardRoutes,
  ...accountRoutes,
  ...settingsRoutes,
  ...adminRoutes,
  ...devRoutes,
];
const appRoutesWithPlanned = [...appRoutes, ...plannedRoutes(collectPaths(appRoutes))];

const authLayout = lazyPage(() => import('../layouts/AuthLayout'), 'AuthLayout');
const appLayout = lazyPage(() => import('../layouts/AppLayout'), 'AppLayout');

/**
 * The whole route tree:
 *
 *   RootLayout (title, progress bar, scroll restoration, focus on navigation)
 *   ├── PublicLayout          optional public pages
 *   ├── RequireGuest → AuthLayout   login, register, forgot password, recovery
 *   ├── AuthLayout            verify email, reset password (signed in or out)
 *   ├── RequireAuth → AppLayout     dashboard, account, settings, admin, planned, dev
 *   ├── /403, /404
 *   └── *                     → 404
 */
export const routes: RouteObject[] = [
  {
    id: 'root',
    element: <RootLayout />,
    errorElement: <RouteErrorPage />,
    hydrateFallbackElement: <FullPageLoader />,
    children: [
      { path: paths.root, element: <Navigate to={paths.dashboard} replace /> },
      ...redirects.map(({ from, to }) => ({ path: from, element: <Navigate to={to} replace /> })),

      ...(publicRoutes.length
        ? [
            {
              lazy: lazyPage(() => import('../layouts/PublicLayout'), 'PublicLayout'),
              errorElement: <RouteErrorPage />,
              children: publicRoutes,
            },
          ]
        : []),

      {
        element: <RequireGuest />,
        children: [
          { lazy: authLayout, errorElement: <RouteErrorPage />, children: guestAuthRoutes },
        ],
      },
      { lazy: authLayout, errorElement: <RouteErrorPage />, children: openAuthRoutes },

      {
        element: <RequireAuth />,
        children: [
          {
            lazy: appLayout,
            errorElement: <RouteErrorPage />,
            children: [
              ...appRoutesWithPlanned,
              {
                path: paths.errors.forbidden,
                handle: { title: 'Access denied' } satisfies RouteHandle,
                lazy: lazyPage(() => import('@/pages/ForbiddenPage'), 'ForbiddenPage'),
              },
            ],
          },
        ],
      },

      {
        path: paths.errors.notFound,
        handle: { title: 'Page not found' },
        element: <NotFoundPage />,
      },
      { path: '*', handle: { title: 'Page not found' }, element: <NotFoundPage /> },
    ],
  },
];
