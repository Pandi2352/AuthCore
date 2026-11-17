import type { ReactNode } from 'react';
import { Outlet } from 'react-router-dom';

import { usePermissions } from '@/features/auth';
import { ForbiddenPage } from '@/pages/ForbiddenPage';

/**
 * Wraps routes (as a layout route) or an element that needs a permission (any of the list).
 * Most routes declare `handle.permission` instead (checked by RouteAccessBoundary).
 */
export function RequirePermission({
  permission,
  children,
}: {
  permission: string | readonly string[];
  children?: ReactNode;
}) {
  const { hasAnyPermission } = usePermissions();
  const required = typeof permission === 'string' ? [permission] : [...permission];
  if (!hasAnyPermission(required)) return <ForbiddenPage />;
  return children ? <>{children}</> : <Outlet />;
}
