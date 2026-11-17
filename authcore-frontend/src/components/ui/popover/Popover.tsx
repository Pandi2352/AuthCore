import {
  createContext,
  forwardRef,
  useContext,
  useEffect,
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
import { getFocusable } from '@/hooks/useFocusTrap';
import { cn } from '@/lib/utils';

import { composeRefs } from '../primitives/compose';
import { Portal } from '../primitives/Portal';
import { Slot } from '../primitives/Slot';
import { useDismiss } from '../primitives/useDismiss';
import { useFloating, type Align, type Side } from '../primitives/useFloating';

interface PopoverContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: RefObject<HTMLElement | null>;
  contentId: string;
}
const PopoverContext = createContext<PopoverContextValue | null>(null);
const usePopover = () => {
  const ctx = useContext(PopoverContext);
  if (!ctx) throw new Error('Popover parts must be inside <Popover>');
  return ctx;
};

export interface PopoverProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}

/** Non-modal floating panel anchored to a trigger (filters, quick forms, pickers). */
export function Popover({ open, defaultOpen = false, onOpenChange, children }: PopoverProps) {
  const [isOpen, setOpen] = useControllableState({
    value: open,
    defaultValue: defaultOpen,
    onChange: onOpenChange,
  });
  const triggerRef = useRef<HTMLElement | null>(null);
  const contentId = useId();
  const value = useMemo(
    () => ({ open: isOpen, setOpen, triggerRef, contentId }),
    [isOpen, setOpen, contentId],
  );
  return <PopoverContext.Provider value={value}>{children}</PopoverContext.Provider>;
}

export const PopoverTrigger = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }
>(function PopoverTrigger({ asChild, onClick, ...props }, ref) {
  const { open, setOpen, triggerRef, contentId } = usePopover();
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      ref={composeRefs(ref, triggerRef as RefObject<HTMLButtonElement | null>)}
      type={asChild ? undefined : 'button'}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-controls={open ? contentId : undefined}
      onClick={(event: ReactMouseEvent<HTMLButtonElement>) => {
        onClick?.(event);
        if (!event.defaultPrevented) setOpen(!open);
      }}
      {...props}
    />
  );
});

export interface PopoverContentProps extends HTMLAttributes<HTMLDivElement> {
  side?: Side;
  align?: Align;
  sideOffset?: number;
  /** Move focus into the panel when it opens (default true). */
  autoFocus?: boolean;
}

export const PopoverContent = forwardRef<HTMLDivElement, PopoverContentProps>(
  function PopoverContent(
    {
      side = 'bottom',
      align = 'start',
      sideOffset = 6,
      autoFocus = true,
      className,
      style: styleProp,
      ...props
    },
    ref,
  ) {
    const { open, setOpen, triggerRef, contentId } = usePopover();
    const contentRef = useRef<HTMLDivElement | null>(null);
    const { style, placement } = useFloating(triggerRef, contentRef, {
      open,
      side,
      align,
      offset: sideOffset,
    });

    useDismiss(open, () => {
      setOpen(false);
      triggerRef.current?.focus();
    }, [contentRef, triggerRef]);

    useEffect(() => {
      if (!open || !autoFocus) return;
      const frame = requestAnimationFrame(() => {
        const el = contentRef.current;
        if (el && !el.contains(document.activeElement)) (getFocusable(el)[0] ?? el).focus();
      });
      return () => cancelAnimationFrame(frame);
    }, [open, autoFocus]);

    if (!open) return null;
    return (
      <Portal>
        <div
          ref={composeRefs(ref, contentRef)}
          id={contentId}
          role="dialog"
          tabIndex={-1}
          data-side={placement}
          style={{ ...style, zIndex: 'var(--z-dropdown)', ...styleProp }}
          className={cn(
            'w-72 overflow-auto rounded-md border border-border bg-surface p-4 text-surface-foreground shadow-popover outline-none',
            className,
          )}
          {...props}
        />
      </Portal>
    );
  },
);

/** Closes the popover (wrap a button with asChild, or use as a plain button). */
export const PopoverClose = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }
>(function PopoverClose({ asChild, onClick, ...props }, ref) {
  const { setOpen, triggerRef } = usePopover();
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      ref={ref}
      type={asChild ? undefined : 'button'}
      onClick={(event: ReactMouseEvent<HTMLButtonElement>) => {
        onClick?.(event);
        setOpen(false);
        triggerRef.current?.focus();
      }}
      {...props}
    />
  );
});
