import { Kbd, Tooltip } from '@/components/ui';
import { layoutConfig } from '@/config';
import { cn, isMacPlatform, modKeyLabel } from '@/lib/utils';

import { useVisibleNavigation } from './navigation-filter';
import { useSidebarMode } from './sidebar-mode';
import { useSidebarPosition } from './sidebar-position';
import { sidebarItemSize, sidebarRowClass } from './sidebar.variants';
import { SidebarItem } from './SidebarItem';
import { SidebarSubmenu } from './SidebarSubmenu';
import { SidebarToggleIcon } from './SidebarToggleIcon';
import { useSidebar } from './useSidebar';

/** Footer items (the Settings menu, help) + the collapse toggle (desktop). Menus with children open like the main ones. */
export function SidebarFooter() {
  const { footer } = useVisibleNavigation();
  const { collapsed, setCollapsed } = useSidebar();
  const { inDrawer, variant, tooltipSide } = useSidebarMode();
  const onLeft = useSidebarPosition() === 'left';
  // The navbar has its own toggle when layout.navbar.showSidebarToggle is on.
  const navbarHasToggle = layoutConfig.navbar.enabled && layoutConfig.navbar.showSidebarToggle;
  const showToggle = layoutConfig.sidebar.collapsible && !inDrawer && !navbarHasToggle;
  const label = collapsed ? 'Expand sidebar' : 'Collapse sidebar';
  // Nothing to show (no footer items, toggle in the navbar): no empty bordered strip.
  if (footer.items.length === 0 && !showToggle) return null;

  return (
    <div className="shrink-0 border-t border-sidebar-border px-2 py-2">
      {footer.items.length > 0 && (
        <ul className="space-y-0.5">
          {footer.items.map((item) =>
            item.children?.length ? (
              <SidebarSubmenu key={item.id} item={item} />
            ) : (
              <SidebarItem key={item.id} item={item} />
            ),
          )}
        </ul>
      )}
      {showToggle && (
        <Tooltip
          side={tooltipSide}
          content={
            <span className="inline-flex items-center gap-2">
              {label}
              <span className="inline-flex gap-0.5">
                <Kbd>{modKeyLabel()}</Kbd>
                <Kbd>B</Kbd>
              </span>
            </span>
          }
        >
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={label}
            aria-keyshortcuts={isMacPlatform() ? 'Meta+B' : 'Control+B'}
            className={cn(
              sidebarRowClass(false),
              sidebarItemSize[variant],
              'mt-0.5 text-sidebar-muted',
              collapsed && 'justify-center px-0',
            )}
          >
            <SidebarToggleIcon
              collapsed={collapsed}
              side={onLeft ? 'left' : 'right'}
              className="size-4.5 shrink-0"
            />
            {!collapsed && <span className="truncate">Collapse</span>}
          </button>
        </Tooltip>
      )}
    </div>
  );
}
