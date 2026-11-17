import type { ReactNode } from 'react';

/**
 * A field's error from the parent:
 * - string / node → invalid, message shown under the control
 * - true → invalid, no message (e.g. the message is shown elsewhere)
 * - false / null / undefined / '' → valid
 */
export type FieldError = ReactNode | boolean;

export const hasFieldError = (error: FieldError): boolean =>
  error !== undefined && error !== null && error !== false && error !== '';

export const fieldErrorMessage = (error: FieldError): ReactNode =>
  typeof error === 'boolean' ? null : error;

/** `invalid` for the bare control: explicit prop wins, otherwise "has an error". */
export const resolveInvalid = (
  invalid: boolean | undefined,
  error: FieldError,
): boolean | undefined => invalid ?? (hasFieldError(error) || undefined);

/**
 * Field props every reusable control accepts — the parent passes the label, hint and the
 * error message, the control renders them consistently:
 *
 *   <Input label="Email" required hint="We never share it" error={errors.email} />
 *   <Select label="Country" error={errors.country} … />
 */
export interface FieldShellProps {
  label?: ReactNode;
  /** Help text under the control (replaced by the error while there is one). */
  hint?: ReactNode;
  /** Message under the control; `true` = invalid without a message. */
  error?: FieldError;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  /** Classes for the field wrapper (label + control + message), e.g. grid placement. */
  fieldClassName?: string;
}
