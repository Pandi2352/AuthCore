import { useLayoutEffect, useState, type CSSProperties, type RefObject } from 'react';

export type Side = 'top' | 'right' | 'bottom' | 'left';
export type Align = 'start' | 'center' | 'end';

interface FloatingOptions {
  open: boolean;
  side?: Side;
  align?: Align;
  /** Gap between anchor and floating element (px). */
  offset?: number;
  /** Floating element at least as wide as the anchor (selects, comboboxes). */
  matchWidth?: boolean;
}

const OPPOSITE: Record<Side, Side> = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };
const VIEWPORT_PADDING = 8;

/**
 * Positions a floating element (menu, popover, tooltip, listbox) next to its anchor with
 * `position: fixed`. Collision-aware: flips to the opposite side when it doesn't fit, shifts
 * to stay inside the viewport, limits its height to the space available. Follows scroll /
 * resize while open.
 */
export function useFloating(
  anchorRef: RefObject<HTMLElement | null>,
  floatingRef: RefObject<HTMLElement | null>,
  { open, side = 'bottom', align = 'start', offset = 6, matchWidth = false }: FloatingOptions,
): { style: CSSProperties; placement: Side } {
  const [state, setState] = useState<{ style: CSSProperties; placement: Side }>({
    style: { position: 'fixed', top: 0, left: 0, visibility: 'hidden' },
    placement: side,
  });

  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const anchor = anchorRef.current;
      const floating = floatingRef.current;
      if (!anchor || !floating) return;
      const a = anchor.getBoundingClientRect();
      const width = matchWidth ? Math.max(a.width, floating.scrollWidth) : floating.offsetWidth;
      const height = floating.scrollHeight;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      const space: Record<Side, number> = {
        top: a.top - offset - VIEWPORT_PADDING,
        bottom: vh - a.bottom - offset - VIEWPORT_PADDING,
        left: a.left - offset - VIEWPORT_PADDING,
        right: vw - a.right - offset - VIEWPORT_PADDING,
      };
      const needed = side === 'top' || side === 'bottom' ? height : width;
      let placement = side;
      if (space[side] < needed && space[OPPOSITE[side]] > space[side]) placement = OPPOSITE[side];

      const vertical = placement === 'top' || placement === 'bottom';
      let top: number;
      let left: number;
      if (vertical) {
        top =
          placement === 'bottom' ? a.bottom + offset : a.top - offset - Math.min(height, space.top);
        left =
          align === 'start'
            ? a.left
            : align === 'end'
              ? a.right - width
              : a.left + a.width / 2 - width / 2;
      } else {
        left = placement === 'right' ? a.right + offset : a.left - offset - width;
        top =
          align === 'start'
            ? a.top
            : align === 'end'
              ? a.bottom - height
              : a.top + a.height / 2 - height / 2;
      }
      left = Math.min(
        Math.max(left, VIEWPORT_PADDING),
        Math.max(VIEWPORT_PADDING, vw - width - VIEWPORT_PADDING),
      );
      if (!vertical)
        top = Math.min(
          Math.max(top, VIEWPORT_PADDING),
          Math.max(VIEWPORT_PADDING, vh - height - VIEWPORT_PADDING),
        );
      const maxHeight = vertical ? Math.max(120, space[placement]) : vh - VIEWPORT_PADDING * 2;

      setState({
        placement,
        style: {
          position: 'fixed',
          top: Math.round(top),
          left: Math.round(left),
          maxHeight,
          ...(matchWidth ? { minWidth: a.width } : {}),
          visibility: 'visible',
        },
      });
    };

    update();
    const observer = new ResizeObserver(update);
    if (anchorRef.current) observer.observe(anchorRef.current);
    if (floatingRef.current) observer.observe(floatingRef.current);
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open, side, align, offset, matchWidth, anchorRef, floatingRef]);

  return state;
}
