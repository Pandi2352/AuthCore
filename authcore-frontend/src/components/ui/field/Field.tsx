import { AlertCircle } from 'lucide-react';
import { useId, useMemo, type HTMLAttributes, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

import { Label } from '../label';
import { FieldContext } from './field-context';
import { fieldErrorMessage, hasFieldError, type FieldError } from './field-props';

export interface FieldProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  label?: ReactNode;
  /** Help text under the control (replaced by the error while there is one). */
  hint?: ReactNode;
  /** @deprecated use `hint` (same thing). */
  description?: ReactNode;
  error?: FieldError;
  required?: boolean;
  disabled?: boolean;
  /** Control id (generated when omitted). */
  id?: string;
  /** Label next to the control (checkbox / switch rows). */
  orientation?: 'vertical' | 'horizontal';
  children: ReactNode;
}

/**
 * Label + control + hint + error, wired together with ids and aria attributes: the control
 * (Input, Select, Textarea …) reads id, aria-describedby, aria-invalid, required and disabled
 * from the field. Every reusable control also accepts label / hint / error itself, so most
 * forms never use <Field> directly.
 */
export function Field({
  label,
  hint,
  description,
  error,
  required = false,
  disabled = false,
  id,
  orientation = 'vertical',
  className,
  children,
  ...props
}: FieldProps) {
  const generated = useId();
  const controlId = id ?? generated;
  const help = hint ?? description;
  const invalid = hasFieldError(error);
  const message = invalid ? fieldErrorMessage(error) : null;
  const descriptionId = help ? `${controlId}-description` : undefined;
  const errorId = message ? `${controlId}-error` : undefined;
  const value = useMemo(
    () => ({ id: controlId, descriptionId, errorId, invalid, required, disabled }),
    [controlId, descriptionId, errorId, invalid, required, disabled],
  );

  const helpText = help && !message && (
    <p id={descriptionId} className="text-xs text-muted-foreground">
      {help}
    </p>
  );
  const labelEl = label && (
    <Label htmlFor={controlId} required={required} disabled={disabled}>
      {label}
    </Label>
  );

  return (
    <FieldContext.Provider value={value}>
      <div
        className={cn(
          orientation === 'horizontal'
            ? 'flex items-start justify-between gap-4'
            : 'flex flex-col gap-1.5',
          'w-full',
          className,
        )}
        data-invalid={invalid || undefined}
        data-disabled={disabled || undefined}
        {...props}
      >
        {orientation === 'horizontal' ? (
          <>
            <div className="min-w-0 space-y-0.5">
              {labelEl}
              {helpText}
            </div>
            {children}
          </>
        ) : (
          <>
            {labelEl}
            {children}
            {helpText}
          </>
        )}
        {message && <FieldMessage id={errorId}>{message}</FieldMessage>}
      </div>
    </FieldContext.Provider>
  );
}

/** The red message under a control (role="alert" so it is announced when it appears). */
export function FieldMessage({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} role="alert" className="flex items-start gap-1.5 text-xs font-medium text-danger">
      <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}
