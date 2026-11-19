import { ChevronRight } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';

import { Avatar, Tooltip } from '@/components/ui';
import { paths } from '@/config';
import { useMyAvatar } from '@/features/account';
import { useAuth } from '@/features/auth';
import { cn } from '@/lib/utils';

import { useSidebarMode } from './sidebar-mode';
import { sidebarRowClass } from './sidebar.variants';
import { useSidebar } from './useSidebar';

const PROFILE_PATHS: ReadonlySet<string> = new Set([
  paths.account.profile,
  paths.account.security,
  paths.account.sessions,
  paths.account.activity,
]);

/** Sidebar footer: "My profile" — your photo, name and email; collapsed, just the photo. */
export function SidebarProfileCard() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const avatar = useMyAvatar(user?.id);
  const { collapsed } = useSidebar();
  const { tooltipSide } = useSidebarMode();
  if (!user) return null;
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;

  const link = (
    <NavLink
      to={paths.account.profile}
      aria-label={`My profile: ${name}`}
      className={({ isActive }) =>
        cn(
          sidebarRowClass(isActive || PROFILE_PATHS.has(pathname)),
          'py-2',
          collapsed && 'justify-center px-0',
        )
      }
    >
      <Avatar src={avatar} name={name} size="sm" className="shrink-0" />
      {!collapsed && (
        <>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">My profile</span>
            <span className="block truncate text-xs text-sidebar-muted">{name}</span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-sidebar-muted" aria-hidden="true" />
        </>
      )}
    </NavLink>
  );

  return collapsed ? (
    <Tooltip side={tooltipSide} content={`My profile · ${name}`}>
      {link}
    </Tooltip>
  ) : (
    link
  );
}
