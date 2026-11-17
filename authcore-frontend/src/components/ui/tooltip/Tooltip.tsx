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

import { useOptionalTheme } from '@/app/theme';
import { cn } from '@/lib/utils';

import { Portal } from '../primitives/Portal';
import { Slot } from '../primitives/Slot';
import { useDismiss } from '../primitives/useDismiss';
import { useFloating, type Align, type Side } from '../primitives/useFloating';

/** After one tooltip closes, the next opens instantly for a moment (moving along a toolbar). */
let lastClosedAt = 0;
const SKIP_DELAY_MS = 300;
/** Only one tooltip is visible at a time: opening one closes the previous immediately. */
let closeCurrent: (() => void) | null = null;

/** Arrow position per side (a small rotated square on the edge facing the trigger). */
const ARROW: Record<Side, string> = {
  top: 'bottom-[-4px] left-1/2 -translate-x-1/2',
  bottom: 'top-[-4px] left-1/2 -translate-x-1/2',
  left: 'right-[-4px] top-1/2 -translate-y-1/2',
  right: 'left-[-4px] top-1/2 -translate-y-1/2',
};

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
  // Appearance → Tooltips (accessible names stay on the triggers).
  const tooltipsOff = useOptionalTheme()?.appearance.tooltips === 'off';
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
  const closeNow = useCallback(() => {
    clearTimeout(timer.current);
    setOpen(false);
  }, []);
  const openNow = useCallback(() => {
    if (closeCurrent && closeCurrent !== closeNow) closeCurrent();
    closeCurrent = closeNow;
    setOpen(true);
  }, [closeNow]);
  const show = useCallback(
    (immediate: boolean) => {
      clearTimer();
      if (immediate || Date.now() - lastClosedAt < SKIP_DELAY_MS) openNow();
      else timer.current = setTimeout(openNow, delay);
    },
    [clearTimer, delay, openNow],
  );
  const hide = useCallback(() => {
    clearTimer();
    timer.current = setTimeout(() => {
      setOpen(false);
      if (closeCurrent === closeNow) closeCurrent = null;
      lastClosedAt = Date.now();
    }, 80);
  }, [clearTimer, closeNow]);

  useEffect(
    () => () => {
      clearTimer();
      if (closeCurrent === closeNow) closeCurrent = null;
    },
    [clearTimer, closeNow],
  );
  useDismiss(open, () => setOpen(false), [anchorRef, floatingRef], {
    outsidePress: false,
    stacked: false,
  });

  if (!isValidElement(children)) return children;
  if (tooltipsOff || disabled || content === null || content === undefined || content === '')
    return children;

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
              'pointer-events-auto max-w-xs tooltip-in rounded-md bg-foreground px-2.5 py-1.5 text-xs leading-snug font-medium text-background shadow-popover',
              className,
            )}
          >
            {content}
            <span
              aria-hidden="true"
              className={cn('absolute size-2 rotate-45 bg-foreground', ARROW[placement])}
            />
          </div>
        </Portal>
      )}
    </>
  );
}
