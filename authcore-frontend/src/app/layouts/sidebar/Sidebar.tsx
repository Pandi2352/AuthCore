import { layoutConfig } from '@/config';
import { cn } from '@/lib/utils';

import { useSidebarMode } from './sidebar-mode';
import { sidebarVariants } from './sidebar.variants';
import { SidebarContent } from './SidebarContent';
import { SidebarFooter } from './SidebarFooter';
import { SidebarHeader } from './SidebarHeader';
import { useSidebar } from './useSidebar';

/**
 * Desktop sidebar (aside landmark). Width / collapsed width / position / sticky or fixed from
 * layout.config.ts; look from the theme (classic, minimal, floating, compact, dark).
 */
export function Sidebar() {
  const { collapsed } = useSidebar();
  const { variant } = useSidebarMode();
  const { position, behavior } = layoutConfig.sidebar;
  const floating = variant === 'floating';
  return (
    <aside
      aria-label="Sidebar"
      data-collapsed={collapsed || undefined}
      style={{ zIndex: 'var(--z-sidebar)' }}
      className={cn(
        sidebarVariants({ variant, position }),
        collapsed ? 'w-(--sidebar-width-collapsed)' : 'w-(--sidebar-width)',
        behavior === 'sticky'
          ? cn('sticky', floating ? 'top-2 h-[calc(100dvh-1rem)]' : 'top-0 h-dvh')
          : floating
            ? 'h-[calc(100%-1rem)]'
            : 'h-full',
      )}
    >
      <SidebarHeader />
      <SidebarContent />
      <SidebarFooter />
    </aside>
  );
}
