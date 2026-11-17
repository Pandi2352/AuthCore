import { Laptop, LogOut, Smartphone, Trash2 } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { Alert, Badge, Button, Card } from '@/components/ui';
import { paths } from '@/config';
import { accountApi } from '@/features/account/api/account.api';
import type { Session } from '@/features/account/types/account.types';
import { useAuth } from '@/features/auth';
import { ApiError } from '@/lib/api';
import { formatDate } from '@/lib/format';

export const SessionsPage: React.FC = () => {
  const { logoutAll } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;
    const load = async () => {
      try {
        const data = await accountApi.getSessions();
        if (isActive) setSessions(data);
      } catch (err) {
        if (isActive) setError(err instanceof ApiError ? err.message : 'Failed to load sessions');
      } finally {
        if (isActive) setIsLoading(false);
      }
    };
    void load();
    return () => {
      isActive = false;
    };
  }, []);

  const handleRevokeSession = async (sessionId: string) => {
    setError(null);
    try {
      const res = await accountApi.revokeSession(sessionId);
      if (res.isCurrentSession) {
        window.location.href = paths.auth.login;
        return;
      }
      setSuccess('Session signed out successfully');
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to revoke session');
    }
  };

  const handleSignOutOthers = async () => {
    setError(null);
    try {
      await logoutAll(true);
      setSuccess('All other sessions have been signed out');
      setSessions((prev) => prev.filter((session) => session.isCurrent));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to revoke other sessions');
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Active Sessions</h1>
          <p className="text-sm text-muted-foreground">
            Devices and browsers currently logged into your account
          </p>
        </div>

        {sessions.length > 1 && (
          <Button variant="outline" size="sm" onClick={handleSignOutOthers}>
            <LogOut className="mr-1.5 h-4 w-4" />
            Sign Out All Other Devices
          </Button>
        )}
      </div>

      {error && <Alert variant="danger" message={error} onClose={() => setError(null)} />}
      {success && <Alert variant="success" message={success} onClose={() => setSuccess(null)} />}

      <Card title={`Logged In Devices (${sessions.length})`}>
        {isLoading ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Loading sessions...</p>
        ) : sessions.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No active sessions found.
          </p>
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
                      <span>Signed in: {formatDate(session.signedInAt)}</span>
                      <span>Last active: {formatDate(session.lastUsedAt)}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <Button
                    variant={session.isCurrent ? 'outline' : 'ghost'}
                    size="sm"
                    onClick={() => handleRevokeSession(session.id)}
                    className="text-danger hover:bg-danger-soft hover:text-danger"
                  >
                    <Trash2 className="mr-1.5 h-4 w-4" />
                    {session.isCurrent ? 'Sign Out Here' : 'Revoke'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};
