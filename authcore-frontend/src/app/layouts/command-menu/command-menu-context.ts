import { createContext, useContext } from 'react';

export interface CommandMenuContextValue {
  /** Command menu / search available (features.ui.commandMenu or ui.globalSearch). */
  enabled: boolean;
  open: boolean;
  setOpen: (open: boolean) => void;
}

export const CommandMenuContext = createContext<CommandMenuContextValue>({
  enabled: false,
  open: false,
  setOpen: () => undefined,
});

export const useCommandMenu = (): CommandMenuContextValue => useContext(CommandMenuContext);
