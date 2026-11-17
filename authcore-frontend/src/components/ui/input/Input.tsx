import { Eye, EyeOff } from 'lucide-react';
import { forwardRef, useState, type InputHTMLAttributes, type ReactNode } from 'react';

import { useOptionalTheme } from '@/app/theme';
import { cn } from '@/lib/utils';

import { FieldShell, resolveInvalid, useFieldControlProps, type FieldShellProps } from '../field';
import { controlVariants, type ControlSize, type ControlVariant } from './input.variants';

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'prefix'>, FieldShellProps {
  /** Default: theme appearance.inputs. */
  variant?: ControlVariant;
  size?: ControlSize;
  /** Force the invalid look (normally derived from `error`). */
  invalid?: boolean;
  /** Element inside the field on the left / right (icon, unit, button). */
  prefix?: ReactNode;
  suffix?: ReactNode;
  /** Classes for the bordered box when prefix / suffix are used. */
  wrapperClassName?: string;
}

type BareInputProps = Omit<InputProps, 'label' | 'hint' | 'error' | 'fieldClassName'>;

const BareInput = forwardRef<HTMLInputElement, BareInputProps>(function BareInput(
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
  const { invalid: isInvalid, ...a11y } = useFieldControlProps({ ...props, invalid });
  const look = variant ?? theme?.appearance.inputs ?? 'outlined';

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

  // Input group: the wrapper draws the border (and the focus color); the input is transparent.
  return (
    <div
      aria-invalid={isInvalid || undefined}
      data-disabled={props.disabled || undefined}
      className={cn(
        controlVariants({ variant: look, size }),
        'flex items-center gap-2 focus-within:border-primary',
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
});

/**
 * Text input. Pass label / hint / error / required from the parent and it renders the whole
 * field (label, control, help text or red message with aria wiring). Every native input prop
 * and event (onChange, onBlur, onFocus, onKeyDown, ref …) goes to the <input>.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, fieldClassName, invalid, ...props },
  ref,
) {
  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      required={props.required}
      disabled={props.disabled}
      id={props.id}
      fieldClassName={fieldClassName}
    >
      <BareInput ref={ref} invalid={resolveInvalid(invalid, error)} {...props} />
    </FieldShell>
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
            // Keep the caret in the input when toggling with the mouse.
            onMouseDown={(event) => event.preventDefault()}
            className="touch-target -mr-1 inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
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
