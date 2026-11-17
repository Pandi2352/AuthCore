import { ChevronRight, LayoutGrid } from 'lucide-react';
import { Link, useMatches } from 'react-router-dom';

import { Badge } from '@/components/ui';
import { icons, isFeatureEnabled, navigationConfig } from '@/config';
import type { NavItem } from '@/types/navigation.types';

import { StatusPage } from './StatusPage';

const visible = (item: NavItem) =>
  !item.hidden && (!item.featureFlag || isFeatureEnabled(item.featureFlag));

/** Overview of a navigation group whose pages are being built (e.g. /admin). */
export function PlannedModulePage() {
  const matches = useMatches();
  const handle = (matches[matches.length - 1]?.handle ?? {}) as {
    title?: string;
    description?: string;
    navGroupId?: string;
  };
  const group = navigationConfig.find((g) => g.id === handle.navGroupId);
  const items = (group?.items ?? []).filter(visible);

  return (
    <div>
      <StatusPage
        icon={<LayoutGrid aria-hidden="true" />}
        title={handle.title ?? group?.title ?? 'Module'}
        description={handle.description}
      />
      <ul className="mx-auto grid max-w-4xl gap-3 sm:grid-cols-2">
        {items.map((item) => {
          const Icon = item.icon ? icons[item.icon] : null;
          const target = item.path ?? item.children?.find((c) => c.path && visible(c))?.path;
          const body = (
            <>
              {Icon && (
                <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary-soft-foreground">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 font-medium text-foreground">
                  {item.title}
                  {item.status === 'planned' && <Badge size="sm">Planned</Badge>}
                </span>
                {item.children && (
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {item.children
                      .filter(visible)
                      .map((c) => c.title)
                      .join(' · ')}
                  </span>
                )}
              </span>
              {target && (
                <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
              )}
            </>
          );
          return (
            <li key={item.id}>
              {target ? (
                <Link
                  to={target}
                  className="flex cursor-pointer items-center gap-3 rounded-md border border-border bg-surface p-4 transition-colors hover:bg-accent"
                >
                  {body}
                </Link>
              ) : (
                <div className="flex items-center gap-3 rounded-md border border-border bg-surface p-4">
                  {body}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
