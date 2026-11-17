import { Navigate, type RouteObject } from 'react-router-dom';

import { paths } from '@/config';

import { lazyPage, type RouteHandle } from './route-handle';

export const settingsRoutes: RouteObject[] = [
  { path: paths.settings.root, element: <Navigate to={paths.settings.general} replace /> },
  {
    path: paths.settings.appearance,
    handle: {
      title: 'Appearance',
      breadcrumb: [{ label: 'Settings' }, { label: 'Appearance' }],
      featureFlag: 'ui.themeCustomizer',
    } satisfies RouteHandle,
    lazy: lazyPage(
      () => import('@/features/settings/pages/AppearanceSettingsPage'),
      'AppearanceSettingsPage',
    ),
  },
];
