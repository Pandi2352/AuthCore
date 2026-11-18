import { useEffect } from 'react';

import { brandingStore } from '@/lib/branding';

/** "Priya Raman · AuthCore" (or just the site name from Business settings). */
export const formatDocumentTitle = (
  title: string | null | undefined,
  siteName: string = brandingStore.get().siteName,
): string => (title ? `${title} · ${siteName}` : siteName);

/**
 * Sets document.title for data-dependent titles (e.g. the user being viewed).
 * Static titles belong in the route handle (`handle.title`), which PageTitle applies;
 * this hook overrides it while the component is mounted and restores it afterwards.
 *
 *   useDocumentTitle(user ? `${user.firstName} ${user.lastName}` : null);
 */
export function useDocumentTitle(
  title: string | null | undefined,
  options: { restoreOnUnmount?: boolean } = {},
) {
  const { restoreOnUnmount = true } = options;
  useEffect(() => {
    if (!title) return;
    const previous = document.title;
    document.title = formatDocumentTitle(title);
    return () => {
      if (restoreOnUnmount) document.title = previous;
    };
  }, [title, restoreOnUnmount]);
}
