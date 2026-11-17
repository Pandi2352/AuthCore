import {
  createContext,
  useContext,
  useId,
  useMemo,
  type HTMLAttributes,
  type ReactNode,
} from 'react';

import { useControllableState } from '@/hooks/useControllableState';
import { cn } from '@/lib/utils';

import {
  fieldErrorMessage,
  FieldMessage,
  resolveInvalid,
  useField,
  type FieldError,
} from '../field';

interface RadioContextValue {
  name: string;
  value: string | undefined;
  setValue: (value: string) => void;
  disabled: boolean;
  invalid: boolean;
}
const RadioContext = createContext<RadioContextValue | null>(null);

export interface RadioOption {
  value: string;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}

export interface RadioGroupProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'onChange' | 'defaultValue'
> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Form field name (generated when omitted). */
  name?: string;
  options?: RadioOption[];
  orientation?: 'vertical' | 'horizontal';
  disabled?: boolean;
  invalid?: boolean;
  /** Group label (rendered above the options; used as the radiogroup's name). */
  label?: ReactNode;
  /** Help text under the options (replaced by the error while there is one). */
  hint?: ReactNode;
  /** Message under the options ("Choose a plan"); `true` = invalid only. */
  error?: FieldError;
  required?: boolean;
  children?: ReactNode;
}

/**
 * Native radio inputs (arrow keys move and select, one tab stop) with themed visuals.
 * Pass `options`, or compose <RadioGroupItem> children.
 */
export function RadioGroup({
  value,
  defaultValue,
  onValueChange,
  name,
  options,
  orientation = 'vertical',
  disabled = false,
  invalid,
  label,
  hint,
  error,
  required = false,
  className,
  children,
  ...props
}: RadioGroupProps) {
  const generated = useId();
  const field = useField();
  const [current, setValue] = useControllableState<string | undefined>({
    value,
    defaultValue,
    onChange: (next) => next !== undefined && onValueChange?.(next),
  });
  const isInvalid = resolveInvalid(invalid, error) ?? field?.invalid ?? false;
  const isDisabled = disabled || (field?.disabled ?? false);
  const groupName = name ?? generated;
  // Inside a <Field> the field renders label / hint / error; standalone, the group does.
  const own = !field;
  const message = own ? fieldErrorMessage(error) : null;
  const help = own ? hint : undefined;
  const labelId = own && label ? `${generated}-label` : undefined;
  const helpId = help && !message ? `${generated}-hint` : undefined;
  const errorId = message ? `${generated}-error` : undefined;
  const contextValue = useMemo(
    () => ({ name: groupName, value: current, setValue, disabled: isDisabled, invalid: isInvalid }),
    [groupName, current, setValue, isDisabled, isInvalid],
  );
  const group = (
    <RadioContext.Provider value={contextValue}>
      <div
        role="radiogroup"
        aria-labelledby={props['aria-labelledby'] ?? labelId}
        aria-describedby={
          cn(field?.descriptionId, field?.invalid ? field.errorId : undefined, helpId, errorId) ||
          undefined
        }
        aria-invalid={isInvalid || undefined}
        aria-required={required || field?.required || undefined}
        aria-orientation={orientation}
        className={cn(
          orientation === 'horizontal' ? 'flex flex-wrap gap-4' : 'flex flex-col gap-2.5',
          className,
        )}
        {...props}
      >
        {options?.map((option) => (
          <RadioGroupItem key={option.value} {...option} />
        ))}
        {children}
      </div>
    </RadioContext.Provider>
  );

  if (!labelId && !help && !message) return group;
  return (
    <div className="flex flex-col gap-2">
      {label && (
        <span id={labelId} className="text-sm leading-none font-medium text-foreground">
          {label}
          {required && (
            <span className="ml-0.5 text-danger">
              <span aria-hidden="true">*</span>
              <span className="sr-only"> (required)</span>
            </span>
          )}
        </span>
      )}
      {group}
      {help && !message && (
        <p id={helpId} className="text-xs text-muted-foreground">
          {help}
        </p>
      )}
      {message && <FieldMessage id={errorId}>{message}</FieldMessage>}
    </div>
  );
}

export function RadioGroupItem({ value, label, description, disabled }: RadioOption) {
  const group = useContext(RadioContext);
  if (!group) throw new Error('RadioGroupItem must be inside <RadioGroup>');
  const isDisabled = group.disabled || disabled;
  return (
    <label
      className={cn(
        'inline-flex items-start gap-2.5 text-sm',
        isDisabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
      )}
    >
      <span className="relative mt-0.5 inline-flex size-4 shrink-0 items-center justify-center">
        <input
          type="radio"
          name={group.name}
          value={value}
          checked={group.value === value}
          disabled={isDisabled}
          onChange={() => group.setValue(value)}
          className={cn(
            'peer size-4 cursor-pointer appearance-none rounded-full border border-input bg-surface transition-colors checked:border-primary focus:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed',
            group.invalid && 'border-danger',
          )}
        />
        <span className="pointer-events-none absolute size-2 rounded-full bg-primary opacity-0 peer-checked:opacity-100" />
      </span>
      <span className="space-y-0.5">
        <span className="block leading-snug font-medium text-foreground">{label}</span>
        {description && <span className="block text-xs text-muted-foreground">{description}</span>}
      </span>
    </label>
  );
}
