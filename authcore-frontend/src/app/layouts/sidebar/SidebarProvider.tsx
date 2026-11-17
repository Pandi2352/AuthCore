import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

import { layoutConfig } from '@/config';
import { useEventListener } from '@/hooks/useEventListener';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useBreakpoint } from '@/hooks/useMediaQuery';
import { isModShortcut } from '@/lib/utils';

import { SidebarContext, type SidebarContextValue } from './sidebar-context';

const NO_IDS: string[] = [];
const toBoolean = (value: unknown): boolean | null => (typeof value === 'boolean' ? value : null);
const toIdList = (value: unknown): string[] | null =>
  Array.isArray(value) && value.every((v) => typeof v === 'string') ? (value as string[]) : null;

/**
 * Sidebar state: collapsed (persisted, Ctrl / Cmd + B), mobile drawer (closes on
 * navigation), expanded submenus (persisted).
 */
export function SidebarProvider({ children }: { children: ReactNode }) {
  const { sidebar } = layoutConfig;
  const isDesktop = useBreakpoint(sidebar.mobileBreakpoint);
  const [storedCollapsed, setStoredCollapsed] = useLocalStorage(
    'sidebarCollapsed',
    sidebar.defaultCollapsed,
    {
      validate: toBoolean,
    },
  );
  const [expandedIds, setExpandedIds] = useLocalStorage<string[]>('sidebarExpanded', NO_IDS, {
    validate: toIdList,
  });
  const collapsed = sidebar.collapsible && isDesktop && storedCollapsed;
  const { pathname } = useLocation();
  // The drawer belongs to the page it was opened on: navigating (or growing to desktop) closes it.
  const drawerKey = `${pathname}|${isDesktop}`;
  const [openDrawerKey, setOpenDrawerKey] = useState<string | null>(null);
  const mobileOpen = openDrawerKey === drawerKey;
  const setMobileOpen = useCallback(
    (open: boolean) => setOpenDrawerKey(open ? drawerKey : null),
    [drawerKey],
  );

  const setCollapsed = useCallback(
    (value: boolean) => {
      if (sidebar.collapsible) setStoredCollapsed(value);
    },
    [sidebar.collapsible, setStoredCollapsed],
  );
  const toggleCollapsed = useCallback(() => {
    if (isDesktop) setCollapsed(!storedCollapsed);
    else setMobileOpen(!mobileOpen);
  }, [isDesktop, setCollapsed, storedCollapsed, setMobileOpen, mobileOpen]);

  const setExpanded = useCallback(
    (id: string, expanded: boolean) =>
      setExpandedIds((ids) => {
        // Same array when nothing changes: no re-render, no storage write.
        if (expanded === ids.includes(id) && !(expanded && sidebar.singleSubmenu && ids.length > 1))
          return ids;
        if (!expanded) return ids.filter((x) => x !== id);
        return sidebar.singleSubmenu ? [id] : [...ids, id];
      }),
    [setExpandedIds, sidebar.singleSubmenu],
  );

  // Ctrl / Cmd + B toggles the sidebar (not while typing in a field).
  useEventListener(
    'keydown',
    (event) => {
      if (!isModShortcut(event, 'b')) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, [contenteditable="true"]')) return;
      event.preventDefault();
      toggleCollapsed();
    },
    window,
    { enabled: sidebar.enabled },
  );

  const value = useMemo<SidebarContextValue>(
    () => ({
      collapsed,
      setCollapsed,
      toggleCollapsed,
      mobileOpen,
      setMobileOpen,
      isDesktop,
      expandedIds,
      setExpanded,
    }),
    [
      collapsed,
      setCollapsed,
      toggleCollapsed,
      mobileOpen,
      setMobileOpen,
      isDesktop,
      expandedIds,
      setExpanded,
    ],
  );
  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}
