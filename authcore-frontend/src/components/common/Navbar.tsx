import { LogOut, Shield } from 'lucide-react';
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { projectConfig } from '@/config/project';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const { isSuperAdmin } = usePermissions();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-8">
          <Link
            to="/dashboard"
            className="flex items-center gap-2 text-lg font-bold text-slate-900"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-xl font-black text-white shadow-sm">
              {projectConfig.name.charAt(0)}
            </div>
            <span>{projectConfig.name}</span>
          </Link>

          <nav className="hidden items-center gap-1 text-sm font-medium text-slate-600 md:flex">
            <Link
              to="/dashboard"
              className="rounded-lg px-3 py-2 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              Dashboard
            </Link>
            <Link
              to="/profile"
              className="rounded-lg px-3 py-2 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              Profile
            </Link>
            <Link
              to="/security"
              className="rounded-lg px-3 py-2 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              Security
            </Link>
            <Link
              to="/sessions"
              className="rounded-lg px-3 py-2 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              Sessions
            </Link>
            <Link
              to="/activity"
              className="rounded-lg px-3 py-2 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              Activity
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {isSuperAdmin && (
            <span className="hidden items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 sm:inline-flex">
              <Shield className="h-3.5 w-3.5" />
              Admin
            </span>
          )}

          <div className="flex items-center gap-2 border-l border-slate-200 pl-2 text-sm">
            <span className="hidden font-medium text-slate-700 sm:block">
              {user?.firstName} {user?.lastName || ''}
            </span>
            <button
              onClick={handleLogout}
              className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600"
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
