import { Activity, CheckCircle, KeyRound, Laptop, User as UserIcon } from 'lucide-react';
import React from 'react';
import { Link } from 'react-router-dom';

import { Badge } from '@/components/common/Badge';
import { Card } from '@/components/common/Card';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { formatDate } from '@/lib/utils';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { isSuperAdmin, roles, permissions } = usePermissions();

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-indigo-700 to-indigo-900 p-6 text-white shadow-md sm:p-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
                Welcome back, {user?.firstName}!
              </h1>
              {user?.isEmailVerified && (
                <span title="Verified Account">
                  <CheckCircle className="h-5 w-5 text-emerald-400" />
                </span>
              )}
            </div>
            <p className="text-sm text-indigo-200">
              Manage your personal identity, devices, and security credentials.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="blue" className="border-indigo-400 bg-indigo-600/60 text-white">
              {user?.role}
            </Badge>
            {isSuperAdmin && (
              <Badge variant="purple" className="border-purple-400 bg-purple-600/80 text-white">
                Super Admin
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Account Info Cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <Card title="Identity Overview" className="space-y-3">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between border-b border-slate-100 py-1">
              <span className="text-slate-500">Email</span>
              <span className="font-medium text-slate-800">{user?.email}</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 py-1">
              <span className="text-slate-500">Username</span>
              <span className="font-medium text-slate-800">{user?.username || '—'}</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 py-1">
              <span className="text-slate-500">Status</span>
              <Badge variant="emerald">{user?.status}</Badge>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Member Since</span>
              <span className="font-medium text-slate-800">{formatDate(user?.createdAt)}</span>
            </div>
          </div>
        </Card>

        <Card title="Effective Access" className="space-y-3">
          <div className="space-y-2 text-sm">
            <div>
              <span className="mb-1 block text-xs font-semibold tracking-wider text-slate-500 uppercase">
                Assigned Roles ({roles.length})
              </span>
              <div className="flex flex-wrap gap-1">
                {roles.length > 0 ? (
                  roles.map((r) => (
                    <Badge key={r} variant="slate">
                      {r}
                    </Badge>
                  ))
                ) : (
                  <span className="text-xs text-slate-400">Standard Member</span>
                )}
              </div>
            </div>

            <div className="border-t border-slate-100 pt-2">
              <span className="mb-1 block text-xs font-semibold tracking-wider text-slate-500 uppercase">
                Effective Permissions ({permissions.length})
              </span>
              <div className="flex max-h-24 flex-wrap gap-1 overflow-y-auto">
                {isSuperAdmin ? (
                  <Badge variant="purple">ALL_PERMISSIONS (Super Admin)</Badge>
                ) : permissions.length > 0 ? (
                  permissions.map((p) => (
                    <Badge key={p} variant="blue" className="text-[10px]">
                      {p}
                    </Badge>
                  ))
                ) : (
                  <span className="text-xs text-slate-400">None</span>
                )}
              </div>
            </div>
          </div>
        </Card>

        <Card title="Quick Actions" className="space-y-2">
          <Link
            to="/profile"
            className="flex items-center gap-3 rounded-lg border border-transparent p-2.5 text-sm font-medium text-slate-700 transition-colors hover:border-slate-200 hover:bg-slate-50"
          >
            <UserIcon className="h-4 w-4 text-indigo-600" />
            Edit Profile & Avatar
          </Link>
          <Link
            to="/security"
            className="flex items-center gap-3 rounded-lg border border-transparent p-2.5 text-sm font-medium text-slate-700 transition-colors hover:border-slate-200 hover:bg-slate-50"
          >
            <KeyRound className="h-4 w-4 text-indigo-600" />
            Change Password
          </Link>
          <Link
            to="/sessions"
            className="flex items-center gap-3 rounded-lg border border-transparent p-2.5 text-sm font-medium text-slate-700 transition-colors hover:border-slate-200 hover:bg-slate-50"
          >
            <Laptop className="h-4 w-4 text-indigo-600" />
            Manage Active Sessions
          </Link>
          <Link
            to="/activity"
            className="flex items-center gap-3 rounded-lg border border-transparent p-2.5 text-sm font-medium text-slate-700 transition-colors hover:border-slate-200 hover:bg-slate-50"
          >
            <Activity className="h-4 w-4 text-indigo-600" />
            View Login History
          </Link>
        </Card>
      </div>
    </div>
  );
};
