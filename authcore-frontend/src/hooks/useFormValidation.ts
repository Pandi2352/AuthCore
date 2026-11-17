import { useCallback, useState } from 'react';

import { validateValues, type FormErrors, type FormRules } from '@/lib/validation';

const FOCUSABLE = 'input, textarea, select, button, [tabindex]:not([tabindex="-1"])';

/**
 * Client-side validation for a form. Errors appear under the fields after the first submit
 * attempt, then follow the values live (fixing a field clears its error as you type).
 *
 *   const v = useFormValidation({ email, password }, rules);
 *   const onSubmit = (e: FormEvent<HTMLFormElement>) => {
 *     e.preventDefault();
 *     if (!v.validate(e.currentTarget)) return;   // shows errors + focuses the first invalid field
 *     …call the API…
 *   };
 *   <form noValidate onSubmit={onSubmit}>
 *     <Input label="Email" error={v.error('email') ?? fieldError('email')} … />
 *
 * Combine with useApiError: the client error wins, the server's field error shows otherwise.
 * `rules` should be stable (module constant or useMemo) when it depends on nothing.
 */
export function useFormValidation<V>(values: V, rules: FormRules<V>) {
  const [showErrors, setShowErrors] = useState(false);

  // Derived on every render: cheap, and always in sync with the current values.
  const current = validateValues(values, rules);
  const errors: FormErrors<V> = showErrors ? current : {};
  const isValid = Object.keys(current).length === 0;

  const validate = useCallback(
    (form?: HTMLFormElement | null): boolean => {
      setShowErrors(true);
      if (isValid) return true;
      if (form) {
        // After React renders aria-invalid on the fields, focus the first one.
        requestAnimationFrame(() => {
          const invalid = form.querySelector<HTMLElement>('[aria-invalid="true"]');
          const target = invalid?.matches(FOCUSABLE)
            ? invalid
            : invalid?.querySelector<HTMLElement>(FOCUSABLE);
          target?.focus();
        });
      }
      return false;
    },
    [isValid],
  );

  const reset = useCallback(() => setShowErrors(false), []);

  const error = (field: keyof V): string | undefined => errors[field];

  return { errors, error, isValid, validate, reset, submitted: showErrors };
}
