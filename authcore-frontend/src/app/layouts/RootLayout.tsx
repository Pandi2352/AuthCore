import { Outlet, ScrollRestoration } from 'react-router-dom';

import { DevOverflowCheck } from './components/DevOverflowCheck';
import { FocusOnNavigate } from './components/FocusOnNavigate';
import { PageTitle } from './components/PageTitle';
import { RouteProgress } from './components/RouteProgress';

/** Top of the route tree: per-route title, progress bar, scroll restoration, focus handling. */
export function RootLayout() {
  return (
    <>
      <PageTitle />
      <RouteProgress />
      <FocusOnNavigate />
      <ScrollRestoration />
      {__DEV_BUILD__ && <DevOverflowCheck />}
      <Outlet />
    </>
  );
}
