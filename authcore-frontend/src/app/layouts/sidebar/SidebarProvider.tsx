import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

import { layoutConfig } from '@/config';
import { useBreakpoint } from '@/hooks/useMediaQuery';
import { usePersistentState } from '@/hooks/usePersistentState';
import { isModShortcut } from '@/lib/utils';

import { SidebarContext, type SidebarContextValue } from './sidebar-context';

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
  const [storedCollapsed, setStoredCollapsed] = usePersistentState(
    'sidebar-collapsed',
    sidebar.defaultCollapsed,
    toBoolean,
  );
  const [expandedIds, setExpandedIds] = usePersistentState<string[]>(
    'sidebar-expanded',
    [],
    toIdList,
  );
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
      setExpandedIds((ids) =>
        expanded ? [...new Set([...ids, id])] : ids.filter((x) => x !== id),
      ),
    [setExpandedIds],
  );

  // Ctrl / Cmd + B toggles the sidebar (not while typing in a field).
  useEffect(() => {
    if (!sidebar.enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isModShortcut(event, 'b')) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, [contenteditable="true"]')) return;
      event.preventDefault();
      toggleCollapsed();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [sidebar.enabled, toggleCollapsed]);

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
