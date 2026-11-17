import { LogOut, Monitor, Moon, PanelLeft, Sun } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { CommandPalette, type CommandGroup, type CommandItem } from '@/components/ui';
import { icons, layoutConfig, paths } from '@/config';
import { useAuth } from '@/features/auth';
import { modKeyLabel } from '@/lib/utils';
import type { NavItem } from '@/types/navigation.types';

import { useTheme } from '../../theme';
import { useSidebar, useVisibleNavigation } from '../sidebar';
import { useCommandMenu } from './command-menu-context';

/**
 * The app's command menu: every page the user can open (from navigation.config.ts, same
 * flag / permission filtering as the sidebar) plus common actions. Projects add groups here
 * (e.g. search results from the API) as features arrive.
 */
export function AppCommandMenu() {
  const { open, setOpen } = useCommandMenu();
  const { groups: navGroups, footer } = useVisibleNavigation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { setMode, userCustomizable } = useTheme();
  const { isDesktop, toggleCollapsed } = useSidebar();

  const groups = useMemo<CommandGroup[]>(() => {
    const pageItem = (item: NavItem, section: string | undefined): CommandItem | null => {
      if (!item.path || item.disabled) return null;
      const Icon = item.icon ? icons[item.icon] : null;
      const path = item.path;
      return {
        id: `page-${item.id}`,
        label: item.title,
        description: section,
        keywords: [item.id],
        icon: Icon ? <Icon aria-hidden="true" /> : undefined,
        badge: item.status === 'planned' ? 'Soon' : undefined,
        onSelect: () =>
          item.external ? window.open(path, '_blank', 'noopener,noreferrer') : navigate(path),
      };
    };
    const pages: CommandItem[] = [];
    for (const group of [...navGroups, footer]) {
      for (const item of group.items) {
        const own = pageItem(item, group.title);
        if (own) pages.push(own);
        for (const child of item.children ?? []) {
          const nested = pageItem(child, [group.title, item.title].filter(Boolean).join(' › '));
          if (nested) pages.push(nested);
        }
      }
    }

    const actions: CommandItem[] = [];
    if (userCustomizable.mode) {
      actions.push(
        {
          id: 'theme-light',
          label: 'Switch to light theme',
          keywords: ['mode', 'appearance'],
          icon: <Sun aria-hidden="true" />,
          onSelect: () => setMode('light'),
        },
        {
          id: 'theme-dark',
          label: 'Switch to dark theme',
          keywords: ['mode', 'appearance'],
          icon: <Moon aria-hidden="true" />,
          onSelect: () => setMode('dark'),
        },
        {
          id: 'theme-system',
          label: 'Use system theme',
          keywords: ['mode', 'appearance', 'auto'],
          icon: <Monitor aria-hidden="true" />,
          onSelect: () => setMode('system'),
        },
      );
    }
    if (layoutConfig.sidebar.enabled && layoutConfig.sidebar.collapsible && isDesktop) {
      actions.push({
        id: 'toggle-sidebar',
        label: 'Toggle sidebar',
        keywords: ['collapse', 'expand', 'menu'],
        icon: <PanelLeft aria-hidden="true" />,
        shortcut: `${modKeyLabel()} B`,
        onSelect: toggleCollapsed,
      });
    }
    actions.push({
      id: 'sign-out',
      label: 'Sign out',
      keywords: ['logout', 'log out'],
      icon: <LogOut aria-hidden="true" />,
      onSelect: () => {
        void logout().then(() => navigate(paths.auth.login, { replace: true }));
      },
    });

    return [
      { id: 'pages', heading: 'Pages', items: pages },
      { id: 'actions', heading: 'Actions', items: actions },
    ];
  }, [
    navGroups,
    footer,
    navigate,
    logout,
    setMode,
    userCustomizable.mode,
    isDesktop,
    toggleCollapsed,
  ]);

  return <CommandPalette open={open} onOpenChange={setOpen} groups={groups} />;
}
