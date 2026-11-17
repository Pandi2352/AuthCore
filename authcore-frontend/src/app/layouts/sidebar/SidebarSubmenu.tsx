import { ChevronRight } from 'lucide-react';
import { useId } from 'react';
import { Link, useLocation } from 'react-router-dom';

import {
  Badge,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Tooltip,
} from '@/components/ui';
import { cn } from '@/lib/utils';
import type { NavItem } from '@/types/navigation.types';

import { NavBadge } from './NavBadge';
import { containsActive, isItemActive } from './navigation-filter';
import { useSidebarMode } from './sidebar-mode';
import { sidebarItemSize, sidebarRowClass } from './sidebar.variants';
import { ItemIcon, SidebarItem } from './SidebarItem';
import { useSidebar } from './useSidebar';

/**
 * Parent item with children. Expanded sidebar: inline disclosure (Enter / Space / → / ←),
 * open state persisted, active branch auto-expanded. Collapsed: a flyout menu.
 */
export function SidebarSubmenu({ item }: { item: NavItem }) {
  const { pathname } = useLocation();
  const { expandedIds, setExpanded } = useSidebar();
  const { collapsed, variant, tooltipSide } = useSidebarMode();
  const listId = useId();
  const children = item.children ?? [];
  const branchActive = containsActive(item, pathname);
  const open = expandedIds.includes(item.id);

  if (collapsed) {
    return (
      <li>
        <DropdownMenu>
          <Tooltip content={item.title} side={tooltipSide} delay={0}>
            <DropdownMenuTrigger
              data-sidebar-item=""
              className={cn(
                sidebarRowClass(branchActive),
                sidebarItemSize[variant],
                'justify-center px-0',
              )}
            >
              <ItemIcon item={item} />
              <span className="sr-only">{item.title}</span>
            </DropdownMenuTrigger>
          </Tooltip>
          <DropdownMenuContent side={tooltipSide} align="start" sideOffset={8} className="min-w-52">
            <DropdownMenuLabel>{item.title}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {children.map((child) => {
              const active = isItemActive(child, pathname);
              return child.external && child.path ? (
                <DropdownMenuItem key={child.id} asChild>
                  <a href={child.path} target="_blank" rel="noopener noreferrer">
                    {child.title}
                  </a>
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  key={child.id}
                  asChild
                  disabled={child.disabled}
                  className={cn(active && 'bg-sidebar-active text-sidebar-active-foreground')}
                >
                  <Link to={child.path ?? '#'} aria-current={active ? 'page' : undefined}>
                    <span className="flex-1">{child.title}</span>
                    {child.status === 'planned' && <Badge size="sm">Soon</Badge>}
                  </Link>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </li>
    );
  }

  return (
    <li>
      <button
        type="button"
        data-sidebar-item=""
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setExpanded(item.id, !open)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowRight' && !open) {
            event.preventDefault();
            setExpanded(item.id, true);
          } else if (event.key === 'ArrowLeft' && open) {
            event.preventDefault();
            setExpanded(item.id, false);
          }
        }}
        className={cn(
          sidebarRowClass(false),
          sidebarItemSize[variant],
          branchActive && !open && 'font-medium text-sidebar-active-foreground',
        )}
      >
        <ItemIcon item={item} />
        <span className="min-w-0 flex-1 truncate">{item.title}</span>
        {item.badge && <NavBadge badge={item.badge} />}
        <ChevronRight
          className={cn(
            'size-4 shrink-0 text-sidebar-muted transition-transform',
            open && 'rotate-90',
          )}
          aria-hidden="true"
        />
      </button>
      <ul id={listId} hidden={!open} className="mt-0.5 space-y-0.5">
        {children.map((child) => (
          <SidebarItem key={child.id} item={child} depth={1} />
        ))}
      </ul>
    </li>
  );
}
