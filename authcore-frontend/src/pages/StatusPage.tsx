import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/** Shared layout for 403 / 404 / error / planned pages (inside a layout or full-screen). */
export function StatusPage({
  icon,
  code,
  title,
  description,
  actions,
  children,
  fullScreen = false,
}: {
  icon?: ReactNode;
  code?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  fullScreen?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center px-4 text-center',
        fullScreen ? 'min-h-dvh bg-background py-12' : 'py-16',
      )}
    >
      {icon && (
        <div className="mb-5 flex size-14 items-center justify-center rounded-md bg-primary-soft text-primary-soft-foreground [&_svg]:size-7">
          {icon}
        </div>
      )}
      {code && <p className="text-sm font-semibold tracking-wide text-primary">{code}</p>}
      <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        {title}
      </h1>
      {description && <p className="mt-3 max-w-md text-sm text-muted-foreground">{description}</p>}
      {children}
      {actions && (
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">{actions}</div>
      )}
    </div>
  );
}
