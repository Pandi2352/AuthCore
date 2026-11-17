import { Link } from 'react-router-dom';

import { Logo } from '@/components/common/Logo';
import { appConfig, layoutConfig, paths } from '@/config';
import { cn } from '@/lib/utils';

import { useSidebarMode } from './sidebar-mode';

/** Logo (or the square mark when collapsed) linking home. */
export function SidebarHeader() {
  const { collapsed } = useSidebarMode();
  return (
    <div
      className={cn(
        // Same height as the navbar (border included), so both bottom borders form one line.
        'flex h-(--navbar-height) shrink-0 items-center border-b border-sidebar-border px-4',
        collapsed && 'justify-center px-2',
      )}
    >
      <Link
        to={paths.dashboard}
        aria-label={`${appConfig.name} home`}
        className="flex min-w-0 cursor-pointer items-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <Logo variant={collapsed ? 'mark' : 'full'} hideName={!layoutConfig.sidebar.showAppName} />
      </Link>
    </div>
  );
}
