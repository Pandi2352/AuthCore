import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

import { useOptionalTheme } from '@/app/theme';

import { Slot } from '../primitives/Slot';
import { Spinner } from '../spinner/Spinner';
import { buttonVariants, type ButtonSize, type ButtonVariant } from './button.variants';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Default: the theme's button style (theme.config.ts → appearance.buttons). */
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  /** Shows a spinner, disables the button and sets aria-busy. */
  isLoading?: boolean;
  /** Text announced / shown while loading (keeps the label otherwise). */
  loadingText?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  /** Render the child element (e.g. a router <Link>) with button styles. */
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    variant,
    size,
    fullWidth,
    isLoading = false,
    loadingText,
    leftIcon,
    rightIcon,
    asChild = false,
    disabled,
    type,
    children,
    ...props
  },
  ref,
) {
  const theme = useOptionalTheme();
  const classes = buttonVariants({
    variant: variant ?? theme?.appearance.buttons ?? 'solid',
    size,
    fullWidth: fullWidth ? 'true' : 'false',
    className,
  });

  if (asChild) {
    return (
      <Slot ref={ref} className={classes} {...props}>
        {children}
      </Slot>
    );
  }

  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      className={classes}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      {...props}
    >
      {isLoading ? <Spinner size="sm" label={loadingText ?? 'Loading'} /> : leftIcon}
      {isLoading && loadingText ? loadingText : children}
      {!isLoading && rightIcon}
    </button>
  );
});
