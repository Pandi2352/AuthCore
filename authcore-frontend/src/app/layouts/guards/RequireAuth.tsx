import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { paths, withQuery } from '@/config';
import { useAuth } from '@/features/auth';

import { FullPageLoader } from '../components/FullPageLoader';

/** Signed-out users go to /login?returnTo=<where they were>. */
export function RequireAuth() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) return <FullPageLoader label="Checking your session" />;
  if (!isAuthenticated || !user) {
    const returnTo = `${location.pathname}${location.search}${location.hash}`;
    return (
      <Navigate
        to={withQuery(paths.auth.login, {
          returnTo: returnTo === paths.root ? undefined : returnTo,
        })}
        replace
      />
    );
  }
  return <Outlet />;
}
