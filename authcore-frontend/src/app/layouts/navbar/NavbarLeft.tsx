import { Menu } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Logo } from '@/components/common/Logo';
import { IconButton } from '@/components/ui';
import { appConfig, layoutConfig, paths } from '@/config';
import { modKeyLabel } from '@/lib/utils';

import { Breadcrumbs } from '../components/Breadcrumbs';
import { SidebarToggleIcon, useSidebar, useSidebarPosition } from '../sidebar';

/** Sidebar toggle, logo (per layout.navbar.showLogo), breadcrumbs. */
export function NavbarLeft() {
  const { isDesktop, collapsed, toggleCollapsed, mobileOpen, setMobileOpen } = useSidebar();
  const { sidebar, navbar } = layoutConfig;
  const position = useSidebarPosition();
  const sidebarVisible = sidebar.enabled && isDesktop;
  const showLogo =
    navbar.showLogo === 'always' ||
    (navbar.showLogo === 'when-sidebar-hidden' && !sidebarVisible) ||
    (navbar.showLogo === 'when-sidebar-collapsed' && (!sidebarVisible || collapsed));

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      {sidebar.enabled && !isDesktop && (
        <IconButton
          aria-label="Open navigation"
          aria-expanded={mobileOpen}
          icon={<Menu />}
          showTooltip={false}
          onClick={() => setMobileOpen(true)}
        />
      )}
      {sidebarVisible && sidebar.collapsible && navbar.showSidebarToggle && (
        <IconButton
          aria-label={`${collapsed ? 'Expand' : 'Collapse'} sidebar (${modKeyLabel()} B)`}
          aria-expanded={!collapsed}
          aria-keyshortcuts="Control+B Meta+B"
          icon={<SidebarToggleIcon collapsed={collapsed} side={position} />}
          onClick={toggleCollapsed}
          className="text-foreground [&_svg]:size-5"
        />
      )}
      {showLogo && (
        <Link
          to={paths.dashboard}
          aria-label={`${appConfig.name} home`}
          className="shrink-0 cursor-pointer rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <Logo hideName={!isDesktop} />
        </Link>
      )}
      <Breadcrumbs className="ml-1" />
    </div>
  );
}
