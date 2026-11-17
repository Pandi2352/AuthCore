import { createContext, useContext } from 'react';

import { useOptionalTheme } from '@/app/theme';
import type { SidebarStyle } from '@/types/theme.types';

import { useSidebarPosition } from './sidebar-position';
import { useSidebar } from './useSidebar';

/** Rendering mode for sidebar parts: the mobile drawer is always expanded. */
export const SidebarModeContext = createContext<{ collapsed: boolean; inDrawer: boolean } | null>(
  null,
);

export function useSidebarMode(): {
  collapsed: boolean;
  inDrawer: boolean;
  variant: SidebarStyle;
  tooltipSide: 'left' | 'right';
} {
  const sidebar = useSidebar();
  const mode = useContext(SidebarModeContext);
  const theme = useOptionalTheme();
  const position = useSidebarPosition();
  return {
    collapsed: mode?.collapsed ?? sidebar.collapsed,
    inDrawer: mode?.inDrawer ?? false,
    variant: theme?.appearance.sidebar ?? 'classic',
    tooltipSide: position === 'left' ? 'right' : 'left',
  };
}
