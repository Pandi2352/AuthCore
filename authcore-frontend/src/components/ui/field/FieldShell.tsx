import type { ReactNode } from 'react';

import { Field } from './Field';
import { useField } from './field-context';
import { hasFieldError, type FieldShellProps } from './field-props';

/**
 * Wraps a control in a <Field> when it has a label / hint / error and isn't already inside
 * one. Inside a <Field> (or with none of them) the control renders bare.
 */
export function FieldShell({
  label,
  hint,
  error,
  required,
  disabled,
  id,
  fieldClassName,
  children,
}: FieldShellProps & { children: ReactNode }) {
  const inField = useField() !== null;
  const needsField =
    !inField && (label !== undefined || hint !== undefined || hasFieldError(error));
  if (!needsField) return <>{children}</>;
  return (
    <Field
      label={label}
      hint={hint}
      error={error}
      required={required}
      disabled={disabled}
      id={id}
      className={fieldClassName}
    >
      {children}
    </Field>
  );
}
