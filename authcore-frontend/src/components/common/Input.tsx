import React, { forwardRef } from 'react';

import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id, type = 'text', ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="mb-1 block text-sm font-medium text-foreground">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          type={type}
          className={cn(
            'h-control-md w-full rounded-md border bg-surface px-3 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus:ring-2 focus:outline-none disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-70',
            error
              ? 'border-danger focus:border-danger focus:ring-danger/25'
              : 'border-input focus:border-ring focus:ring-ring/25',
            className,
          )}
          aria-invalid={error ? true : undefined}
          {...props}
        />
        {error && <p className="mt-1 text-xs text-danger">{error}</p>}
        {hint && !error && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </div>
    );
  },
);

Input.displayName = 'Input';
