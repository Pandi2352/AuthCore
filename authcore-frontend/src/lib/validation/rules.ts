/**
 * Small form validation (no library). A rule gets the field value and all form values and
 * returns an error message, or undefined when the value is fine.
 *
 *   const rules: FormRules<typeof values> = {
 *     email: [required('Enter your email'), email()],
 *     confirmPassword: [required('Confirm the password'), matches('password', 'Passwords do not match')],
 *   };
 *
 * Optional fields: leave out `required` — the other rules skip empty values.
 * Messages are written for users ("Enter your email"), not "email is required".
 */
export type Rule<V = Record<string, unknown>> = (value: unknown, values: V) => string | undefined;

export type FormRules<V> = { [K in keyof V]?: ReadonlyArray<Rule<V>> };

export type FormErrors<V> = { [K in keyof V]?: string };

/** Empty: undefined, null, '' / whitespace only, false (unchecked), []. */
export function isEmpty(value: unknown): boolean {
  if (value === undefined || value === null || value === false) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

const text = (value: unknown): string => (typeof value === 'string' ? value : String(value ?? ''));

/** Rule that only runs when the field has a value (so optional fields stay optional). */
const whenFilled =
  <V>(check: (value: string, values: V) => string | undefined): Rule<V> =>
  (value, values) =>
    isEmpty(value) ? undefined : check(text(value), values);

export const required =
  <V>(message = 'This field is required'): Rule<V> =>
  (value) =>
    isEmpty(value) ? message : undefined;

/** Same check as the backend's @IsEmail in practice: one @, a dot in the domain, no spaces. */
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

export const email = <V>(message = 'Enter a valid email address'): Rule<V> =>
  whenFilled((value) => (EMAIL_PATTERN.test(value.trim()) ? undefined : message));

export const minLength = <V>(min: number, message?: string): Rule<V> =>
  whenFilled((value) =>
    value.length >= min ? undefined : (message ?? `Use at least ${min} characters`),
  );

export const maxLength = <V>(max: number, message?: string): Rule<V> =>
  whenFilled((value) =>
    value.length <= max ? undefined : (message ?? `Use at most ${max} characters`),
  );

export const pattern = <V>(regex: RegExp, message: string): Rule<V> =>
  whenFilled((value) => (regex.test(value.trim()) ? undefined : message));

/** Must equal another field (confirm password). Checked even when the other field is empty. */
export const matches = <V>(field: keyof V, message = 'The values do not match'): Rule<V> =>
  whenFilled((value, values) => (value === values[field] ? undefined : message));

/** Any condition: `custom((v, all) => …, 'message')`. */
export const custom =
  <V>(isValid: (value: unknown, values: V) => boolean, message: string): Rule<V> =>
  (value, values) =>
    isEmpty(value) || isValid(value, values) ? undefined : message;

/** First failing rule per field. */
export function validateValues<V>(values: V, rules: FormRules<V>): FormErrors<V> {
  const errors: FormErrors<V> = {};
  for (const field of Object.keys(rules) as Array<keyof V>) {
    for (const rule of rules[field] ?? []) {
      const message = rule(values[field], values);
      if (message) {
        errors[field] = message;
        break;
      }
    }
  }
  return errors;
}
