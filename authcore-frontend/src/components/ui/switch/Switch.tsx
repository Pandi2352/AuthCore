import { forwardRef, useId, type ButtonHTMLAttributes, type ReactNode } from 'react';

import { useControllableState } from '@/hooks/useControllableState';
import { cn } from '@/lib/utils';

import {
  fieldErrorMessage,
  FieldMessage,
  resolveInvalid,
  useField,
  useFieldControlProps,
  type FieldError,
} from '../field';

export interface SwitchProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'onChange' | 'value'
> {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  size?: 'sm' | 'md';
  label?: ReactNode;
  /** Help text under the label (replaced by the error while there is one). */
  hint?: ReactNode;
  /** @deprecated use `hint`. */
  description?: ReactNode;
  /** Message under the switch; `true` = invalid only. */
  error?: FieldError;
  invalid?: boolean;
  required?: boolean;
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
    hint,
    description,
    error,
    invalid,
    required,
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
  const generated = useId();
  const field = useField();
  const id = props.id ?? field?.id ?? generated;
  const help = hint ?? description;
  const message = fieldErrorMessage(error);
  const helpId = help && !message ? `${id}-hint` : undefined;
  const errorId = message ? `${id}-error` : undefined;
  const {
    invalid: _i,
    required: _r,
    ...a11y
  } = useFieldControlProps({
    ...props,
    id,
    invalid: resolveInvalid(invalid, error),
    'aria-describedby': cn(props['aria-describedby'], helpId, errorId) || undefined,
  });
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
        'touch-target inline-flex shrink-0 cursor-pointer items-center rounded-md border-2 border-transparent bg-input p-0 transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        'disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger data-[state=checked]:bg-primary',
        TRACK[size],
        className,
      )}
      {...props}
      {...a11y}
      aria-required={required || undefined}
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

  const errorEl = message ? <FieldMessage id={errorId}>{message}</FieldMessage> : null;
  if (!label) {
    return errorEl ? (
      <span className="inline-flex flex-col gap-1.5">
        {control}
        {errorEl}
      </span>
    ) : (
      control
    );
  }
  return (
    <div className="space-y-1.5">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-0.5">
          <label
            htmlFor={id}
            className="block cursor-pointer text-sm leading-snug font-medium text-foreground"
          >
            {label}
            {required && (
              <span className="ml-0.5 text-danger">
                <span aria-hidden="true">*</span>
                <span className="sr-only"> (required)</span>
              </span>
            )}
          </label>
          {help && !message && (
            <p id={helpId} className="text-xs text-muted-foreground">
              {help}
            </p>
          )}
        </div>
        {control}
      </div>
      {errorEl}
    </div>
  );
});
