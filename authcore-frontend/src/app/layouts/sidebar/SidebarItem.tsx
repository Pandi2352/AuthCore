import { ExternalLink } from 'lucide-react';
import type { ReactElement, ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { useOptionalTheme } from '@/app/theme';
import { Badge, Tooltip } from '@/components/ui';
import { icons } from '@/config';
import { cn } from '@/lib/utils';
import { NAV_ICON_COLORS, type NavIconColor, type NavItem } from '@/types/navigation.types';

import { NavBadge } from './NavBadge';
import { isItemActive } from './navigation-filter';
import { useSidebarMode } from './sidebar-mode';
import { sidebarItemSize, sidebarRowClass } from './sidebar.variants';
import { useModernIcons } from './use-modern-icons';

/** Full class names (Tailwind only generates classes it can find in the source). */
const NAV_COLOR_CLASS: Record<NavIconColor, string> = {
  blue: 'text-nav-blue',
  violet: 'text-nav-violet',
  emerald: 'text-nav-emerald',
  amber: 'text-nav-amber',
  rose: 'text-nav-rose',
  cyan: 'text-nav-cyan',
  orange: 'text-nav-orange',
  indigo: 'text-nav-indigo',
};

/** Stable color per item: configured `iconColor`, else picked from the id. */
function colorOf(item: NavItem): NavIconColor {
  if (item.iconColor) return item.iconColor;
  let hash = 0;
  for (const char of item.id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return NAV_ICON_COLORS[hash % NAV_ICON_COLORS.length] ?? 'blue';
}

/**
 * Navigation icon in the theme's icon style (appearance.icons): classic = lucide outline;
 * modern = Phosphor regular; duotone = Phosphor two-tone; color = two-tone in the item's color.
 */
export function ItemIcon({ item }: { item: NavItem }) {
  const style = useOptionalTheme()?.appearance.icons ?? 'classic';
  const modern = useModernIcons(style !== 'classic');
  if (!item.icon) return null;
  if (style === 'classic' || !modern) {
    const Icon = icons[item.icon];
    return <Icon className="size-4.5 shrink-0" aria-hidden="true" />;
  }
  const Icon = modern[item.icon];
  return (
    <Icon
      size={18}
      weight={style === 'modern' ? 'regular' : 'duotone'}
      aria-hidden="true"
      className={cn(
        'shrink-0',
        // Duotone: Phosphor's second layer (the path with opacity) in the theme color.
        style === 'duotone' && '[&_[opacity]]:fill-primary [&_[opacity]]:opacity-35',
        style === 'color' && [NAV_COLOR_CLASS[colorOf(item)], '[&_[opacity]]:opacity-25'],
      )}
    />
  );
}

/** One link row: icon, label, badge, active state; tooltip when collapsed. */
export function SidebarItem({ item, depth = 0 }: { item: NavItem; depth?: 0 | 1 }) {
  const { pathname } = useLocation();
  const { collapsed, variant, tooltipSide } = useSidebarMode();
  const active = isItemActive(item, pathname);
  const iconOnly = collapsed && depth === 0;

  const content: ReactNode = (
    <>
      {depth === 0 && <ItemIcon item={item} />}
      {depth === 1 && active && (
        // Accent on the submenu guide line, next to the current page.
        <span
          aria-hidden="true"
          className="absolute top-1.5 bottom-1.5 -left-[calc(0.5rem+1.5px)] w-0.5 rounded-md bg-sidebar-active-foreground"
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
    depth === 1 && 'relative h-7.5 pl-2.5 text-[13px]',
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
        <Tooltip content={item.title} side={tooltipSide}>
          {row as ReactElement}
        </Tooltip>
      ) : (
        row
      )}
    </li>
  );
}
