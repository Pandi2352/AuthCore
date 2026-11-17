import { Check, Minus } from 'lucide-react';
import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';

import { cn } from '@/lib/utils';

import {
  fieldErrorMessage,
  FieldMessage,
  resolveInvalid,
  useField,
  useFieldControlProps,
  type FieldError,
} from '../field';
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
  /** Help text under the label (replaced by the error while there is one). */
  hint?: ReactNode;
  /** @deprecated use `hint`. */
  description?: ReactNode;
  /** Message under the checkbox ("Accept the terms to continue"); `true` = invalid only. */
  error?: FieldError;
  invalid?: boolean;
}

/** Native checkbox (keyboard, forms, screen readers for free) with themed visuals. */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  {
    indeterminate = false,
    onCheckedChange,
    onChange,
    label,
    hint,
    description,
    error,
    invalid,
    className,
    ...props
  },
  ref,
) {
  const innerRef = useRef<HTMLInputElement | null>(null);
  const generated = useId();
  const field = useField();
  const id = props.id ?? field?.id ?? generated;
  const help = hint ?? description;
  const message = fieldErrorMessage(error);
  const helpId = help && !message ? `${id}-hint` : undefined;
  const errorId = message ? `${id}-error` : undefined;
  const { invalid: _i, ...a11y } = useFieldControlProps({
    ...props,
    id,
    invalid: resolveInvalid(invalid, error),
    'aria-describedby': cn(props['aria-describedby'], helpId, errorId) || undefined,
  });
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
          'peer size-4 shrink-0 cursor-pointer appearance-none rounded-none border border-input bg-surface transition-colors',
          'checked:border-primary checked:bg-primary indeterminate:border-primary indeterminate:bg-primary focus:border-primary',
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

  const errorEl = message ? <FieldMessage id={errorId}>{message}</FieldMessage> : null;

  if (!label) {
    return errorEl ? (
      <span className="inline-flex flex-col gap-1.5">
        {box}
        {errorEl}
      </span>
    ) : (
      box
    );
  }
  return (
    <span className="inline-flex flex-col gap-1.5">
      <label
        className={cn(
          'inline-flex items-start gap-2.5 text-sm',
          props.disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
        )}
      >
        <span className="mt-0.5">{box}</span>
        <span className="space-y-0.5">
          <span className="block leading-snug font-medium text-foreground">
            {label}
            {props.required && (
              <span className="ml-0.5 text-danger">
                <span aria-hidden="true">*</span>
                <span className="sr-only"> (required)</span>
              </span>
            )}
          </span>
          {help && !message && (
            <span id={helpId} className="block text-xs text-muted-foreground">
              {help}
            </span>
          )}
        </span>
      </label>
      {errorEl}
    </span>
  );
});
