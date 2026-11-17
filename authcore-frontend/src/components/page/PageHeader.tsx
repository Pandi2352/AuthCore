import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export interface PageHeaderProps {
  /** The page's h1 (focus moves here after navigation). */
  title: ReactNode;
  description?: ReactNode;
  /** Buttons on the right; they wrap below the title on small screens. */
  actions?: ReactNode;
  /** Above the title, e.g. breadcrumbs or a back link (see `back`). */
  breadcrumbs?: ReactNode;
  /** Back link above the title: an element (router <Link>) or href + label for plain links. */
  back?: ReactNode;
  /** Next to the title, e.g. a status badge. */
  meta?: ReactNode;
  className?: string;
}

/** Page title block: breadcrumbs / back link, h1, description, actions. */
export function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
  back,
  meta,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn('flex flex-col gap-3', className)}>
      {breadcrumbs}
      {back && (
        <div className="inline-flex items-center gap-1 text-sm text-muted-foreground [&_a]:inline-flex [&_a]:cursor-pointer [&_a]:items-center [&_a]:gap-1 [&_a]:rounded-md [&_a:hover]:text-foreground">
          <ArrowLeft className="size-4" aria-hidden="true" />
          {back}
        </div>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight break-words text-foreground">
              {title}
            </h1>
            {meta}
          </div>
          {description && <p className="max-w-3xl text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
