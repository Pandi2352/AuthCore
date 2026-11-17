import type { LayoutConfig } from '@/types/config.types';

/**
 * Sizes and behavior of the shell. The *look* of the sidebar / navbar / cards
 * (classic, floating, transparent …) is theme appearance (theme.config.ts),
 * so it can change without touching layout.
 */
export const layoutConfig: LayoutConfig = {
  sidebar: {
    enabled: true,
    position: 'left',
    width: 264,
    collapsedWidth: 72,
    collapsible: true,
    defaultCollapsed: false,
    behavior: 'sticky',
    mobileBreakpoint: 'lg',
    showAppName: true,
  },
  navbar: {
    enabled: true,
    height: 64,
    sticky: true,
    showLogo: 'when-sidebar-hidden',
    showBreadcrumbs: true,
    actions: ['search', 'themeToggle', 'notifications', 'userMenu'],
    customActions: [],
  },
  content: {
    maxWidth: 'container',
    padding: 'comfortable',
  },
  auth: {
    variant: 'centered',
    sideImage: null,
  },
};
