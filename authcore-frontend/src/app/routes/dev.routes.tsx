import type { RouteObject } from 'react-router-dom';

import { paths } from '@/config';

import { lazyPage, type RouteHandle } from './route-handle';

/** Development builds only: the UI kitchen sink (every component × preset × mode). */
export const devRoutes: RouteObject[] = __DEV_BUILD__
  ? [
      {
        path: paths.dev.ui,
        handle: {
          title: 'UI kit',
          breadcrumb: [{ label: 'Developer' }, { label: 'UI kit' }],
        } satisfies RouteHandle,
        lazy: lazyPage(() => import('@/pages/dev/UiKitchenSinkPage'), 'UiKitchenSinkPage'),
      },
      {
        path: paths.dev.api,
        handle: {
          title: 'API playground',
          breadcrumb: [{ label: 'Developer' }, { label: 'API playground' }],
        } satisfies RouteHandle,
        lazy: lazyPage(() => import('@/app/dev/ApiPlaygroundPage'), 'ApiPlaygroundPage'),
      },
    ]
  : [];
