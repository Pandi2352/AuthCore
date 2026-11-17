import { useCallback, useMemo } from 'react';

import type { NavbarCommand } from '@/types/config.types';
import type { ColorMode } from '@/types/theme.types';

import { useTheme } from '../../theme';
import { useCommandMenu } from '../command-menu/command-menu-context';
import { useSidebar } from '../sidebar';

const NEXT_MODE: Record<ColorMode, ColorMode> = { light: 'dark', dark: 'system', system: 'light' };

/** Built-in behaviours for navbar buttons and command-menu actions. */
export function useNavbarCommands(): Record<NavbarCommand, () => void> {
  const { setOpen } = useCommandMenu();
  const { toggleCollapsed } = useSidebar();
  const { mode, setMode } = useTheme();
  const toggleTheme = useCallback(() => setMode(NEXT_MODE[mode]), [mode, setMode]);
  return useMemo(
    () => ({
      openCommandMenu: () => setOpen(true),
      toggleSidebar: toggleCollapsed,
      toggleTheme,
    }),
    [setOpen, toggleCollapsed, toggleTheme],
  );
}
