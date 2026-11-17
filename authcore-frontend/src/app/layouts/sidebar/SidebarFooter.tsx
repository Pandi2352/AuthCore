import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from 'lucide-react';

import { Kbd, Tooltip } from '@/components/ui';
import { layoutConfig } from '@/config';
import { cn, isMacPlatform, modKeyLabel } from '@/lib/utils';

import { useVisibleNavigation } from './navigation-filter';
import { useSidebarMode } from './sidebar-mode';
import { sidebarItemSize, sidebarRowClass } from './sidebar.variants';
import { SidebarItem } from './SidebarItem';
import { useSidebar } from './useSidebar';

/** Footer items (settings, help) + the collapse toggle (desktop). */
export function SidebarFooter() {
  const { footer } = useVisibleNavigation();
  const { collapsed, setCollapsed } = useSidebar();
  const { inDrawer, variant, tooltipSide } = useSidebarMode();
  const onLeft = layoutConfig.sidebar.position === 'left';
  // The navbar has its own toggle when layout.navbar.showSidebarToggle is on.
  const navbarHasToggle = layoutConfig.navbar.enabled && layoutConfig.navbar.showSidebarToggle;
  const showToggle = layoutConfig.sidebar.collapsible && !inDrawer && !navbarHasToggle;
  const label = collapsed ? 'Expand sidebar' : 'Collapse sidebar';
  const Icon = collapsed
    ? onLeft
      ? PanelLeftOpen
      : PanelRightOpen
    : onLeft
      ? PanelLeftClose
      : PanelRightClose;

  return (
    <div className="shrink-0 border-t border-sidebar-border px-2 py-2">
      {footer.items.length > 0 && (
        <ul className="space-y-0.5">
          {footer.items.map((item) => (
            <SidebarItem key={item.id} item={item} />
          ))}
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
            <Icon className="size-4.5 shrink-0" aria-hidden="true" />
            {!collapsed && <span className="truncate">Collapse</span>}
          </button>
        </Tooltip>
      )}
    </div>
  );
}
