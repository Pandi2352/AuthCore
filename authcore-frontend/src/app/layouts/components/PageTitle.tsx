import { useEffect } from 'react';
import { useMatches } from 'react-router-dom';

import { useBranding } from '@/hooks/useBranding';
import { formatDocumentTitle } from '@/hooks/useDocumentTitle';

import { handleOf } from '../../routes/route-handle';

/** document.title = "<deepest route handle.title> · <site name>" (follows Business settings). */
export function PageTitle() {
  const matches = useMatches();
  const { siteName } = useBranding();
  const title = matches
    .toReversed()
    .map((m) => handleOf(m).title)
    .find(Boolean);

  const documentTitle = formatDocumentTitle(title, siteName);

  useEffect(() => {
    document.title = documentTitle;
  }, [documentTitle]);

  return null;
}
