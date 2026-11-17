import { useEffect } from 'react';
import { useMatches } from 'react-router-dom';

import { appConfig } from '@/config';

import { handleOf } from '../../routes/route-handle';

/** document.title = "<deepest route handle.title> · <app name>". */
export function PageTitle() {
  const matches = useMatches();
  const title = matches
    .toReversed()
    .map((m) => handleOf(m).title)
    .find(Boolean);

  useEffect(() => {
    document.title = title ? `${title} · ${appConfig.name}` : appConfig.name;
  }, [title]);

  return null;
}
