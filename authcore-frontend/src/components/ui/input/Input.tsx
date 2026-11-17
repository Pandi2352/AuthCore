import { Eye, EyeOff } from 'lucide-react';
import { forwardRef, useState, type InputHTMLAttributes, type ReactNode } from 'react';

import { useOptionalTheme } from '@/app/theme';
import { cn } from '@/lib/utils';

import { Field, useField, useFieldControlProps } from '../field';
import { controlVariants, type ControlSize, type ControlVariant } from './input.variants';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'prefix'> {
  /** Default: theme appearance.inputs. */
  variant?: ControlVariant;
  size?: ControlSize;
  invalid?: boolean;
  /** Element inside the field on the left / right (icon, unit, button). */
  prefix?: ReactNode;
  suffix?: ReactNode;
  /** Shortcuts: wrap the input in a <Field> with this label / hint / error. */
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  /** Classes for the outer element when prefix / suffix are used. */
  wrapperClassName?: string;
}

const BareInput = forwardRef<HTMLInputElement, Omit<InputProps, 'label' | 'hint' | 'error'>>(
  function BareInput(
    {
      variant,
      size = 'md',
      invalid,
      prefix,
      suffix,
      className,
      wrapperClassName,
      type = 'text',
      ...props
    },
    ref,
  ) {
    const theme = useOptionalTheme();
    const control = useFieldControlProps({ ...props, invalid });
    const look = variant ?? theme?.appearance.inputs ?? 'outlined';
    const { invalid: isInvalid, ...a11y } = control;

    if (!prefix && !suffix) {
      return (
        <input
          ref={ref}
          type={type}
          className={controlVariants({ variant: look, size, className })}
          {...props}
          {...a11y}
        />
      );
    }

    // InputGroup: the wrapper draws the border; the input is transparent inside it.
    return (
      <div
        aria-invalid={isInvalid || undefined}
        className={cn(
          controlVariants({ variant: look, size }),
          'flex items-center gap-2 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/25',
          look === 'filled' && 'focus-within:bg-surface',
          props.disabled && 'cursor-not-allowed opacity-60',
          wrapperClassName,
        )}
      >
        {prefix && (
          <span className="flex shrink-0 items-center text-muted-foreground [&_svg]:size-4">
            {prefix}
          </span>
        )}
        <input
          ref={ref}
          type={type}
          className={cn(
            'h-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed',
            className,
          )}
          {...props}
          {...a11y}
        />
        {suffix && (
          <span className="flex shrink-0 items-center text-muted-foreground [&_svg]:size-4">
            {suffix}
          </span>
        )}
      </div>
    );
  },
);

/** Text input. With `label` / `hint` / `error` it renders a complete <Field>. */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, id, required, disabled, ...props },
  ref,
) {
  const inField = useField() !== null;
  if (inField || (label === undefined && hint === undefined && !error)) {
    return <BareInput ref={ref} id={id} required={required} disabled={disabled} {...props} />;
  }
  return (
    <Field
      label={label}
      description={hint}
      error={error}
      id={id}
      required={required}
      disabled={disabled}
    >
      <BareInput ref={ref} {...props} />
    </Field>
  );
});

/** Password with a show / hide button (keeps focus, announces the state). */
export const PasswordInput = forwardRef<HTMLInputElement, Omit<InputProps, 'type' | 'suffix'>>(
  function PasswordInput(props, ref) {
    const [visible, setVisible] = useState(false);
    return (
      <Input
        ref={ref}
        type={visible ? 'text' : 'password'}
        autoComplete={props.autoComplete ?? 'current-password'}
        {...props}
        suffix={
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="-mr-1 inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            aria-label={visible ? 'Hide password' : 'Show password'}
            aria-pressed={visible}
            disabled={props.disabled}
          >
            {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
          </button>
        }
      />
    );
  },
);
