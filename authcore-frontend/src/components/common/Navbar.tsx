import { LogOut, Palette, Shield } from 'lucide-react';
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { appConfig, featuresConfig, paths } from '@/config';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';

import { ThemeToggle } from './ThemeToggle';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const { isSuperAdmin } = usePermissions();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate(paths.auth.login);
  };

  return (
    <header className="sticky top-0 z-(--z-navbar) border-b border-navbar-border bg-navbar text-navbar-foreground">
      <div className="mx-auto flex h-(--navbar-height) max-w-(--content-max-width) items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-8">
          <Link
            to={paths.dashboard}
            className="flex items-center gap-2 text-lg font-bold text-navbar-foreground"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-xl font-black text-primary-foreground">
              {appConfig.name.charAt(0)}
            </div>
            <span>{appConfig.name}</span>
          </Link>

          <nav className="hidden items-center gap-1 text-sm font-medium text-muted-foreground md:flex">
            <Link
              to={paths.dashboard}
              className="rounded-md px-3 py-2 transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              Dashboard
            </Link>
            <Link
              to={paths.account.profile}
              className="rounded-md px-3 py-2 transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              Profile
            </Link>
            <Link
              to={paths.account.security}
              className="rounded-md px-3 py-2 transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              Security
            </Link>
            <Link
              to={paths.account.sessions}
              className="rounded-md px-3 py-2 transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              Sessions
            </Link>
            <Link
              to={paths.account.activity}
              className="rounded-md px-3 py-2 transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              Activity
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {isSuperAdmin && (
            <span className="hidden items-center gap-1 rounded-md border border-primary/25 bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary-soft-foreground sm:inline-flex">
              <Shield className="h-3.5 w-3.5" />
              Admin
            </span>
          )}

          <ThemeToggle />
          {featuresConfig.ui.themeCustomizer && (
            <Link
              to={paths.settings.appearance}
              className="inline-flex h-control-sm w-control-sm items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              title="Appearance"
              aria-label="Appearance"
            >
              <Palette className="h-4 w-4" aria-hidden="true" />
            </Link>
          )}

          <div className="flex items-center gap-2 border-l border-navbar-border pl-2 text-sm">
            <span className="hidden font-medium text-foreground sm:block">
              {user?.firstName} {user?.lastName || ''}
            </span>
            <button
              onClick={handleLogout}
              className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-danger-soft hover:text-danger"
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
