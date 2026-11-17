import { Activity, CheckCircle, KeyRound, Laptop, User as UserIcon } from 'lucide-react';
import React from 'react';
import { Link } from 'react-router-dom';

import { Badge } from '@/components/common/Badge';
import { Card } from '@/components/common/Card';
import { paths } from '@/config';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { formatDate } from '@/lib/utils';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { isSuperAdmin, roles, permissions } = usePermissions();

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="rounded-md bg-primary p-6 text-primary-foreground sm:p-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
                Welcome back, {user?.firstName}!
              </h1>
              {user?.isEmailVerified && (
                <span title="Verified Account">
                  <CheckCircle className="h-5 w-5" aria-hidden="true" />
                </span>
              )}
            </div>
            <p className="text-sm text-primary-foreground/80">
              Manage your personal identity, devices, and security credentials.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Badge className="border-primary-foreground/30 bg-primary-foreground/15 text-primary-foreground">
              {user?.role}
            </Badge>
            {isSuperAdmin && (
              <Badge className="border-primary-foreground/30 bg-primary-foreground/15 text-primary-foreground">
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
            <div className="flex justify-between border-b border-border py-1">
              <span className="text-muted-foreground">Email</span>
              <span className="font-medium text-foreground">{user?.email}</span>
            </div>
            <div className="flex justify-between border-b border-border py-1">
              <span className="text-muted-foreground">Username</span>
              <span className="font-medium text-foreground">{user?.username || '—'}</span>
            </div>
            <div className="flex justify-between border-b border-border py-1">
              <span className="text-muted-foreground">Status</span>
              <Badge variant="success">{user?.status}</Badge>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground">Member Since</span>
              <span className="font-medium text-foreground">{formatDate(user?.createdAt)}</span>
            </div>
          </div>
        </Card>

        <Card title="Effective Access" className="space-y-3">
          <div className="space-y-2 text-sm">
            <div>
              <span className="mb-1 block text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Assigned Roles ({roles.length})
              </span>
              <div className="flex flex-wrap gap-1">
                {roles.length > 0 ? (
                  roles.map((r) => (
                    <Badge key={r} variant="neutral">
                      {r}
                    </Badge>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground">Standard Member</span>
                )}
              </div>
            </div>

            <div className="border-t border-border pt-2">
              <span className="mb-1 block text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Effective Permissions ({permissions.length})
              </span>
              <div className="flex max-h-24 flex-wrap gap-1 overflow-y-auto">
                {isSuperAdmin ? (
                  <Badge variant="primary">ALL_PERMISSIONS (Super Admin)</Badge>
                ) : permissions.length > 0 ? (
                  permissions.map((p) => (
                    <Badge key={p} variant="info" className="text-[10px]">
                      {p}
                    </Badge>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground">None</span>
                )}
              </div>
            </div>
          </div>
        </Card>

        <Card title="Quick Actions" className="space-y-2">
          <Link
            to={paths.account.profile}
            className="flex items-center gap-3 rounded-md border border-transparent p-2.5 text-sm font-medium text-foreground transition-colors hover:border-border hover:bg-accent"
          >
            <UserIcon className="h-4 w-4 text-primary" />
            Edit Profile & Avatar
          </Link>
          <Link
            to={paths.account.security}
            className="flex items-center gap-3 rounded-md border border-transparent p-2.5 text-sm font-medium text-foreground transition-colors hover:border-border hover:bg-accent"
          >
            <KeyRound className="h-4 w-4 text-primary" />
            Change Password
          </Link>
          <Link
            to={paths.account.sessions}
            className="flex items-center gap-3 rounded-md border border-transparent p-2.5 text-sm font-medium text-foreground transition-colors hover:border-border hover:bg-accent"
          >
            <Laptop className="h-4 w-4 text-primary" />
            Manage Active Sessions
          </Link>
          <Link
            to={paths.account.activity}
            className="flex items-center gap-3 rounded-md border border-transparent p-2.5 text-sm font-medium text-foreground transition-colors hover:border-border hover:bg-accent"
          >
            <Activity className="h-4 w-4 text-primary" />
            View Login History
          </Link>
        </Card>
      </div>
    </div>
  );
};
