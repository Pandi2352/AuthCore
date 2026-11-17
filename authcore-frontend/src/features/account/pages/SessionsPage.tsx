import { Laptop, LogOut, MonitorSmartphone, Smartphone, Trash2 } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { DateTime } from '@/components/common/DateTime';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  notifyError,
  notifySuccess,
} from '@/components/feedback';
import { PageContainer, PageHeader } from '@/components/page';
import { Badge, Button, Card } from '@/components/ui';
import { paths } from '@/config';
import { accountApi } from '@/features/account/api/account.api';
import type { Session } from '@/features/account/types/account.types';
import { useAuth } from '@/features/auth';
import { isAbortError } from '@/lib/api';

export const SessionsPage: React.FC = () => {
  const { logoutAll } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<unknown>(null);

  useEffect(() => {
    let isActive = true;
    const controller = new AbortController();
    const load = async () => {
      try {
        const data = await accountApi.getSessions(controller.signal);
        if (isActive) {
          setSessions(data);
          setLoadError(null);
        }
      } catch (err) {
        if (isActive && !isAbortError(err)) setLoadError(err);
      } finally {
        if (isActive) setIsLoading(false);
      }
    };
    void load();
    return () => {
      isActive = false;
      controller.abort();
    };
  }, []);

  const retry = async () => {
    try {
      setSessions(await accountApi.getSessions());
      setLoadError(null);
    } catch (err) {
      setLoadError(err);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    try {
      const res = await accountApi.revokeSession(sessionId);
      if (res.isCurrentSession) {
        window.location.href = paths.auth.login;
        return;
      }
      notifySuccess('Session signed out');
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch (err) {
      notifyError(err, 'Could not revoke the session');
    }
  };

  const handleSignOutOthers = async () => {
    try {
      await logoutAll(true);
      notifySuccess('All other devices have been signed out');
      setSessions((prev) => prev.filter((session) => session.isCurrent));
    } catch (err) {
      notifyError(err, 'Could not sign out the other devices');
    }
  };

  return (
    <PageContainer width="narrow" className="max-w-4xl">
      <PageHeader
        title="Active sessions"
        description="Devices and browsers currently signed in to your account."
        actions={
          sessions.length > 1 && (
            <ConfirmDialog
              trigger={
                <Button variant="outline" leftIcon={<LogOut />}>
                  Sign out all other devices
                </Button>
              }
              title="Sign out all other devices?"
              description="Every other browser and device will need to sign in again. This device stays signed in."
              confirmText="Sign out others"
              destructive
              onConfirm={handleSignOutOthers}
            />
          )
        }
      />

      <Card title={`Signed-in devices (${sessions.length})`}>
        {isLoading ? (
          <LoadingState variant="table" label="Loading sessions" />
        ) : loadError ? (
          <ErrorState size="compact" error={loadError} onRetry={retry} />
        ) : sessions.length === 0 ? (
          <EmptyState size="compact" icon={<MonitorSmartphone />} title="No active sessions" />
        ) : (
          <div className="divide-y divide-border">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="flex flex-col justify-between gap-4 py-4 sm:flex-row sm:items-center"
              >
                <div className="flex items-start gap-3.5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    {session.deviceType === 'mobile' ? (
                      <Smartphone className="h-5 w-5" />
                    ) : (
                      <Laptop className="h-5 w-5" />
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">
                        {session.deviceName || `${session.browser} on ${session.os}`}
                      </span>
                      {session.isCurrent && <Badge tone="success">Current Device</Badge>}
                      {session.isPersistent && <Badge tone="neutral">Remember Me</Badge>}
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>IP: {session.lastIpAddress || session.ipAddress}</span>
                      <span>
                        Signed in <DateTime value={session.signedInAt} />
                      </span>
                      <span>
                        Last active <DateTime value={session.lastUsedAt} format="relative" />
                      </span>
                    </div>
                  </div>
                </div>

                <ConfirmDialog
                  trigger={
                    <Button
                      variant={session.isCurrent ? 'outline' : 'ghost'}
                      size="sm"
                      leftIcon={<Trash2 />}
                      className="text-danger hover:bg-danger-soft hover:text-danger"
                    >
                      {session.isCurrent ? 'Sign out here' : 'Revoke'}
                    </Button>
                  }
                  title={session.isCurrent ? 'Sign out of this device?' : 'Revoke this session?'}
                  description={
                    session.isCurrent
                      ? 'You will be signed out here and returned to the sign-in page.'
                      : `${session.deviceName || `${session.browser} on ${session.os}`} will be signed out immediately.`
                  }
                  confirmText={session.isCurrent ? 'Sign out' : 'Revoke'}
                  destructive
                  onConfirm={() => handleRevokeSession(session.id)}
                />
              </div>
            ))}
          </div>
        )}
      </Card>
    </PageContainer>
  );
};
