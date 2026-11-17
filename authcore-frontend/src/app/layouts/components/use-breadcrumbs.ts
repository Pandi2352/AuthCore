import { useMatches } from 'react-router-dom';

import { handleOf, type Crumb } from '../../routes/route-handle';

/** Crumbs from the matched routes' handle.breadcrumb (string = link to that route). */
export function useBreadcrumbs(): Crumb[] {
  const matches = useMatches();
  return matches.flatMap((match) => {
    const value = handleOf(match).breadcrumb;
    if (!value) return [];
    const resolved = typeof value === 'function' ? value(match) : value;
    return typeof resolved === 'string' ? [{ label: resolved, href: match.pathname }] : resolved;
  });
}
