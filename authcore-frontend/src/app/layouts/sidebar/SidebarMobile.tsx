import { Sheet, SheetContent } from '@/components/ui';

import { SidebarModeContext } from './sidebar-mode';
import { useSidebarPosition } from './sidebar-position';
import { SidebarContent } from './SidebarContent';
import { SidebarFooter } from './SidebarFooter';
import { SidebarHeader } from './SidebarHeader';
import { useSidebar } from './useSidebar';

const DRAWER_MODE = { collapsed: false, inDrawer: true };

/** Below the mobile breakpoint: the sidebar as a drawer (Escape, overlay click and navigation close it). */
export function SidebarMobile() {
  const { mobileOpen, setMobileOpen } = useSidebar();
  const position = useSidebarPosition();
  return (
    <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
      <SheetContent
        side={position}
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
