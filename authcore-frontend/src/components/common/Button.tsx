import { Loader2 } from 'lucide-react';
import React from 'react';

import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  className,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50';

  const variants = {
    primary: 'bg-primary text-primary-foreground hover:bg-primary-hover',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary-hover',
    outline: 'border border-input bg-surface text-foreground hover:bg-accent',
    danger: 'bg-danger text-danger-foreground hover:bg-danger-hover',
    ghost: 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
  };

  const sizes = {
    sm: 'h-control-sm px-3 text-xs',
    md: 'h-control-md px-4 text-sm',
    lg: 'h-control-lg px-6 text-base',
  };

  return (
    <button
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
};
