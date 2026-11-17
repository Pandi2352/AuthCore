import { useEffect, useRef, type RefObject } from 'react';

type Refs = Array<RefObject<HTMLElement | null>>;

/** Open layers, topmost last: only the topmost reacts to Escape / outside presses. */
const stack: symbol[] = [];

/**
 * Closes a floating layer on Escape and on pointer-down outside of it (and outside its
 * trigger, so the trigger's own click can toggle).
 * `refs` may be a function so a layer can grow while open (dropdown submenus).
 * `stacked: false` → not a layer (tooltips): reacts to Escape but never blocks the layer below.
 */
export function useDismiss(
  open: boolean,
  onDismiss: () => void,
  refs: Refs | (() => Refs),
  options: { outsidePress?: boolean; escapeKey?: boolean; stacked?: boolean } = {},
): void {
  const { outsidePress = true, escapeKey = true, stacked = true } = options;
  const latest = useRef({ onDismiss, refs });
  useEffect(() => {
    latest.current = { onDismiss, refs };
  });

  useEffect(() => {
    if (!open) return;
    const id = Symbol('layer');
    if (stacked) stack.push(id);
    const isTop = () => !stacked || stack[stack.length - 1] === id;
    const currentRefs = () => {
      const r = latest.current.refs;
      return typeof r === 'function' ? r() : r;
    };
    const isInside = (target: EventTarget | null) =>
      target instanceof Node && currentRefs().some((ref) => ref.current?.contains(target));

    const onPointerDown = (event: PointerEvent) => {
      if (!outsidePress || !isTop()) return;
      if (!isInside(event.target)) latest.current.onDismiss();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (!escapeKey || event.key !== 'Escape' || !isTop()) return;
      if (stacked) event.stopPropagation();
      latest.current.onDismiss();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown);
      if (stacked) stack.splice(stack.indexOf(id), 1);
    };
  }, [open, outsidePress, escapeKey, stacked]);
}
