import { Bug, Plus, Users } from 'lucide-react';
import { useState } from 'react';

import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { CopyButton } from '@/components/common/CopyButton';
import { DateTime } from '@/components/common/DateTime';
import { FileDropzone } from '@/components/common/FileDropzone';
import { SearchInput } from '@/components/common/SearchInput';
import { StatusBadge } from '@/components/common/StatusBadge';
import {
  EmptyState,
  ErrorBoundary,
  ErrorState,
  LoadingState,
  NoPermissionState,
} from '@/components/feedback';
import { FilterBar, PageHeader, PageSection, ResponsiveGrid } from '@/components/page';
import { Button, Card, toast } from '@/components/ui';
import { useQueryParams } from '@/hooks/useQueryParams';
import { ApiError } from '@/lib/api';
import { ERROR_CODES } from '@/lib/constants';

const SAMPLE_ERROR = new ApiError(
  {
    success: false,
    message: 'The user could not be found.',
    code: ERROR_CODES.NOT_FOUND,
    statusCode: 404,
    timestamp: new Date(0).toISOString(),
    path: '/api/v1/users/42',
  },
  'req_01HZX8Q4N2',
);
const NETWORK_ERROR = new ApiError({
  success: false,
  message: 'Failed to fetch',
  code: ERROR_CODES.NETWORK_ERROR,
  statusCode: 0,
  timestamp: new Date(0).toISOString(),
  path: '/api/v1/users',
});
const HOURS_AGO = new Date(Date.UTC(2026, 10, 17, 9, 30));

function Bomb({ explode }: { explode: boolean }) {
  if (explode) throw new Error('Widget render failed (demo)');
  return (
    <p className="text-sm text-muted-foreground">This widget renders fine until you break it.</p>
  );
}

/** Module 10 components on the kitchen-sink page. */
export function PageFeedbackShowcase() {
  const [query, setQuery] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [explode, setExplode] = useState(false);
  const [filters] = useQueryParams({ q: '', status: '', role: '' });

  return (
    <div className="space-y-8">
      <Card>
        <PageHeader
          title="Users"
          description="Everyone who can sign in to this workspace."
          meta={<StatusBadge status="active" />}
          back={<a href="#ks-page">Administration</a>}
          actions={
            <>
              <Button variant="outline">Export</Button>
              <Button leftIcon={<Plus />}>Invite user</Button>
            </>
          }
        />
      </Card>

      <PageSection
        title="Filter bar (URL-synced)"
        description="Search and filters live in the URL: refresh or share the link and they stay."
      >
        <div className="space-y-3">
          <FilterBar
            searchKey="q"
            searchPlaceholder="Search users…"
            filters={[
              {
                key: 'status',
                label: 'Status',
                options: [
                  { value: 'active', label: 'Active' },
                  { value: 'invited', label: 'Invited' },
                  { value: 'suspended', label: 'Suspended' },
                ],
              },
              {
                key: 'role',
                label: 'Role',
                options: [
                  { value: 'admin', label: 'Admin' },
                  { value: 'member', label: 'Member' },
                ],
              },
            ]}
          />
          <p className="text-xs text-muted-foreground">
            Current: q=&quot;{filters.q}&quot; status=&quot;{filters.status}&quot; role=&quot;
            {filters.role}&quot;
          </p>
          <div className="max-w-xs">
            <SearchInput aria-label="Standalone search" value={query} onSearch={setQuery} />
          </div>
          <p className="text-xs text-muted-foreground">Debounced value: &quot;{query}&quot;</p>
        </div>
      </PageSection>

      <PageSection title="States" variant="plain">
        <ResponsiveGrid cols={{ base: 1, md: 2, xl: 3 }}>
          <Card title="Loading — spinner">
            <LoadingState label="Loading users" />
          </Card>
          <Card title="Loading — table">
            <LoadingState variant="table" count={3} />
          </Card>
          <Card title="Loading — skeleton">
            <LoadingState variant="skeleton" count={4} />
          </Card>
          <Card title="Empty">
            <EmptyState
              size="compact"
              icon={<Users />}
              title="No users yet"
              description="Invite your team to get started."
              action={<Button size="sm">Invite user</Button>}
            />
          </Card>
          <Card title="Error (API, with request id)">
            <ErrorState
              size="compact"
              error={SAMPLE_ERROR}
              onRetry={() => new Promise((r) => setTimeout(r, 800))}
            />
          </Card>
          <Card title="Error (offline)">
            <ErrorState size="compact" error={NETWORK_ERROR} onRetry={() => undefined} />
          </Card>
          <Card title="No permission">
            <NoPermissionState />
          </Card>
          <Card title="Error boundary (widget)">
            <ErrorBoundary resetKeys={[explode]}>
              <Bomb explode={explode} />
            </ErrorBoundary>
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                variant="destructive"
                leftIcon={<Bug />}
                onClick={() => setExplode(true)}
              >
                Break it
              </Button>
              <Button size="sm" variant="outline" onClick={() => setExplode(false)}>
                Fix
              </Button>
            </div>
          </Card>
          <Card title="Loading — cards" className="md:col-span-2 xl:col-span-3">
            <LoadingState variant="cards" count={3} />
          </Card>
        </ResponsiveGrid>
      </PageSection>

      <PageSection title="Helpers" variant="plain">
        <ResponsiveGrid cols={{ base: 1, md: 2 }}>
          <Card title="Confirm dialog">
            <div className="flex flex-wrap gap-2">
              <ConfirmDialog
                trigger={<Button variant="outline">Simple confirm</Button>}
                title="Send the invitation again?"
                onConfirm={() => {
                  toast.success('Invitation sent');
                }}
              />
              <ConfirmDialog
                trigger={<Button variant="destructive">Delete workspace…</Button>}
                title="Delete this workspace?"
                description="All users, roles and data are removed permanently."
                confirmText="Delete"
                confirmPhrase="acme-corp"
                destructive
                onConfirm={() =>
                  new Promise((r) => setTimeout(r, 900)).then(() => toast.success('Deleted'))
                }
              />
            </div>
          </Card>
          <Card title="Copy, dates, status">
            <div className="space-y-3 text-sm">
              <p className="flex items-center gap-2">
                <code className="rounded-md bg-muted px-2 py-1 font-mono text-xs">
                  sk_live_8f2c…a91
                </code>
                <CopyButton value="sk_live_8f2ca91" label="Copy API key" notify />
              </p>
              <p>
                datetime: <DateTime value={HOURS_AGO} /> · date:{' '}
                <DateTime value={HOURS_AGO} format="date" /> · relative:{' '}
                <DateTime value={HOURS_AGO} format="relative" /> · Tokyo:{' '}
                <DateTime value={HOURS_AGO} timeZone="Asia/Tokyo" />
              </p>
              <div className="flex flex-wrap gap-2">
                {[
                  'ACTIVE',
                  'PENDING_VERIFICATION',
                  'invited',
                  'SUSPENDED',
                  'locked',
                  'DEACTIVATED',
                  'custom_state',
                ].map((s) => (
                  <StatusBadge key={s} status={s} />
                ))}
              </div>
            </div>
          </Card>
          <Card title="File dropzone" className="md:col-span-2">
            <FileDropzone
              files={files}
              onFilesChange={setFiles}
              multiple
              maxFiles={3}
              maxSize={2 * 1024 * 1024}
              accept={['image/png', 'image/jpeg', 'image/webp', '.pdf']}
              label="Drag images or PDFs here"
            />
          </Card>
        </ResponsiveGrid>
      </PageSection>
    </div>
  );
}
