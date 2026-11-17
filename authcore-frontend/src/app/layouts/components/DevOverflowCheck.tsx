import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/** Elements whose right edge is past the viewport (the usual cause of sideways scrolling). */
function findOverflowing(limit = 5): string[] {
  const width = document.documentElement.clientWidth;
  const found: string[] = [];
  for (const el of Array.from(document.body.querySelectorAll<HTMLElement>('*'))) {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.right <= width + 1) continue;
    // report the outermost offender, not every child inside it
    if (el.parentElement && el.parentElement.getBoundingClientRect().right > width + 1) continue;
    const name = `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${el.classList.length ? `.${[...el.classList].slice(0, 3).join('.')}` : ''}`;
    found.push(`${name} (right edge ${Math.round(rect.right)}px > ${width}px)`);
    if (found.length >= limit) break;
  }
  return found;
}

/**
 * Development only (removed from production builds): warns in the console when the page
 * scrolls horizontally — test at 320 px wide — and names the elements sticking out.
 */
export function DevOverflowCheck() {
  const { pathname } = useLocation();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const check = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const root = document.documentElement;
        if (root.scrollWidth <= root.clientWidth + 1) return;
        console.warn(
          `[layout] Horizontal overflow on ${pathname} at ${root.clientWidth}px wide:\n  ${findOverflowing().join('\n  ')}`,
        );
      }, 400);
    };
    check();
    window.addEventListener('resize', check);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', check);
    };
  }, [pathname]);

  return null;
}
