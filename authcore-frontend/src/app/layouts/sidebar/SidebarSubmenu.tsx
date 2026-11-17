import { ChevronRight } from 'lucide-react';
import { useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';

import {
  Badge,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui';
import { cn } from '@/lib/utils';
import type { NavItem } from '@/types/navigation.types';

import { NavBadge } from './NavBadge';
import { containsActive, isItemActive } from './navigation-filter';
import { useSidebarMode } from './sidebar-mode';
import { sidebarItemSize, sidebarRowClass } from './sidebar.variants';
import { ItemIcon, SidebarItem } from './SidebarItem';
import { useSidebar } from './useSidebar';

/** Hover intent: open only when the pointer rests on the icon (not while passing over). */
const OPEN_DELAY = 350;
const CLOSE_DELAY = 200;
/** One flyout at a time: opening one closes the previous immediately. */
let closeOpenFlyout: (() => void) | null = null;

/**
 * Collapsed sidebar: the parent's icon opens a flyout with its pages — on hover (mouse, with
 * a small delay so passing over doesn't flicker), click, Enter / Space / ↓.
 */
function CollapsedSubmenu({ item }: { item: NavItem }) {
  const { pathname } = useLocation();
  const { variant, tooltipSide } = useSidebarMode();
  const [open, setOpen] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const children = item.children ?? [];
  const branchActive = containsActive(item, pathname);

  const closeNow = () => {
    window.clearTimeout(timer.current);
    setOpen(false);
  };
  const apply = (next: boolean) => {
    if (next) {
      if (closeOpenFlyout && closeOpenFlyout !== closeNow) closeOpenFlyout();
      closeOpenFlyout = closeNow;
    }
    setOpen(next);
  };
  const schedule = (next: boolean, delay: number) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => apply(next), delay);
  };
  // Hover only for mice: on touch, a tap is a click (toggles the menu).
  const onEnter = (event: ReactPointerEvent) => {
    if (event.pointerType === 'mouse') schedule(true, OPEN_DELAY);
  };
  const onLeave = (event: ReactPointerEvent) => {
    if (event.pointerType === 'mouse') schedule(false, CLOSE_DELAY);
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <li>
      <DropdownMenu
        open={open}
        onOpenChange={(next) => {
          window.clearTimeout(timer.current);
          apply(next);
        }}
      >
        <DropdownMenuTrigger
          data-sidebar-item=""
          aria-label={item.title}
          onPointerEnter={onEnter}
          onPointerLeave={onLeave}
          className={cn(
            sidebarRowClass(branchActive),
            sidebarItemSize[variant],
            'relative justify-center px-0',
            open && !branchActive && 'bg-sidebar-accent text-sidebar-accent-foreground',
          )}
        >
          <ItemIcon item={item} />
          {/* Small corner mark: this icon has a submenu. */}
          <span
            aria-hidden="true"
            className="absolute right-1 bottom-1 size-1.5 rounded-full bg-sidebar-muted/70"
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side={tooltipSide}
          align="start"
          sideOffset={10}
          onPointerEnter={onEnter}
          onPointerLeave={onLeave}
          className="min-w-56 p-1.5"
        >
          <DropdownMenuLabel className="flex items-center gap-2 px-2 py-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {item.title}
          </DropdownMenuLabel>
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
                className={cn(
                  'gap-2',
                  active && 'bg-primary-soft font-medium text-primary-soft-foreground',
                )}
              >
                <Link to={child.path ?? '#'} aria-current={active ? 'page' : undefined}>
                  <span
                    aria-hidden="true"
                    className={cn(
                      'h-4 w-0.5 shrink-0 rounded-md',
                      active ? 'bg-primary' : 'bg-transparent',
                    )}
                  />
                  <span className="flex-1">{child.title}</span>
                  {child.badge && <NavBadge badge={child.badge} />}
                  {child.status === 'planned' && !child.badge && <Badge size="sm">Soon</Badge>}
                </Link>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

/**
 * Parent item with children. Expanded sidebar: an animated disclosure with a guide line and
 * an accent on the current page (Enter / Space / → / ←), open state persisted, the active
 * branch opened automatically. Collapsed: a flyout menu (CollapsedSubmenu).
 */
export function SidebarSubmenu({ item }: { item: NavItem }) {
  const { pathname } = useLocation();
  const { expandedIds, setExpanded } = useSidebar();
  const { collapsed, variant } = useSidebarMode();
  const listId = useId();
  const children = item.children ?? [];
  const branchActive = containsActive(item, pathname);
  const open = expandedIds.includes(item.id);

  if (collapsed) return <CollapsedSubmenu item={item} />;

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
          branchActive && 'font-medium text-sidebar-active-foreground',
        )}
      >
        <ItemIcon item={item} />
        <span className="min-w-0 flex-1 truncate">{item.title}</span>
        {item.badge && <NavBadge badge={item.badge} />}
        <ChevronRight
          className={cn(
            'size-4 shrink-0 text-sidebar-muted transition-transform duration-200',
            open && 'rotate-90',
          )}
          aria-hidden="true"
        />
      </button>
      {/* Height animates via grid rows (0fr ↔ 1fr); closed content is inert (no tab stops). */}
      <div
        className={cn(
          'grid transition-[grid-template-rows,opacity] duration-200 ease-out',
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
        )}
        inert={!open}
      >
        {/* The wrapper clips during the animation; the list keeps room for the accent bar. */}
        <div className="min-h-0 overflow-hidden">
          <ul
            id={listId}
            aria-label={item.title}
            className="ml-[1.3rem] space-y-0.5 border-l border-sidebar-border pl-2"
          >
            <li aria-hidden="true" className="h-0.5" />
            {children.map((child) => (
              <SidebarItem key={child.id} item={child} depth={1} />
            ))}
            <li aria-hidden="true" className="h-0.5" />
          </ul>
        </div>
      </div>
    </li>
  );
}
