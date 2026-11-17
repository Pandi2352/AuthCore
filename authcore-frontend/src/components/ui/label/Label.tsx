import { forwardRef, type LabelHTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  /** Adds a red "*" (announced as "required"). */
  required?: boolean;
  disabled?: boolean;
}

export const Label = forwardRef<HTMLLabelElement, LabelProps>(function Label(
  { required, disabled, className, children, ...props },
  ref,
) {
  return (
    <label
      ref={ref}
      className={cn(
        'text-sm leading-none font-medium text-foreground',
        props.htmlFor && !disabled && 'cursor-pointer',
        disabled && 'cursor-not-allowed opacity-60',
        className,
      )}
      {...props}
    >
      {children}
      {required && (
        <span className="ml-0.5 text-danger">
          <span aria-hidden="true">*</span>
          <span className="sr-only"> (required)</span>
        </span>
      )}
    </label>
  );
});
