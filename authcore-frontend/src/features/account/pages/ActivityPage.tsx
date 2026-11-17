import { CheckCircle2, History, XCircle } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { DateTime } from '@/components/common/DateTime';
import { EmptyState, ErrorState, LoadingState } from '@/components/feedback';
import { PageContainer, PageHeader } from '@/components/page';
import { Badge, Card, Select } from '@/components/ui';
import { accountApi } from '@/features/account/api/account.api';
import type { UserActivityEntry } from '@/features/account/types/account.types';

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
  const [filterEvent, setFilterEvent] = useState<string>('');
  const [loadError, setLoadError] = useState<unknown>(null);

  useEffect(() => {
    let isActive = true;
    const load = async () => {
      try {
        const data = await accountApi.getActivity(filterEvent || undefined);
        if (isActive) {
          setActivities(data);
          setLoadError(null);
        }
      } catch (err) {
        if (isActive) setLoadError(err);
      } finally {
        if (isActive) setIsLoading(false);
      }
    };
    void load();
    return () => {
      isActive = false;
    };
  }, [filterEvent]);

  const retry = async () => {
    try {
      setActivities(await accountApi.getActivity(filterEvent || undefined));
      setLoadError(null);
    } catch (err) {
      setLoadError(err);
    }
  };

  return (
    <PageContainer width="narrow" className="max-w-4xl">
      <PageHeader
        title="Recent activity"
        description="Security audit trail of sign-ins, security updates and access changes."
        actions={
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
        }
      />

      <Card title="Audit History">
        {isLoading ? (
          <LoadingState variant="table" label="Loading activity" />
        ) : loadError ? (
          <ErrorState size="compact" error={loadError} onRetry={retry} />
        ) : activities.length === 0 ? (
          <EmptyState
            size="compact"
            icon={<History />}
            title="No activity yet"
            description={
              filterEvent
                ? 'Nothing matches this filter. Try “All events”.'
                : 'Sign-ins and security changes will appear here.'
            }
          />
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

                <DateTime
                  value={item.timestamp}
                  format="relative"
                  className="shrink-0 text-xs text-muted-foreground"
                />
              </div>
            ))}
          </div>
        )}
      </Card>
    </PageContainer>
  );
};
