import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { paths, withQuery } from '@/config';
import { useAuth } from '@/features/auth';

import { FullPageLoader } from '../components/FullPageLoader';

/**
 * Signed-out users go to /login?returnTo=<where they were>. Users who must change their password
 * (admin-forced, or expired by the policy) stay on the Security page until they do: the API
 * refuses everything else (403 AUTH_PASSWORD_EXPIRED), which would look like "no access".
 */
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
  if (user.mustChangePassword && location.pathname !== paths.account.security) {
    return (
      <Navigate
        to={paths.account.security}
        replace
        state={{ message: 'Change your password to continue. Until then, other pages are locked.' }}
      />
    );
  }
  return <Outlet />;
}
