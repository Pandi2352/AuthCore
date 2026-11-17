import type { ReactNode } from 'react';

/** Our own toast store (no library): a tiny external store read with useSyncExternalStore. */
export type ToastType = 'default' | 'success' | 'error' | 'warning' | 'info' | 'loading';

export interface ToastItem {
  id: string;
  type: ToastType;
  title: ReactNode;
  description?: ReactNode;
  action?: { label: string; onClick: () => void };
  /** ms; Infinity = until dismissed. Loading toasts never time out. */
  duration: number;
  createdAt: number;
}

export interface ToastOptions {
  id?: string;
  description?: ReactNode;
  action?: { label: string; onClick: () => void };
  duration?: number;
}

const DEFAULT_DURATION: Record<ToastType, number> = {
  default: 5000,
  success: 4000,
  info: 5000,
  warning: 6000,
  error: 8000,
  loading: Number.POSITIVE_INFINITY,
};

let toasts: ToastItem[] = [];
const listeners = new Set<() => void>();
let counter = 0;

const emit = () => {
  for (const listener of listeners) listener();
};

export const toastStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot: () => toasts,
};

function show(type: ToastType, title: ReactNode, options: ToastOptions = {}): string {
  const id = options.id ?? `toast-${++counter}`;
  const item: ToastItem = {
    id,
    type,
    title,
    description: options.description,
    action: options.action,
    duration: options.duration ?? DEFAULT_DURATION[type],
    createdAt: Date.now(),
  };
  const exists = toasts.some((t) => t.id === id);
  toasts = exists ? toasts.map((t) => (t.id === id ? item : t)) : [...toasts, item];
  emit();
  return id;
}

export function dismissToast(id?: string): void {
  toasts = id === undefined ? [] : toasts.filter((t) => t.id !== id);
  emit();
}

interface PromiseMessages<T> {
  loading: ReactNode;
  success: ReactNode | ((value: T) => ReactNode);
  error: ReactNode | ((error: unknown) => ReactNode);
}

/**
 *   toast('Saved');  toast.success('Profile updated');  toast.error('Could not save', { description })
 *   toast.promise(save(), { loading: 'Saving…', success: 'Saved', error: (e) => getErrorMessage(e) })
 */
export const toast = Object.assign(
  (title: ReactNode, options?: ToastOptions) => show('default', title, options),
  {
    success: (title: ReactNode, options?: ToastOptions) => show('success', title, options),
    error: (title: ReactNode, options?: ToastOptions) => show('error', title, options),
    warning: (title: ReactNode, options?: ToastOptions) => show('warning', title, options),
    info: (title: ReactNode, options?: ToastOptions) => show('info', title, options),
    loading: (title: ReactNode, options?: ToastOptions) => show('loading', title, options),
    dismiss: dismissToast,
    promise<T>(
      promise: Promise<T>,
      messages: PromiseMessages<T>,
      options?: ToastOptions,
    ): Promise<T> {
      const id = show('loading', messages.loading, options);
      promise.then(
        (value) => {
          show(
            'success',
            typeof messages.success === 'function' ? messages.success(value) : messages.success,
            { ...options, id },
          );
          return value;
        },
        (error: unknown) => {
          show(
            'error',
            typeof messages.error === 'function' ? messages.error(error) : messages.error,
            { ...options, id },
          );
          return null;
        },
      );
      return promise;
    },
  },
);
