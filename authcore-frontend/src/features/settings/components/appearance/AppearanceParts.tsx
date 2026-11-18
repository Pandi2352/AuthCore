import { Lock } from 'lucide-react';
import type { ReactNode } from 'react';

import { useTheme } from '@/app/theme';
import { Badge } from '@/components/ui';
import { cn } from '@/lib/utils';

/**
 * One settings card: title, description, current value badge, content. With `lockKeys`,
 * the card turns read-only when the organization locked all of those options.
 */
export function SettingCard({
  title,
  description,
  badge,
  children,
  className,
  lockKeys,
}: {
  title: string;
  description?: string;
  badge?: ReactNode;
  children: ReactNode;
  className?: string;
  lockKeys?: readonly string[];
}) {
  const { isLocked } = useTheme();
  const locked = Boolean(lockKeys?.length) && (lockKeys ?? []).every((key) => isLocked(key));
  return (
    <section
      aria-label={title}
      className={cn(
        'flex flex-col gap-4 rounded-md border border-border bg-surface p-card',
        className,
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
        {locked ? (
          <Badge tone="neutral" className="shrink-0">
            <Lock aria-hidden="true" /> Set by your organization
          </Badge>
        ) : (
          badge !== undefined &&
          badge !== null && (
            <Badge tone="primary" variant="soft" className="shrink-0">
              {badge}
            </Badge>
          )
        )}
      </header>
      {locked ? (
        // Native disabled fieldset: every control inside is read-only for keyboard and mouse.
        <fieldset
          disabled
          className="flex min-w-0 flex-col gap-4 opacity-60 [&_*]:cursor-not-allowed"
        >
          <legend className="sr-only">{title} (locked by your organization)</legend>
          {children}
        </fieldset>
      ) : (
        children
      )}
    </section>
  );
}

/** Radio card: native radio (keyboard, screen readers), visible indicator, optional preview. */
export function ChoiceCard({
  name,
  value,
  checked,
  onSelect,
  title,
  description,
  preview,
  className,
}: {
  name: string;
  value: string;
  checked: boolean;
  onSelect: () => void;
  title: ReactNode;
  description?: ReactNode;
  preview?: ReactNode;
  className?: string;
}) {
  return (
    <label
      className={cn(
        'relative flex min-h-11 cursor-pointer flex-col gap-0.5 rounded-md border p-3 text-left transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring',
        checked
          ? 'border-primary bg-primary-soft'
          : 'border-border bg-surface hover:border-field hover:bg-accent',
        className,
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onSelect}
        className="sr-only"
      />
      <span className="flex items-start justify-between gap-2">
        {preview ? (
          <span className="mb-2 flex min-h-6 min-w-0 flex-1 items-center" aria-hidden="true">
            {preview}
          </span>
        ) : (
          <span className="min-w-0 text-sm font-semibold text-foreground">{title}</span>
        )}
        <span
          aria-hidden="true"
          className={cn(
            'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border bg-surface',
            checked ? 'border-primary' : 'border-input',
          )}
        >
          {checked && <span className="size-2 rounded-full bg-primary" />}
        </span>
      </span>
      {preview && <span className="text-sm font-semibold text-foreground">{title}</span>}
      {description && <span className="text-xs text-muted-foreground">{description}</span>}
    </label>
  );
}

/** A group of choice cards (fieldset + legend; the legend can be a visible sub-heading). */
export function ChoiceGroup({
  legend,
  showLegend = false,
  columns = 2,
  children,
}: {
  legend: string;
  showLegend?: boolean;
  columns?: 2 | 3;
  children: ReactNode;
}) {
  return (
    <fieldset className="min-w-0">
      <legend
        className={
          showLegend
            ? 'mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase'
            : 'sr-only'
        }
      >
        {legend}
      </legend>
      <div className={cn('grid gap-2', columns === 3 ? 'grid-cols-3' : 'grid-cols-2')}>
        {children}
      </div>
    </fieldset>
  );
}
