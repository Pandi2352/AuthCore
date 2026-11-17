import type { ComponentType } from 'react';
import type { UIMatch } from 'react-router-dom';

import type { FeatureFlag } from '@/types/config.types';

export interface Crumb {
  label: string;
  /** Omit for a non-link crumb (e.g. a menu group without its own page). */
  href?: string;
}

/**
 * Per-route metadata (React Router `handle`), read by the layouts:
 * - title       → document.title ("Users · AuthCore") and the "not built yet" page
 * - breadcrumb  → navbar breadcrumbs (string = link to this route; array for extra levels)
 * - permission  → 403 page without it (any of the list); Level 2 wires real permissions
 * - featureFlag → 404 page when the flag is off
 */
export interface RouteHandle {
  title?: string;
  breadcrumb?: string | Crumb[] | ((match: UIMatch) => string | Crumb[]);
  permission?: string | readonly string[];
  featureFlag?: FeatureFlag;
  /** Planned pages: the navigation group / item they come from. */
  navGroupId?: string;
  description?: string;
}

/**
 * Lazy route module for a named page export (code-split per page):
 *   lazy: lazyPage(() => import('@/features/auth/pages/LoginPage'), 'LoginPage')
 */
export function lazyPage<M, K extends keyof M>(load: () => Promise<M>, exportName: K) {
  return async () => ({ Component: (await load())[exportName] as ComponentType });
}

export const handleOf = (match: { handle: unknown }): RouteHandle =>
  (match.handle ?? {}) as RouteHandle;
