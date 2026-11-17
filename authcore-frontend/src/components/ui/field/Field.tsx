import { useId, useMemo, type HTMLAttributes, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

import { Label } from '../label';
import { FieldContext } from './field-context';

export interface FieldProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  label?: ReactNode;
  /** Help text under the control (hidden while there is an error). */
  description?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  disabled?: boolean;
  /** Control id (generated when omitted). */
  id?: string;
  /** Label next to the control (checkbox / switch rows). */
  orientation?: 'vertical' | 'horizontal';
  children: ReactNode;
}

/** Label + control + description + error, wired together with ids and aria attributes. */
export function Field({
  label,
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
  const descriptionId = description ? `${controlId}-description` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const invalid = Boolean(error);
  const value = useMemo(
    () => ({ id: controlId, descriptionId, errorId, invalid, required, disabled }),
    [controlId, descriptionId, errorId, invalid, required, disabled],
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
        {...props}
      >
        {orientation === 'horizontal' ? (
          <>
            <div className="min-w-0 space-y-0.5">
              {label && (
                <Label htmlFor={controlId} required={required} disabled={disabled}>
                  {label}
                </Label>
              )}
              {description && !error && (
                <p id={descriptionId} className="text-xs text-muted-foreground">
                  {description}
                </p>
              )}
            </div>
            {children}
          </>
        ) : (
          <>
            {label && (
              <Label htmlFor={controlId} required={required} disabled={disabled}>
                {label}
              </Label>
            )}
            {children}
            {description && !error && (
              <p id={descriptionId} className="text-xs text-muted-foreground">
                {description}
              </p>
            )}
          </>
        )}
        {error && (
          <p id={errorId} role="alert" className="text-xs font-medium text-danger">
            {error}
          </p>
        )}
      </div>
    </FieldContext.Provider>
  );
}
