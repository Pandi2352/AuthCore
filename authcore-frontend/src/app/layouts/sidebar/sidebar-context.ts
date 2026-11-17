import { createContext } from 'react';

export interface SidebarContextValue {
  /** Icon-only mode (desktop). Persisted per browser. */
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  toggleCollapsed: () => void;
  /** Mobile drawer state (below layout.sidebar.mobileBreakpoint). */
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  /** At or above the mobile breakpoint: the sidebar is part of the layout. */
  isDesktop: boolean;
  /** Ids of expanded submenus (persisted). */
  expandedIds: readonly string[];
  setExpanded: (id: string, expanded: boolean) => void;
}

export const SidebarContext = createContext<SidebarContextValue | null>(null);
