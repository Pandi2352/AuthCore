import { useOptionalTheme } from '@/app/theme';
import { appConfig } from '@/config';
import { cn } from '@/lib/utils';

export interface LogoProps {
  /** full: logo (or mark + name); mark: square mark only (collapsed sidebar). */
  variant?: 'full' | 'mark';
  /** Hide the app name next to the mark when there is no full logo image. */
  hideName?: boolean;
  className?: string;
}

/**
 * Project logo from app.config.ts: light / dark image per mode, the square mark when
 * collapsed, or the app's initial + name when no images are configured.
 */
export function Logo({ variant = 'full', hideName = false, className }: LogoProps) {
  const theme = useOptionalTheme();
  const isDark = theme?.resolvedMode === 'dark';
  const { logos, name } = appConfig;
  const fullImage = isDark ? (logos.dark ?? logos.light) : logos.light;

  if (variant === 'full' && fullImage) {
    return <img src={fullImage} alt={name} className={cn('h-8 w-auto', className)} />;
  }
  const mark = logos.mark ? (
    <img
      src={logos.mark}
      alt={variant === 'mark' || hideName ? name : ''}
      className="size-8 shrink-0 rounded-md"
    />
  ) : (
    <span
      aria-hidden={!(variant === 'mark' || hideName)}
      aria-label={variant === 'mark' || hideName ? name : undefined}
      role={variant === 'mark' || hideName ? 'img' : undefined}
      className="inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-base font-black text-primary-foreground"
    >
      {name.charAt(0)}
    </span>
  );
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-2', className)}>
      {mark}
      {variant === 'full' && !hideName && (
        <span className="truncate text-base font-bold text-foreground">{name}</span>
      )}
    </span>
  );
}
