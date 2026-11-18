import { Info } from 'lucide-react';
import { useId, type CSSProperties, type ReactNode } from 'react';

import { FieldMessage, Input, Switch, Tooltip } from '@/components/ui';
import { cn } from '@/lib/utils';

import type { PolicyStrength, StrengthLevel } from './policy-rules';

const LEVEL_STROKE: Record<StrengthLevel, string> = {
  weak: 'stroke-danger',
  fair: 'stroke-warning',
  good: 'stroke-info',
  strong: 'stroke-success',
};
const LEVEL_TEXT: Record<StrengthLevel, string> = {
  weak: 'text-danger',
  fair: 'text-warning',
  good: 'text-info',
  strong: 'text-success',
};

/** 270° arc gauge: the policy strength (0–100). */
export function StrengthGauge({
  strength,
  size = 'lg',
}: {
  strength: PolicyStrength;
  size?: 'sm' | 'lg';
}) {
  const isLarge = size === 'lg';
  return (
    <figure
      className={cn('relative shrink-0', isLarge ? 'w-52' : 'w-16')}
      aria-label={`Policy strength ${strength.score} of 100: ${strength.label}`}
    >
      <svg viewBox="0 0 120 104" className="block w-full" aria-hidden="true">
        <path
          d="M 24.64 95.36 A 50 50 0 1 1 95.36 95.36"
          pathLength={100}
          fill="none"
          strokeWidth={isLarge ? 10 : 14}
          strokeLinecap="round"
          className="stroke-muted"
        />
        <path
          d="M 24.64 95.36 A 50 50 0 1 1 95.36 95.36"
          pathLength={100}
          fill="none"
          strokeWidth={isLarge ? 10 : 14}
          strokeLinecap="round"
          strokeDasharray={`${Math.max(strength.score, 1)} 100`}
          className={cn(
            LEVEL_STROKE[strength.level],
            'transition-[stroke-dasharray] duration-500 motion-reduce:transition-none',
          )}
        />
      </svg>
      <figcaption className="absolute inset-0 flex flex-col items-center justify-center pt-1">
        <span
          className={cn(
            'leading-none font-semibold tabular-nums',
            LEVEL_TEXT[strength.level],
            isLarge ? 'text-5xl' : 'text-base',
          )}
        >
          {strength.score}
        </span>
        {isLarge && (
          <span className="mt-1.5 text-sm font-medium text-foreground">
            {strength.label} policy
          </span>
        )}
      </figcaption>
    </figure>
  );
}

/** A titled card holding a group of rule rows. */
export function PolicySection({
  title,
  description,
  icon,
  aside,
  children,
}: {
  title: string;
  description?: string;
  icon: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      aria-label={title}
      className="@container rounded-md border border-border bg-surface p-card"
    >
      <header className="mb-2 flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary-soft-foreground [&_svg]:size-4.5">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {aside}
      </header>
      <div className="divide-y divide-border">{children}</div>
    </section>
  );
}

/** Label + hint on the left, the control on the right (stacked in narrow cards). */
function RuleRow({
  label,
  hint,
  info,
  htmlFor,
  error,
  children,
}: {
  label: string;
  hint?: string;
  info?: string;
  htmlFor?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-2 py-3.5 @xl:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] @xl:items-center @xl:gap-6">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
            {label}
          </label>
          {info && (
            <Tooltip content={info}>
              <button
                type="button"
                aria-label={`About ${label}`}
                className="cursor-pointer rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
              >
                <Info className="size-3.5" aria-hidden="true" />
              </button>
            </Tooltip>
          )}
        </div>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <div className="min-w-0 space-y-1.5">
        {children}
        {error && <FieldMessage>{error}</FieldMessage>}
      </div>
    </div>
  );
}

/** Slider + number box, kept in sync and clamped to min / max. */
export function RangeRow({
  label,
  hint,
  info,
  value,
  min,
  max,
  unit,
  disabled,
  error,
  onChange,
}: {
  label: string;
  hint?: string;
  info?: string;
  value: number;
  min: number;
  max: number;
  /** After the number, e.g. "chars". */
  unit?: string;
  disabled?: boolean;
  error?: string;
  onChange: (value: number) => void;
}) {
  const id = useId();
  const clamp = (next: number) => Math.min(Math.max(Math.round(next), min), max);
  const percent = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <RuleRow label={label} hint={hint} info={info} htmlFor={id} error={error}>
      <div className={cn('flex items-center gap-3', disabled && 'opacity-60')}>
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={1}
          value={value}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-valuetext={unit ? `${value} ${unit}` : String(value)}
          onChange={(e) => onChange(clamp(Number(e.target.value)))}
          style={{ '--fill': `${percent}%` } as CSSProperties}
          className="range-filled h-2 min-w-0 flex-1 cursor-pointer disabled:cursor-not-allowed"
        />
        <Input
          type="number"
          size="sm"
          min={min}
          max={max}
          value={value}
          disabled={disabled}
          invalid={Boolean(error)}
          aria-label={`${label} (number)`}
          onChange={(e) => {
            const next = Number(e.target.value);
            if (e.target.value !== '' && Number.isFinite(next)) onChange(clamp(next));
          }}
          suffix={unit ? <span className="text-xs text-muted-foreground">{unit}</span> : undefined}
          wrapperClassName={unit ? 'w-28 shrink-0' : 'w-20 shrink-0'}
          className={unit ? undefined : 'w-20 shrink-0 text-center tabular-nums'}
        />
      </div>
    </RuleRow>
  );
}

/** A yes / no rule. */
export function SwitchRow({
  label,
  hint,
  info,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  hint?: string;
  info?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  const id = useId();
  return (
    <RuleRow label={label} hint={hint} info={info} htmlFor={id}>
      <div className="flex items-center gap-2">
        <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onChange} />
        <span className="text-xs font-medium text-muted-foreground">{checked ? 'On' : 'Off'}</span>
      </div>
    </RuleRow>
  );
}

/** Any custom control in the row layout. */
export function CustomRow(props: {
  label: string;
  hint?: string;
  info?: string;
  htmlFor?: string;
  error?: string;
  children: ReactNode;
}) {
  return <RuleRow {...props} />;
}
