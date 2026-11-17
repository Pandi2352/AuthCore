import { CheckCircle2, XCircle } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { Alert, Badge, Card, Select } from '@/components/ui';
import { accountApi } from '@/features/account/api/account.api';
import type { UserActivityEntry } from '@/features/account/types/account.types';
import { ApiError } from '@/lib/api';
import { formatDate } from '@/lib/format';

const EVENT_FILTERS = [
  { value: '', label: 'All events' },
  { value: 'LOGIN', label: 'Sign in' },
  { value: 'LOGIN_FAILED', label: 'Failed sign in' },
  { value: 'LOGOUT', label: 'Sign out' },
  { value: 'PASSWORD_CHANGED', label: 'Password changed' },
  { value: 'NEW_DEVICE_LOGIN', label: 'New device sign in' },
];

export const ActivityPage: React.FC = () => {
  const [activities, setActivities] = useState<UserActivityEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterEvent, setFilterEvent] = useState<string>('');

  useEffect(() => {
    let isActive = true;
    const load = async () => {
      try {
        const data = await accountApi.getActivity(filterEvent || undefined);
        if (isActive) setActivities(data);
      } catch (err) {
        if (isActive) setError(err instanceof ApiError ? err.message : 'Failed to load activity');
      } finally {
        if (isActive) setIsLoading(false);
      }
    };
    void load();
    return () => {
      isActive = false;
    };
  }, [filterEvent]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Recent Activity</h1>
          <p className="text-sm text-muted-foreground">
            Security audit trail of logins, security updates, and access changes
          </p>
        </div>

        <div className="w-full sm:w-56">
          <Select
            aria-label="Filter by event"
            value={filterEvent}
            onValueChange={(value) => {
              setIsLoading(true);
              setFilterEvent(value ?? '');
            }}
            options={EVENT_FILTERS}
          />
        </div>
      </div>

      {error && <Alert variant="danger" message={error} onClose={() => setError(null)} />}

      <Card title="Audit History">
        {isLoading ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Loading audit records...</p>
        ) : activities.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No activity records recorded.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {activities.map((item) => (
              <div key={item.id} className="flex items-start justify-between gap-4 py-3.5">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {item.isSuccess ? (
                      <CheckCircle2 className="h-5 w-5 text-success" aria-hidden="true" />
                    ) : (
                      <XCircle className="h-5 w-5 text-danger" aria-hidden="true" />
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">
                        {item.event.replace(/_/g, ' ')}
                      </span>
                      <Badge tone={item.isSuccess ? 'success' : 'danger'}>
                        {item.isSuccess ? 'Success' : 'Failed'}
                      </Badge>
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span>IP: {item.ipAddress}</span>
                      {item.browser && (
                        <span>
                          {item.browser} on {item.os || 'Unknown OS'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatDate(item.timestamp)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};
