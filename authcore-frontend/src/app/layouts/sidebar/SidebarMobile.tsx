import { Sheet, SheetContent } from '@/components/ui';
import { layoutConfig } from '@/config';

import { SidebarModeContext } from './sidebar-mode';
import { SidebarContent } from './SidebarContent';
import { SidebarFooter } from './SidebarFooter';
import { SidebarHeader } from './SidebarHeader';
import { useSidebar } from './useSidebar';

const DRAWER_MODE = { collapsed: false, inDrawer: true };

/** Below the mobile breakpoint: the sidebar as a drawer (Escape, overlay click and navigation close it). */
export function SidebarMobile() {
  const { mobileOpen, setMobileOpen } = useSidebar();
  return (
    <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
      <SheetContent
        side={layoutConfig.sidebar.position}
        size="sm"
        aria-label="Navigation"
        data-app-sidebar=""
        className="flex w-(--sidebar-width) flex-col bg-sidebar p-0 text-sidebar-foreground"
      >
        <SidebarModeContext.Provider value={DRAWER_MODE}>
          <SidebarHeader />
          <SidebarContent />
          <SidebarFooter />
        </SidebarModeContext.Provider>
      </SheetContent>
    </Sheet>
  );
}
