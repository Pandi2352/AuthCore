import { useOptionalTheme } from '@/app/theme';
import { appConfig } from '@/config';
import { useBranding } from '@/hooks';
import { cn } from '@/lib/utils';

export interface LogoProps {
  /**
   * full: logo (or mark + name) — expanded sidebar, navbar.
   * mark: square mark only — collapsed sidebar.
   * auth: sign-in / sign-up pages (their own logo, else the full logo).
   */
  variant?: 'full' | 'mark' | 'auth';
  /** Hide the site name next to the mark when there is no full logo image. */
  hideName?: boolean;
  /** An uploaded logo image uses the full width, centred (sidebar header). */
  fill?: boolean;
  className?: string;
}

/**
 * Project logo. Images and name come from Business settings (uploaded by an admin), falling
 * back to app.config.ts (light / dark images, mark) and finally to the site's initial + name.
 */
export function Logo({ variant = 'full', hideName = false, fill = false, className }: LogoProps) {
  const theme = useOptionalTheme();
  const { siteName, assets } = useBranding();
  const isDark = theme?.resolvedMode === 'dark';
  const { logos } = appConfig;
  const configFull = isDark ? (logos.dark ?? logos.light) : logos.light;
  const fullImage =
    variant === 'auth'
      ? (assets.authLogo ?? assets.logo ?? configFull)
      : (assets.logo ?? configFull);
  const markImage = assets.logoMark ?? logos.mark;
  const labelled = variant === 'mark' || hideName;

  if (variant !== 'mark' && fullImage) {
    return (
      <img
        src={fullImage}
        alt={siteName}
        className={cn(
          fill
            ? 'h-10 w-full object-contain object-center'
            : 'h-8 w-auto max-w-48 object-contain object-left',
          className,
        )}
      />
    );
  }
  const mark = markImage ? (
    <img
      src={markImage}
      alt={labelled ? siteName : ''}
      className="size-8 shrink-0 rounded-md object-contain"
    />
  ) : (
    <span
      aria-hidden={!labelled}
      aria-label={labelled ? siteName : undefined}
      role={labelled ? 'img' : undefined}
      className="inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-base font-black text-primary-foreground"
    >
      {siteName.trim().charAt(0).toUpperCase()}
    </span>
  );
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-2', className)}>
      {mark}
      {variant !== 'mark' && !hideName && (
        <span className="truncate text-base font-bold text-foreground">{siteName}</span>
      )}
    </span>
  );
}
