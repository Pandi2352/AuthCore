import { X } from 'lucide-react';
import {
  forwardRef,
  useId,
  useMemo,
  useRef,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type RefObject,
} from 'react';

import { useControllableState } from '@/hooks/useControllableState';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useScrollLock } from '@/hooks/useScrollLock';
import { cn } from '@/lib/utils';

import { composeRefs } from '../primitives/compose';
import { Portal } from '../primitives/Portal';
import { Slot } from '../primitives/Slot';
import { useDismiss } from '../primitives/useDismiss';
import { DialogContext, useDialog } from './dialog-context';
import { dialogPanelVariants } from './dialog.variants';

export interface DialogProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}

/** Modal dialog: focus trap, Escape, scroll lock, focus returns to the trigger. */
export function Dialog({ open, defaultOpen = false, onOpenChange, children }: DialogProps) {
  const [isOpen, setOpen] = useControllableState({
    value: open,
    defaultValue: defaultOpen,
    onChange: onOpenChange,
  });
  const titleId = useId();
  const descriptionId = useId();
  const triggerRef = useRef<HTMLElement | null>(null);
  const value = useMemo(
    () => ({ open: isOpen, setOpen, titleId, descriptionId, triggerRef }),
    [isOpen, setOpen, titleId, descriptionId],
  );
  return <DialogContext.Provider value={value}>{children}</DialogContext.Provider>;
}

type TriggerProps = ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean };

export const DialogTrigger = forwardRef<HTMLButtonElement, TriggerProps>(function DialogTrigger(
  { asChild, onClick, ...props },
  ref,
) {
  const { open, setOpen, triggerRef } = useDialog();
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      ref={composeRefs(ref, triggerRef as RefObject<HTMLButtonElement | null>)}
      type={asChild ? undefined : 'button'}
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={(event: ReactMouseEvent<HTMLButtonElement>) => {
        onClick?.(event);
        if (!event.defaultPrevented) setOpen(true);
      }}
      {...props}
    />
  );
});

export const DialogClose = forwardRef<HTMLButtonElement, TriggerProps>(function DialogClose(
  { asChild, onClick, ...props },
  ref,
) {
  const { setOpen } = useDialog();
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      ref={ref}
      type={asChild ? undefined : 'button'}
      onClick={(event: ReactMouseEvent<HTMLButtonElement>) => {
        onClick?.(event);
        if (!event.defaultPrevented) setOpen(false);
      }}
      {...props}
    />
  );
});

export interface DialogContentProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title' | 'role'> {
  /** Shortcut for <DialogHeader><DialogTitle/><DialogDescription/></DialogHeader>. */
  title?: ReactNode;
  description?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  placement?: 'center' | 'left' | 'right' | 'top' | 'bottom';
  /** Hide the × button (keep Escape / a footer button to close). */
  hideClose?: boolean;
  /** Clicking the backdrop closes (default true; AlertDialog: false). */
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
  role?: 'dialog' | 'alertdialog';
  /** Element to focus first (default: first focusable). */
  initialFocus?: RefObject<HTMLElement | null>;
}

export const DialogContent = forwardRef<HTMLDivElement, DialogContentProps>(function DialogContent(
  {
    title,
    description,
    size = 'md',
    placement = 'center',
    hideClose = false,
    closeOnOverlayClick = true,
    closeOnEscape = true,
    role = 'dialog',
    initialFocus,
    className,
    children,
    ...props
  },
  ref,
) {
  const { open, setOpen, titleId, descriptionId } = useDialog();
  const panelRef = useRef<HTMLDivElement | null>(null);
  useFocusTrap(panelRef, open, { initialFocus });
  useScrollLock(open);
  useDismiss(open, () => setOpen(false), [panelRef], {
    outsidePress: closeOnOverlayClick,
    escapeKey: closeOnEscape,
  });

  if (!open) return null;
  return (
    <Portal>
      <div
        aria-hidden="true"
        className="fixed inset-0 bg-overlay"
        style={{ zIndex: 'var(--z-overlay)' }}
      />
      <div
        ref={composeRefs(ref, panelRef)}
        role={role}
        aria-modal="true"
        aria-labelledby={title ? titleId : props['aria-labelledby']}
        aria-describedby={description ? descriptionId : props['aria-describedby']}
        tabIndex={-1}
        style={{ zIndex: 'var(--z-modal)' }}
        className={dialogPanelVariants({ placement, size, className })}
        {...props}
      >
        {(title || description) && (
          <DialogHeader>
            {title && <DialogTitle>{title}</DialogTitle>}
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
        )}
        {children}
        {!hideClose && (
          <DialogClose
            aria-label="Close"
            className="absolute top-3 right-3 inline-flex size-control-sm cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <X className="size-4" aria-hidden="true" />
          </DialogClose>
        )}
      </div>
    </Portal>
  );
});

export function DialogHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('space-y-1.5 px-card pt-card pr-12 pb-2', className)} {...props} />;
}

export function DialogTitle({ className, children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  const { titleId } = useDialog();
  return (
    <h2
      id={titleId}
      className={cn('text-lg leading-tight font-semibold text-foreground', className)}
      {...props}
    >
      {children}
    </h2>
  );
}

export function DialogDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  const { descriptionId } = useDialog();
  return (
    <p id={descriptionId} className={cn('text-sm text-muted-foreground', className)} {...props} />
  );
}

/** Scrollable middle part. */
export function DialogBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('min-h-0 flex-1 overflow-y-auto px-card py-2', className)} {...props} />
  );
}

export function DialogFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex flex-col-reverse gap-2 px-card pt-2 pb-card sm:flex-row sm:justify-end',
        className,
      )}
      {...props}
    />
  );
}
