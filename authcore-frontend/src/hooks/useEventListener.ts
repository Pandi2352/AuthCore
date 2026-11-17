import { useEffect, useRef } from 'react';

type Target = Window | Document | HTMLElement | MediaQueryList | null | undefined;

/**
 * addEventListener with automatic cleanup. The handler can change every render without
 * re-subscribing (it is read from a ref when the event fires).
 *
 *   useEventListener('keydown', onKeyDown);                 // window
 *   useEventListener('scroll', onScroll, element, { passive: true });
 */
export function useEventListener<K extends keyof WindowEventMap>(
  type: K,
  handler: (event: WindowEventMap[K]) => void,
  target?: Target,
  options?: AddEventListenerOptions & { enabled?: boolean },
): void;
export function useEventListener(
  type: string,
  handler: (event: Event) => void,
  target?: Target,
  options?: AddEventListenerOptions & { enabled?: boolean },
): void;
export function useEventListener(
  type: string,
  handler: (event: Event) => void,
  target?: Target,
  options: AddEventListenerOptions & { enabled?: boolean } = {},
): void {
  const latest = useRef(handler);
  useEffect(() => {
    latest.current = handler;
  });
  const { enabled = true, capture, passive, once } = options;

  useEffect(() => {
    if (!enabled) return;
    const element: Target = target === undefined ? window : target;
    if (!element) return;
    const listener = (event: Event) => latest.current(event);
    const opts = { capture, passive, once };
    element.addEventListener(type, listener, opts);
    return () => element.removeEventListener(type, listener, opts);
  }, [type, target, enabled, capture, passive, once]);
}
