import type { ReactNode } from 'react';
import { useMatches } from 'react-router-dom';

import { isFeatureEnabled } from '@/config';
import { usePermissions } from '@/features/auth';
import { ForbiddenPage } from '@/pages/ForbiddenPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

import { handleOf } from '../../routes/route-handle';

/**
 * Applies the matched routes' handle.featureFlag (off → 404) and handle.permission
 * (missing → 403 inside the layout, so navigation stays available).
 */
export function RouteAccessBoundary({ children }: { children: ReactNode }) {
  const matches = useMatches();
  const { hasAnyPermission } = usePermissions();

  for (const match of matches) {
    const { featureFlag, permission } = handleOf(match);
    if (featureFlag && !isFeatureEnabled(featureFlag)) return <NotFoundPage embedded />;
    if (permission) {
      const required = typeof permission === 'string' ? [permission] : [...permission];
      if (!hasAnyPermission(required)) return <ForbiddenPage />;
    }
  }
  return <>{children}</>;
}
