import { useMemo, useState, type ReactNode } from 'react';

import { featuresConfig } from '@/config';
import { useEventListener } from '@/hooks/useEventListener';
import { isModShortcut } from '@/lib/utils';

import { AppCommandMenu } from './AppCommandMenu';
import { CommandMenuContext } from './command-menu-context';

/**
 * Command menu state + the global Ctrl / Cmd + K shortcut (features.ui.commandMenu).
 * The navbar search box (features.ui.globalSearch) opens the same menu.
 */
export function CommandMenuProvider({ children }: { children: ReactNode }) {
  const { commandMenu, globalSearch } = featuresConfig.ui;
  const enabled = commandMenu || globalSearch;
  const [open, setOpen] = useState(false);

  useEventListener(
    'keydown',
    (event) => {
      if (!isModShortcut(event, 'k')) return;
      event.preventDefault();
      setOpen((current) => !current);
    },
    window,
    { enabled: commandMenu },
  );

  const value = useMemo(() => ({ enabled, open, setOpen }), [enabled, open]);
  return (
    <CommandMenuContext.Provider value={value}>
      {children}
      {enabled && <AppCommandMenu />}
    </CommandMenuContext.Provider>
  );
}
