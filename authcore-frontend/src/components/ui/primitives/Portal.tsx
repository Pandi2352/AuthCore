import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** Renders children at the end of <body> (above the app, outside overflow clipping). */
export function Portal({ children }: { children: ReactNode }) {
  if (typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}
