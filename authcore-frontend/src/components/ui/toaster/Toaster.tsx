import { AlertCircle, AlertTriangle, CheckCircle2, Info, Loader2, X } from 'lucide-react';
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

import { Portal } from '../primitives/Portal';
import { dismissToast, toastStore, type ToastItem, type ToastType } from './toast-store';

const ICON: Record<ToastType, ReactNode> = {
  default: null,
  success: <CheckCircle2 className="text-success" aria-hidden="true" />,
  error: <AlertCircle className="text-danger" aria-hidden="true" />,
  warning: <AlertTriangle className="text-warning" aria-hidden="true" />,
  info: <Info className="text-info" aria-hidden="true" />,
  loading: <Loader2 className="animate-spin text-muted-foreground" aria-hidden="true" />,
};

const POSITION = {
  'top-right': 'top-4 right-4 items-end',
  'top-center': 'top-4 left-1/2 -translate-x-1/2 items-center',
  'bottom-right': 'bottom-4 right-4 items-end',
  'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2 items-center',
  'bottom-left': 'bottom-4 left-4 items-start',
} as const;

function Toast({ item, paused }: { item: ToastItem; paused: boolean }) {
  const remaining = useRef(item.duration);

  // Auto-dismiss; the countdown pauses while the region is hovered / focused.
  useEffect(() => {
    if (!Number.isFinite(item.duration) || paused) return;
    const startedAt = Date.now();
    const timer = setTimeout(() => dismissToast(item.id), Math.max(remaining.current, 0));
    return () => {
      clearTimeout(timer);
      remaining.current -= Date.now() - startedAt;
    };
  }, [paused, item.id, item.duration]);

  return (
    <li
      role={item.type === 'error' ? 'alert' : 'status'}
      aria-atomic="true"
      className="pointer-events-auto flex w-[min(24rem,calc(100vw-2rem))] animate-[toast-in_180ms_ease-out] items-start gap-3 rounded-md border border-border bg-surface p-4 text-sm text-surface-foreground shadow-popover [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:shrink-0"
    >
      {ICON[item.type]}
      <div className="min-w-0 flex-1">
        <p className="font-medium text-foreground">{item.title}</p>
        {item.description && <p className="mt-0.5 text-muted-foreground">{item.description}</p>}
        {item.action && (
          <button
            type="button"
            onClick={() => {
              item.action?.onClick();
              dismissToast(item.id);
            }}
            className="mt-2 cursor-pointer rounded-md text-sm font-medium text-primary hover:underline"
          >
            {item.action.label}
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={() => dismissToast(item.id)}
        aria-label="Dismiss notification"
        className="touch-target -m-1 inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </li>
  );
}

export interface ToasterProps {
  position?: keyof typeof POSITION;
  /** Older toasts beyond this are hidden until newer ones go. */
  max?: number;
}

/** Mount once (app Providers). Shows toasts from `toast()` anywhere in the app. */
export function Toaster({ position = 'bottom-right', max = 4 }: ToasterProps) {
  const items = useSyncExternalStore(
    toastStore.subscribe,
    toastStore.getSnapshot,
    toastStore.getSnapshot,
  );
  const [paused, setPaused] = useState(false);
  const visible = items.slice(-max);
  return (
    <Portal>
      <section
        aria-label="Notifications"
        className={cn('pointer-events-none fixed flex flex-col gap-2', POSITION[position])}
        style={{ zIndex: 'var(--z-toast)' }}
        onPointerEnter={() => setPaused(true)}
        onPointerLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
      >
        <ol className="flex flex-col gap-2">
          {visible.map((item) => (
            <Toast key={`${item.id}-${item.createdAt}`} item={item} paused={paused} />
          ))}
        </ol>
      </section>
    </Portal>
  );
}
