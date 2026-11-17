import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useLocation } from 'react-router-dom';

import { cn } from '@/lib/utils';

import { containsActive, useVisibleNavigation } from './navigation-filter';
import { SidebarGroup } from './SidebarGroup';
import { useSidebar } from './useSidebar';

/** Visible rows in DOM order (skips collapsed submenus and disabled items). */
const rows = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<HTMLElement>('[data-sidebar-item]')).filter(
    (el) => el.offsetParent !== null,
  );

/**
 * Groups from navigation.config.ts (filtered by flags / permissions). Keyboard: Tab moves
 * through the rows, ↑/↓/Home/End move between rows, →/← open / close submenus.
 */
export function SidebarContent({ className }: { className?: string }) {
  const { groups } = useVisibleNavigation();
  const { pathname } = useLocation();
  const { setExpanded } = useSidebar();
  const navRef = useRef<HTMLElement | null>(null);

  // Auto-expand the branch that contains the current page.
  useEffect(() => {
    for (const group of groups) {
      for (const item of group.items) {
        if (item.children?.length && containsActive(item, pathname)) setExpanded(item.id, true);
      }
    }
  }, [pathname, groups, setExpanded]);

  const onKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key) || !navRef.current) return;
    const items = rows(navRef.current);
    const index = items.indexOf(document.activeElement as HTMLElement);
    if (index < 0) return;
    event.preventDefault();
    const target =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? items.length - 1
          : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
    items[target]?.focus();
  };

  return (
    <nav
      ref={navRef}
      aria-label="Main"
      onKeyDown={onKeyDown}
      className={cn(
        'flex-1 scrollbar-thin space-y-1 overflow-x-hidden overflow-y-auto px-2 py-2',
        className,
      )}
    >
      {groups.map((group) => (
        <SidebarGroup key={group.id} group={group} />
      ))}
    </nav>
  );
}
