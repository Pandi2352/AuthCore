import { Outlet, ScrollRestoration } from 'react-router-dom';

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
      <Outlet />
    </>
  );
}
