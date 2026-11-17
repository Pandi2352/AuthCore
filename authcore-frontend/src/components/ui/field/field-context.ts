import { createContext, useContext, type AriaAttributes } from 'react';

import { cn } from '@/lib/utils';

export interface FieldContextValue {
  id: string;
  descriptionId?: string;
  errorId?: string;
  invalid: boolean;
  required: boolean;
  disabled: boolean;
}
export const FieldContext = createContext<FieldContextValue | null>(null);

/** Inside a <Field>: ids and states for the control (Input, Select, Textarea, Checkbox …). */
export function useField(): FieldContextValue | null {
  return useContext(FieldContext);
}

/** aria / id props a control should apply (explicit props win). */
export function useFieldControlProps(props: {
  id?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: AriaAttributes['aria-invalid'];
  invalid?: boolean;
  required?: boolean;
  disabled?: boolean;
}) {
  const field = useField();
  const invalid =
    props.invalid ??
    (props['aria-invalid'] === true ||
      props['aria-invalid'] === 'true' ||
      (field?.invalid ?? false));
  const describedBy =
    cn(
      props['aria-describedby'],
      field?.descriptionId,
      field?.invalid ? field.errorId : undefined,
    ) || undefined;
  return {
    id: props.id ?? field?.id,
    'aria-describedby': describedBy,
    'aria-invalid': invalid || undefined,
    required: props.required ?? (field?.required || undefined),
    disabled: props.disabled ?? (field?.disabled || undefined),
    invalid,
  };
}
