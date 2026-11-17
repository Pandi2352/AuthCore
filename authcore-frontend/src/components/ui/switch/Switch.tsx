import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

import { useControllableState } from '@/hooks/useControllableState';
import { cn } from '@/lib/utils';

import { useFieldControlProps } from '../field';

export interface SwitchProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'onChange' | 'value'
> {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  size?: 'sm' | 'md';
  label?: ReactNode;
  description?: ReactNode;
  /** Submitted with forms as `name=on` when checked. */
  name?: string;
}

const TRACK = { sm: 'h-5 w-9', md: 'h-6 w-11' } as const;
const THUMB = {
  sm: 'size-4 data-[state=checked]:translate-x-4',
  md: 'size-5 data-[state=checked]:translate-x-5',
} as const;

/** On / off toggle (role="switch"): Space / Enter toggle, state announced. */
export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(function Switch(
  {
    checked,
    defaultChecked = false,
    onCheckedChange,
    size = 'md',
    label,
    description,
    name,
    className,
    onClick,
    ...props
  },
  ref,
) {
  const [isOn, setOn] = useControllableState({
    value: checked,
    defaultValue: defaultChecked,
    onChange: onCheckedChange,
  });
  const { invalid: _i, required: _r, ...a11y } = useFieldControlProps(props);
  void _i;
  void _r;
  const state = isOn ? 'checked' : 'unchecked';

  const control = (
    <button
      ref={ref}
      type="button"
      role="switch"
      aria-checked={isOn}
      data-state={state}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) setOn(!isOn);
      }}
      className={cn(
        'inline-flex shrink-0 cursor-pointer items-center rounded-md border-2 border-transparent bg-input p-0 transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        'disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary',
        TRACK[size],
        className,
      )}
      {...props}
      {...a11y}
    >
      <span
        data-state={state}
        className={cn(
          'pointer-events-none block rounded-md bg-surface transition-transform',
          THUMB[size],
        )}
      />
      {name && isOn && <input type="hidden" name={name} value="on" />}
    </button>
  );

  if (!label) return control;
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-0.5">
        <label
          htmlFor={a11y.id}
          className="block cursor-pointer text-sm leading-snug font-medium text-foreground"
        >
          {label}
        </label>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      {control}
    </div>
  );
});
