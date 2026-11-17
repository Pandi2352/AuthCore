import type { RouteObject } from 'react-router-dom';

import { navigationConfig, navigationFooterConfig } from '@/config';
import type { NavGroup, NavItem } from '@/types/navigation.types';

import { lazyPage, type Crumb, type RouteHandle } from './route-handle';

/**
 * A "not built yet" page for every navigation item with `status: 'planned'` and an
 * internal path, so the menu never leads to a 404 while modules are being built.
 * Paths that already have a real route are skipped.
 */
export function plannedRoutes(existingPaths: ReadonlySet<string>): RouteObject[] {
  const routes: RouteObject[] = [];
  const visit = (group: NavGroup, item: NavItem, parent: NavItem | null) => {
    const isPlanned = item.status === 'planned' || parent?.status === 'planned';
    if (isPlanned && item.path && !item.external && !existingPaths.has(item.path)) {
      const breadcrumb: Crumb[] = [
        ...(group.title ? [{ label: group.title }] : []),
        ...(parent ? [{ label: parent.title }] : []),
        { label: item.title },
      ];
      routes.push({
        path: item.path,
        handle: {
          title: item.title,
          breadcrumb,
          permission: item.permission ?? parent?.permission,
          featureFlag: item.featureFlag ?? parent?.featureFlag ?? group.featureFlag,
        } satisfies RouteHandle,
        lazy: lazyPage(() => import('@/pages/PlannedFeaturePage'), 'PlannedFeaturePage'),
      });
    }
    for (const child of item.children ?? []) visit(group, child, item);
  };
  for (const group of [...navigationConfig, navigationFooterConfig]) {
    for (const item of group.items) visit(group, item, null);
  }
  return routes;
}

/** Every literal path in a route tree (to skip planned duplicates). */
export function collectPaths(routes: RouteObject[], into = new Set<string>()): Set<string> {
  for (const route of routes) {
    if (route.path) into.add(route.path);
    if (route.children) collectPaths(route.children, into);
  }
  return into;
}
