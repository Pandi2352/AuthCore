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
    width: 240,
    collapsedWidth: 72,
    collapsible: true,
    singleSubmenu: true, // opening a submenu closes the others
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
    showSidebarToggle: true,
    showBreadcrumbs: true,
    actions: ['search', 'commandMenu', 'notifications', 'themeToggle', 'userMenu'],
    customActions: [],
    // Example: { id: 'docs', label: 'Documentation', icon: 'FileText', href: 'https://example.com/docs', external: true }
    //          { id: 'palette', label: 'Command menu', icon: 'Search', command: 'openCommandMenu' }
    overflowBelow: 'md',
  },
  content: {
    maxWidth: 'full', // 'full' | 'container' (centered, --content-max-width) | 'narrow'
    padding: 'comfortable',
  },
  auth: {
    variant: 'centered',
    sideImage: null,
  },
};
