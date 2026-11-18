import type { ReactNode } from 'react';

import { appConfig } from '@/config';
import { cn } from '@/lib/utils';

import { StatusGeometricFlanks } from './StatusGeometricFlanks';

/**
 * Shared layout for 403 / 404 / error / planned status pages.
 * Features symmetrical frosted-glass geometric crystal wings, luminous light backdrop,
 * floating code badge, prominent heading, actions, and support link.
 *
 * Everything is drawn with theme tokens (no images): the background, crystal flanks and text
 * follow the color preset and light / dark mode automatically.
 * Expands to full available viewport height so no bottom gap or dark letterboxing occurs.
 */
export function StatusPage({
  icon,
  code,
  title,
  description,
  actions,
  children,
  fullScreen = false,
  showSupportLink = true,
}: {
  icon?: ReactNode;
  code?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  fullScreen?: boolean;
  showSupportLink?: boolean;
}) {
  return (
    <div
      // Inside the app layout the background runs edge to edge: MainContent drops its
      // padding / max width while a [data-full-bleed] page is shown.
      data-full-bleed={fullScreen ? undefined : ''}
      className={cn(
        'relative isolate flex w-full flex-1 flex-col items-center justify-center overflow-hidden bg-background px-4 py-16 text-center text-foreground',
        fullScreen ? 'min-h-dvh' : 'min-h-[calc(100dvh-var(--navbar-height))]',
      )}
    >
      {/* Symmetrical frosted-glass geometric crystal flanks & backdrop */}
      <StatusGeometricFlanks />

      {/* Main Content Stage */}
      <div className="relative z-10 mx-auto flex max-w-xl flex-col items-center">
        {/* Optional 3D Vector Illustration */}
        {icon && <div className="mb-3 flex items-center justify-center">{icon}</div>}

        {/* Floating Code Pill */}
        {code && (
          <div className="mb-4 inline-flex items-center justify-center rounded-md border border-border bg-surface/90 px-3.5 py-1 text-xs font-bold tracking-wider text-muted-foreground shadow-card backdrop-blur-md">
            {code}
          </div>
        )}

        {/* Primary Heading */}
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl md:text-5xl">
          {title}
        </h1>

        {/* Description */}
        {description && (
          <div className="mt-3.5 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
            {description}
          </div>
        )}

        {/* Optional children (e.g. error diagnostics / reference codes) */}
        {children}

        {/* Action Buttons */}
        {actions && (
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">{actions}</div>
        )}

        {/* Support Link */}
        {showSupportLink && (
          <div className="mt-8 text-xs text-muted-foreground sm:text-sm">
            Need help?{' '}
            <a
              href={
                appConfig.branding.supportEmail
                  ? `mailto:${appConfig.branding.supportEmail}`
                  : `mailto:support@${appConfig.slug}.local`
              }
              className="cursor-pointer font-medium text-foreground underline underline-offset-4 transition-colors hover:text-primary"
            >
              Contact Us
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
