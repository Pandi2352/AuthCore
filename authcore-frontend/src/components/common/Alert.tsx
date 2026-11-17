import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import React from 'react';

import { cn } from '@/lib/utils';

export interface AlertProps {
  type?: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  message?: string;
  children?: React.ReactNode;
  className?: string;
  onClose?: () => void;
}

export const Alert: React.FC<AlertProps> = ({
  type = 'info',
  title,
  message,
  children,
  className,
  onClose,
}) => {
  const styles = {
    info: 'border-info/25 bg-info-soft text-info-soft-foreground',
    success: 'border-success/25 bg-success-soft text-success-soft-foreground',
    warning: 'border-warning/25 bg-warning-soft text-warning-soft-foreground',
    error: 'border-danger/25 bg-danger-soft text-danger-soft-foreground',
  };

  const icons = {
    info: <Info className="h-5 w-5 shrink-0" aria-hidden="true" />,
    success: <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" />,
    warning: <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" />,
    error: <AlertCircle className="h-5 w-5 shrink-0" aria-hidden="true" />,
  };

  return (
    <div
      role={type === 'error' || type === 'warning' ? 'alert' : 'status'}
      className={cn(
        'relative flex items-start gap-3 rounded-md border p-4 text-sm',
        styles[type],
        className,
      )}
    >
      {icons[type]}
      <div className="flex-1">
        {title && <h4 className="mb-0.5 font-semibold">{title}</h4>}
        {message && <p>{message}</p>}
        {children}
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="rounded-md opacity-70 transition-opacity hover:opacity-100"
          aria-label="Close alert"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};
