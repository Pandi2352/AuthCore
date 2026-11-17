import { Inbox } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  /** Primary action, e.g. <Button>Invite user</Button>. */
  action?: ReactNode;
  /** Secondary action / link. */
  secondaryAction?: ReactNode;
  /** compact: inside cards / tables · default: page area. */
  size?: 'compact' | 'default';
  className?: string;
}

/** "Nothing here yet" — always say why and what to do next. */
export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  size = 'default',
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        size === 'compact' ? 'gap-2 px-4 py-8' : 'gap-3 px-4 py-16',
        className,
      )}
    >
      <div
        className={cn(
          'flex items-center justify-center rounded-md bg-muted text-muted-foreground',
          size === 'compact' ? 'size-10 [&_svg]:size-5' : 'size-12 [&_svg]:size-6',
        )}
        aria-hidden="true"
      >
        {icon ?? <Inbox />}
      </div>
      <p
        className={cn(
          'font-semibold text-foreground',
          size === 'compact' ? 'text-sm' : 'text-base',
        )}
      >
        {title}
      </p>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {(action || secondaryAction) && (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}
