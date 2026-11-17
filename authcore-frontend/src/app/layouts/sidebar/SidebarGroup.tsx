import { useId } from 'react';

import { cn } from '@/lib/utils';
import type { NavGroup } from '@/types/navigation.types';

import { useSidebarMode } from './sidebar-mode';
import { SidebarItem } from './SidebarItem';
import { SidebarSubmenu } from './SidebarSubmenu';

/** Group label + its items (label becomes a divider when collapsed). */
export function SidebarGroup({ group }: { group: NavGroup }) {
  const labelId = useId();
  const { collapsed, variant } = useSidebarMode();
  return (
    <div role="group" aria-labelledby={group.title ? labelId : undefined} className="space-y-0.5">
      {group.title &&
        (collapsed ? (
          <div className="mx-3 my-2 h-px bg-sidebar-border" id={labelId} aria-label={group.title} />
        ) : (
          <p
            id={labelId}
            className={cn(
              'px-3 pt-3 pb-1 text-[11px] font-semibold tracking-wider text-sidebar-muted uppercase',
              variant === 'compact' && 'pt-2',
            )}
          >
            {group.title}
          </p>
        ))}
      <ul className="space-y-0.5">
        {group.items.map((item) =>
          item.children?.length ? (
            <SidebarSubmenu key={item.id} item={item} />
          ) : (
            <SidebarItem key={item.id} item={item} />
          ),
        )}
      </ul>
    </div>
  );
}
