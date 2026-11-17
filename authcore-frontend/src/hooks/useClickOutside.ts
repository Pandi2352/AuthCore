import { useEffect, useRef, type RefObject } from 'react';

/**
 * Calls `handler` on a pointer-down (mouse, touch, pen) outside all given elements.
 * Pass the trigger too, so clicking it can toggle instead of closing-and-reopening.
 *
 *   useClickOutside([panelRef, buttonRef], () => setOpen(false), open);
 *
 * (Overlays in components/ui use useDismiss, which also stacks layers and handles Escape.)
 */
export function useClickOutside(
  refs: RefObject<HTMLElement | null> | ReadonlyArray<RefObject<HTMLElement | null>>,
  handler: (event: PointerEvent) => void,
  enabled = true,
): void {
  const latest = useRef({ refs, handler });
  useEffect(() => {
    latest.current = { refs, handler };
  });

  useEffect(() => {
    if (!enabled) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node) || !target.isConnected) return;
      const { refs: current, handler: callback } = latest.current;
      const list = Array.isArray(current) ? current : [current as RefObject<HTMLElement | null>];
      if (list.some((ref) => ref.current?.contains(target))) return;
      callback(event);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [enabled]);
}
