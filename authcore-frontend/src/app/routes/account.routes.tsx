import type { RouteObject } from 'react-router-dom';

import { paths } from '@/config';

import { lazyPage, type RouteHandle } from './route-handle';

const page = lazyPage(() => import('@/features/account/pages/MyProfilePage'), 'MyProfilePage');
const handle = { title: 'My profile', breadcrumb: [{ label: 'My profile' }] } satisfies RouteHandle;

/**
 * My profile is one page (details, security, sessions, activity). The section links
 * (/security — also where a required password change sends you —, /sessions, /activity)
 * open the same page scrolled to that part.
 */
export const accountRoutes: RouteObject[] = [
  paths.account.profile,
  paths.account.security,
  paths.account.sessions,
  paths.account.activity,
].map((path) => ({ path, handle, lazy: page }));
