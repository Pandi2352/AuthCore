import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { featuresConfig } from '@/config';
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

  useEffect(() => {
    if (!commandMenu) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isModShortcut(event, 'k')) return;
      event.preventDefault();
      setOpen((current) => !current);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [commandMenu]);

  const value = useMemo(() => ({ enabled, open, setOpen }), [enabled, open]);
  return (
    <CommandMenuContext.Provider value={value}>
      {children}
      {enabled && <AppCommandMenu />}
    </CommandMenuContext.Provider>
  );
}
