import { Check, Minus } from 'lucide-react';
import { forwardRef, useEffect, useRef, type InputHTMLAttributes, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

import { useFieldControlProps } from '../field';
import { composeRefs } from '../primitives/compose';

export interface CheckboxProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'onChange'
> {
  checked?: boolean;
  defaultChecked?: boolean;
  /** "Some selected" state (e.g. a select-all header checkbox). */
  indeterminate?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  onChange?: InputHTMLAttributes<HTMLInputElement>['onChange'];
  label?: ReactNode;
  description?: ReactNode;
  invalid?: boolean;
}

/** Native checkbox (keyboard, forms, screen readers for free) with themed visuals. */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  {
    indeterminate = false,
    onCheckedChange,
    onChange,
    label,
    description,
    invalid,
    className,
    ...props
  },
  ref,
) {
  const innerRef = useRef<HTMLInputElement | null>(null);
  const { invalid: _i, ...a11y } = useFieldControlProps({ ...props, invalid });
  void _i;
  useEffect(() => {
    if (innerRef.current) innerRef.current.indeterminate = indeterminate;
  }, [indeterminate]);

  const box = (
    <span className="relative inline-flex size-4 shrink-0 items-center justify-center">
      <input
        ref={composeRefs(ref, innerRef)}
        type="checkbox"
        aria-checked={indeterminate ? 'mixed' : undefined}
        onChange={(event) => {
          onChange?.(event);
          onCheckedChange?.(event.target.checked);
        }}
        className={cn(
          'peer size-4 shrink-0 cursor-pointer appearance-none rounded-md border border-input bg-surface transition-colors',
          'checked:border-primary checked:bg-primary indeterminate:border-primary indeterminate:bg-primary',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
          'disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger',
          className,
        )}
        {...props}
        {...a11y}
      />
      <Check
        className="pointer-events-none absolute size-3 text-primary-foreground opacity-0 peer-checked:opacity-100 peer-indeterminate:opacity-0"
        strokeWidth={3}
        aria-hidden="true"
      />
      <Minus
        className="pointer-events-none absolute size-3 text-primary-foreground opacity-0 peer-indeterminate:opacity-100"
        strokeWidth={3}
        aria-hidden="true"
      />
    </span>
  );

  if (!label) return box;
  return (
    <label
      className={cn(
        'inline-flex items-start gap-2.5 text-sm',
        props.disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
      )}
    >
      <span className="mt-0.5">{box}</span>
      <span className="space-y-0.5">
        <span className="block leading-snug font-medium text-foreground">{label}</span>
        {description && <span className="block text-xs text-muted-foreground">{description}</span>}
      </span>
    </label>
  );
});
