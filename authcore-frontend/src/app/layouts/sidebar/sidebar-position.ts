import { useOptionalTheme } from '@/app/theme';
import { layoutConfig } from '@/config';
import type { SidebarPosition } from '@/types/theme.types';

/** Sidebar side: the user's choice (Appearance → Sidebar position), else layout.config.ts. */
export function useSidebarPosition(): SidebarPosition {
  return useOptionalTheme()?.appearance.sidebarPosition ?? layoutConfig.sidebar.position;
}
