import type { HTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

/** Keyboard key, e.g. <Kbd>Ctrl</Kbd> + <Kbd>B</Kbd>. */
export function Kbd({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-border bg-muted px-1 font-mono text-[11px] font-medium text-muted-foreground',
        className,
      )}
      {...props}
    />
  );
}
