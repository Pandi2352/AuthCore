import { ExternalLink } from 'lucide-react';
import type { ReactElement, ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { Badge, Tooltip } from '@/components/ui';
import { icons } from '@/config';
import { cn } from '@/lib/utils';
import type { NavItem } from '@/types/navigation.types';

import { NavBadge } from './NavBadge';
import { isItemActive } from './navigation-filter';
import { useSidebarMode } from './sidebar-mode';
import { sidebarItemSize, sidebarRowClass } from './sidebar.variants';

export function ItemIcon({ item }: { item: NavItem }) {
  const Icon = item.icon ? icons[item.icon] : null;
  return Icon ? <Icon className="size-4.5 shrink-0" aria-hidden="true" /> : null;
}

/** One link row: icon, label, badge, active state; tooltip when collapsed. */
export function SidebarItem({ item, depth = 0 }: { item: NavItem; depth?: 0 | 1 }) {
  const { pathname } = useLocation();
  const { collapsed, variant, tooltipSide } = useSidebarMode();
  const active = isItemActive(item, pathname);
  const iconOnly = collapsed && depth === 0;

  const content: ReactNode = (
    <>
      {depth === 0 ? (
        <ItemIcon item={item} />
      ) : (
        <span
          className={cn(
            'size-1.5 shrink-0 rounded-full',
            active ? 'bg-sidebar-active-foreground' : 'bg-sidebar-muted/60',
          )}
          aria-hidden="true"
        />
      )}
      <span className={cn('min-w-0 flex-1 truncate', iconOnly && 'sr-only')}>{item.title}</span>
      {!iconOnly && item.badge && <NavBadge badge={item.badge} />}
      {!iconOnly && item.status === 'planned' && !item.badge && (
        <Badge size="sm" className="opacity-80">
          Soon
        </Badge>
      )}
      {!iconOnly && item.external && (
        <ExternalLink className="size-3.5 shrink-0 text-sidebar-muted" aria-hidden="true" />
      )}
      {item.external && <span className="sr-only">(opens in a new tab)</span>}
    </>
  );

  const className = cn(
    sidebarRowClass(active),
    sidebarItemSize[variant],
    iconOnly && 'justify-center px-0',
    depth === 1 && !collapsed && 'pl-[2.35rem]',
  );

  let row: ReactNode;
  if (item.disabled) {
    row = (
      <span
        aria-disabled="true"
        className={cn(className, 'cursor-not-allowed opacity-50 hover:bg-transparent')}
      >
        {content}
      </span>
    );
  } else if (item.external && item.path) {
    row = (
      <a
        href={item.path}
        target="_blank"
        rel="noopener noreferrer"
        data-sidebar-item=""
        className={className}
      >
        {content}
      </a>
    );
  } else {
    row = (
      <Link
        to={item.path ?? '#'}
        data-sidebar-item=""
        aria-current={active ? 'page' : undefined}
        className={className}
      >
        {content}
      </Link>
    );
  }

  return (
    <li>
      {iconOnly ? (
        <Tooltip content={item.title} side={tooltipSide} delay={0}>
          {row as ReactElement}
        </Tooltip>
      ) : (
        row
      )}
    </li>
  );
}
