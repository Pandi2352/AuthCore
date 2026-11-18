import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * After a client-side navigation (not the first load), move focus to the new page's main
 * heading (or <main>), so keyboard and screen-reader users start at the new content —
 * like a full page load would. Query-only changes keep focus.
 */
export function FocusOnNavigate() {
  const { pathname } = useLocation();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    const previous = lastPath.current;
    lastPath.current = pathname;
    if (previous === null || previous === pathname) return;
    // Wait for the (lazy) page to render.
    const frame = requestAnimationFrame(() => {
      const main = document.getElementById('main-content');
      const target = main?.querySelector<HTMLElement>('h1') ?? main;
      if (!target || target.contains(document.activeElement)) return;
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      // Focus target only (not interactive): no focus ring drawn around the heading.
      target.setAttribute('data-route-focus', '');
      target.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [pathname]);

  return null;
}
