import { Navigate, Outlet, useSearchParams } from 'react-router-dom';

import { paths } from '@/config';
import { useAuth } from '@/features/auth';
import { safeReturnTo } from '@/lib/utils';

import { FullPageLoader } from '../components/FullPageLoader';

/** Signed-in users opening /login, /register … go to returnTo (same-origin only) or home. */
export function RequireGuest() {
  const { isAuthenticated, isLoading } = useAuth();
  const [searchParams] = useSearchParams();

  if (isLoading) return <FullPageLoader />;
  if (isAuthenticated) {
    return <Navigate to={safeReturnTo(searchParams.get('returnTo'), paths.dashboard)} replace />;
  }
  return <Outlet />;
}
