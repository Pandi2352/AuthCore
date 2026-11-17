import {
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';

import { cn } from '@/lib/utils';

import { Portal } from '../primitives/Portal';
import { Slot } from '../primitives/Slot';
import { useDismiss } from '../primitives/useDismiss';
import { useFloating, type Align, type Side } from '../primitives/useFloating';

/** After one tooltip closes, the next opens instantly for a moment (moving along a toolbar). */
let lastClosedAt = 0;
const SKIP_DELAY_MS = 300;

export interface TooltipProps {
  content: ReactNode;
  /** One focusable element (button, link …). */
  children: ReactElement;
  side?: Side;
  align?: Align;
  /** Hover delay before opening (ms). Keyboard focus opens immediately. */
  delay?: number;
  disabled?: boolean;
  className?: string;
}

/**
 * Accessible tooltip: opens on hover (after `delay`) and on keyboard focus, closes on
 * leave / blur / Escape, stays open while the pointer is over it (WCAG 1.4.13), linked
 * with aria-describedby, flips / shifts to stay on screen.
 */
export function Tooltip({
  content,
  children,
  side = 'top',
  align = 'center',
  delay = 500,
  disabled = false,
  className,
}: TooltipProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLElement | null>(null);
  const floatingRef = useRef<HTMLDivElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const { style, placement } = useFloating(anchorRef, floatingRef, {
    open,
    side,
    align,
    offset: 6,
  });

  const setAnchor = useCallback((el: HTMLElement | null) => {
    anchorRef.current = el;
  }, []);
  const clearTimer = useCallback(() => clearTimeout(timer.current), []);
  const show = useCallback(
    (immediate: boolean) => {
      clearTimer();
      if (immediate || Date.now() - lastClosedAt < SKIP_DELAY_MS) setOpen(true);
      else timer.current = setTimeout(() => setOpen(true), delay);
    },
    [clearTimer, delay],
  );
  const hide = useCallback(() => {
    clearTimer();
    timer.current = setTimeout(() => {
      setOpen(false);
      lastClosedAt = Date.now();
    }, 80);
  }, [clearTimer]);

  useEffect(() => clearTimer, [clearTimer]);
  useDismiss(open, () => setOpen(false), [anchorRef, floatingRef], {
    outsidePress: false,
    stacked: false,
  });

  if (!isValidElement(children)) return children;
  if (disabled || content === null || content === undefined || content === '') return children;

  const trigger = (
    <Slot
      ref={setAnchor}
      aria-describedby={open ? id : undefined}
      onPointerEnter={() => show(false)}
      onPointerLeave={hide}
      onFocus={() => show(true)}
      onBlur={hide}
      onPointerDown={() => {
        clearTimer();
        setOpen(false);
      }}
    >
      {children}
    </Slot>
  );

  return (
    <>
      {trigger}
      {open && (
        <Portal>
          <div
            ref={floatingRef}
            id={id}
            role="tooltip"
            data-side={placement}
            style={{ ...style, zIndex: 'var(--z-toast)' }}
            onPointerEnter={clearTimer}
            onPointerLeave={hide}
            className={cn(
              'pointer-events-auto max-w-xs rounded-md bg-foreground px-2.5 py-1.5 text-xs leading-snug font-medium text-background shadow-popover',
              className,
            )}
          >
            {content}
          </div>
        </Portal>
      )}
    </>
  );
}
