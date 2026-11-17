import { Lock } from 'lucide-react';
import type { ReactNode } from 'react';

import { appConfig } from '@/config';
import { cn } from '@/lib/utils';

export interface NoPermissionStateProps {
  title?: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

/** 403 for part of a page (a card, a tab) — the rest of the page stays usable. */
export function NoPermissionState({
  title = "You don't have access",
  description,
  action,
  className,
}: NoPermissionStateProps) {
  const support = appConfig.branding.supportEmail;
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 px-4 py-12 text-center',
        className,
      )}
    >
      <div
        className="flex size-12 items-center justify-center rounded-md bg-muted text-muted-foreground [&_svg]:size-6"
        aria-hidden="true"
      >
        <Lock />
      </div>
      <p className="text-base font-semibold text-foreground">{title}</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        {description ?? (
          <>
            Ask an administrator for access
            {support ? (
              <>
                {' '}
                or contact{' '}
                <a
                  href={`mailto:${support}`}
                  className="cursor-pointer text-primary underline-offset-4 hover:underline"
                >
                  {support}
                </a>
              </>
            ) : null}
            .
          </>
        )}
      </p>
      {action}
    </div>
  );
}
