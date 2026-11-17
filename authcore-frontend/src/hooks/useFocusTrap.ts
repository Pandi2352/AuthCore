import { useEffect, type RefObject } from 'react';

const FOCUSABLE = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(',');

/** Visible, focusable elements inside a container, in tab order. */
export function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.hasAttribute('inert') && el.getClientRects().length > 0,
  );
}

/**
 * While active: Tab / Shift+Tab cycle inside the container, focus moves in on start
 * (`initialFocus` or the first focusable element or the container) and returns to the
 * previously focused element on end.
 */
export function useFocusTrap(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
  options: { initialFocus?: RefObject<HTMLElement | null>; restoreFocus?: boolean } = {},
): void {
  const { initialFocus, restoreFocus = true } = options;

  useEffect(() => {
    const container = ref.current;
    if (!active || !container) return;
    const previous = document.activeElement as HTMLElement | null;

    const frame = requestAnimationFrame(() => {
      if (container.contains(document.activeElement)) return;
      const target = initialFocus?.current ?? getFocusable(container)[0] ?? container;
      target.focus({ preventScroll: true });
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const items = getFocusable(container);
      if (items.length === 0) {
        event.preventDefault();
        container.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const current = document.activeElement;
      if (event.shiftKey && (current === first || !container.contains(current))) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && (current === last || !container.contains(current))) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKeyDown);
      if (restoreFocus && previous && document.contains(previous)) {
        previous.focus({ preventScroll: true });
      }
    };
  }, [active, ref, initialFocus, restoreFocus]);
}
