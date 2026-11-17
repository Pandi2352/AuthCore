import { useMemo } from 'react';

import { isFeatureEnabled, navigationConfig, navigationFooterConfig } from '@/config';
import { usePermissions } from '@/features/auth';
import type { NavGroup, NavItem } from '@/types/navigation.types';

/** Active when the URL equals the path (exact) or is below it (prefix, the default). */
export function isItemActive(item: NavItem, pathname: string): boolean {
  if (!item.path || item.external) return false;
  if (item.match === 'exact') return pathname === item.path;
  return pathname === item.path || pathname.startsWith(`${item.path}/`);
}

export function containsActive(item: NavItem, pathname: string): boolean {
  return (
    isItemActive(item, pathname) || (item.children ?? []).some((c) => containsActive(c, pathname))
  );
}

/**
 * Navigation the current user may see: hidden items, feature flags off and missing
 * permissions removed; parents without visible children dropped.
 */
export function useVisibleNavigation(): { groups: NavGroup[]; footer: NavGroup } {
  const { hasAnyPermission } = usePermissions();
  return useMemo(() => {
    const allowed = (entry: {
      featureFlag?: NavItem['featureFlag'];
      permission?: NavItem['permission'];
    }) =>
      (!entry.featureFlag || isFeatureEnabled(entry.featureFlag)) &&
      (!entry.permission ||
        hasAnyPermission(
          typeof entry.permission === 'string' ? [entry.permission] : [...entry.permission],
        ));

    const filterItems = (items: NavItem[]): NavItem[] =>
      items.flatMap((item) => {
        if (item.hidden || !allowed(item)) return [];
        if (!item.children) return [item];
        const children = filterItems(item.children);
        return children.length
          ? [{ ...item, children }]
          : item.path
            ? [{ ...item, children: undefined }]
            : [];
      });
    const filterGroup = (group: NavGroup): NavGroup => ({
      ...group,
      items: allowed(group) ? filterItems(group.items) : [],
    });

    return {
      groups: navigationConfig.map(filterGroup).filter((g) => g.items.length > 0),
      footer: filterGroup(navigationFooterConfig),
    };
  }, [hasAnyPermission]);
}
