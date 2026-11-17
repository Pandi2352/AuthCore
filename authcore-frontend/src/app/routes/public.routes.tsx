import type { RouteObject } from 'react-router-dom';

/**
 * Public pages rendered in PublicLayout (landing, about, pricing …) — optional per project.
 * Empty in AuthCore ("/" redirects to the dashboard). Example:
 *
 *   { path: '/about', handle: { title: 'About' }, lazy: lazyPage(() => import('@/features/marketing/pages/AboutPage'), 'AboutPage') }
 */
export const publicRoutes: RouteObject[] = [];
