import type { ReactNode } from 'react';

import { appConfig } from '@/config';
import { cn } from '@/lib/utils';

import { AccessDeniedIllustration } from './FeedbackIllustrations';

export interface NoPermissionStateProps {
  title?: string;
  description?: ReactNode;
  action?: ReactNode;
  size?: 'compact' | 'default';
  className?: string;
}

/**
 * 403 / Access Denied feedback state for embedded areas or dedicated permission blocks.
 * Features a custom 3D-faceted security shield and crystal padlock vector illustration,
 * floating status pill, high-contrast typography, and support contact link.
 */
export function NoPermissionState({
  title = "You don't have access",
  description,
  action,
  size = 'default',
  className,
}: NoPermissionStateProps) {
  const support = appConfig.branding.supportEmail;
  const isCompact = size === 'compact';

  return (
    <div
      className={cn(
        'relative isolate flex flex-col items-center justify-center text-center',
        isCompact ? 'gap-2 px-4 py-8' : 'gap-3.5 px-4 py-12',
        className,
      )}
    >
      {/* 3D-faceted security shield and crystal lock illustration */}
      <AccessDeniedIllustration size={size} />

      {/* Floating status badge */}
      {!isCompact && (
        <span className="border-border-base inline-flex items-center justify-center rounded-md border bg-surface px-2.5 py-0.5 text-xs font-bold tracking-wider text-muted-foreground shadow-card">
          403 · Restricted
        </span>
      )}

      {/* Heading */}
      <h2
        className={cn(
          'font-bold tracking-tight text-foreground',
          isCompact ? 'text-base' : 'text-xl sm:text-2xl',
        )}
      >
        {title}
      </h2>

      {/* Description */}
      <div
        className={cn(
          'leading-relaxed text-muted-foreground',
          isCompact ? 'max-w-xs text-xs' : 'max-w-md text-sm',
        )}
      >
        {description ?? (
          <>
            Ask an administrator for access
            {support ? (
              <>
                {' '}
                or contact{' '}
                <a
                  href={`mailto:${support}`}
                  className="cursor-pointer font-medium text-foreground underline underline-offset-4 transition-colors hover:text-primary"
                >
                  {support}
                </a>
              </>
            ) : null}
            .
          </>
        )}
      </div>

      {/* Actions */}
      {action && (
        <div
          className={cn('flex flex-wrap items-center justify-center gap-2', !isCompact && 'mt-2')}
        >
          {action}
        </div>
      )}
    </div>
  );
}
