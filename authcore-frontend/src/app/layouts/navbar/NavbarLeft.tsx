import { Menu } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Logo } from '@/components/common/Logo';
import { IconButton } from '@/components/ui';
import { appConfig, layoutConfig, paths } from '@/config';

import { Breadcrumbs } from '../components/Breadcrumbs';
import { useSidebar } from '../sidebar';

/** Menu button (mobile), logo when there is no sidebar, breadcrumbs. */
export function NavbarLeft() {
  const { isDesktop, mobileOpen, setMobileOpen } = useSidebar();
  const { sidebar, navbar } = layoutConfig;
  const sidebarVisible = sidebar.enabled && isDesktop;
  const showLogo =
    navbar.showLogo === 'always' || (navbar.showLogo === 'when-sidebar-hidden' && !sidebarVisible);

  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      {sidebar.enabled && !isDesktop && (
        <IconButton
          aria-label="Open navigation"
          aria-expanded={mobileOpen}
          icon={<Menu />}
          showTooltip={false}
          onClick={() => setMobileOpen(true)}
        />
      )}
      {showLogo && (
        <Link
          to={paths.dashboard}
          aria-label={`${appConfig.name} home`}
          className="shrink-0 cursor-pointer rounded-md"
        >
          <Logo hideName={!isDesktop} />
        </Link>
      )}
      <Breadcrumbs />
    </div>
  );
}
