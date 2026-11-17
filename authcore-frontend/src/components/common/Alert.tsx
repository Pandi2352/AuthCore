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
    info: 'bg-blue-50 border-blue-200 text-blue-900',
    success: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    warning: 'bg-amber-50 border-amber-200 text-amber-900',
    error: 'bg-rose-50 border-rose-200 text-rose-900',
  };

  const icons = {
    info: <Info className="h-5 w-5 shrink-0 text-blue-600" />,
    success: <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />,
    warning: <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />,
    error: <AlertCircle className="h-5 w-5 shrink-0 text-rose-600" />,
  };

  return (
    <div
      className={cn(
        'relative flex items-start gap-3 rounded-xl border p-4 text-sm',
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
          className="text-slate-400 transition-colors hover:text-slate-600"
          aria-label="Close alert"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};
