import { ArrowRight, KeyRound, Plus, RefreshCw, ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { ErrorState, LoadingState } from '@/components/feedback';
import { PageContainer, PageHeader } from '@/components/page';
import { Alert, Button } from '@/components/ui';
import { usePermissions } from '@/features/auth';
import { isAbortError } from '@/lib/api';

import { storageApi } from '../api/storage.api';
import { SettingCard } from '../components/appearance/AppearanceParts';
import { storageSummary } from '../components/storage/provider-meta';
import { StorageCard } from '../components/storage/StorageCard';
import { StorageFormSheet } from '../components/storage/StorageFormSheet';
import { ProviderLogo, UsageBar } from '../components/storage/StorageVisuals';
import { UploadTester } from '../components/storage/UploadTester';
import type { StorageConfig, StorageProvider } from '../types/storage.types';

interface Loaded {
  key: number;
  providers: StorageProvider[];
  configs: StorageConfig[];
}

const HOW_IT_WORKS = [
  {
    icon: ArrowRight,
    title: 'One active storage',
    text: 'Every upload in the app (profile pictures, logos, attachments, POST /uploads) goes to the active storage.',
  },
  {
    icon: ShieldCheck,
    title: 'Switching is safe',
    text: 'Files remember where they were stored, so older files keep working after a switch. Activation tests the connection first.',
  },
  {
    icon: KeyRound,
    title: 'Credentials stay secret',
    text: 'Keys are encrypted in the database and never sent back — only their last four characters are shown.',
  },
];

export function StorageSettingsPage() {
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('STORAGE_SETTINGS_MANAGE');
  const [nonce, setNonce] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failure, setFailure] = useState<{ key: number; error: unknown } | null>(null);
  const [sheet, setSheet] = useState<{ open: boolean; editing: StorageConfig | null; key: number }>(
    {
      open: false,
      editing: null,
      key: 0,
    },
  );

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const [providers, configs] = await Promise.all([
          storageApi.providers(controller.signal),
          storageApi.list(controller.signal),
        ]);
        setLoaded({ key: nonce, providers, configs });
      } catch (error) {
        if (!isAbortError(error)) setFailure({ key: nonce, error });
      }
    };
    void load();
    return () => controller.abort();
  }, [nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const openSheet = (editing: StorageConfig | null) =>
    setSheet((s) => ({ open: true, editing, key: s.key + 1 }));

  // Keep showing the last data while a reload runs (no flicker after each action).
  const isFirstLoad = !loaded && failure?.key !== nonce;
  const active = loaded?.configs.find((c) => c.isActive) ?? null;

  return (
    <PageContainer>
      <PageHeader
        title="File storage"
        description="Where uploaded files are kept: this server's folder or a cloud bucket."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 whitespace-nowrap"
              leftIcon={<RefreshCw />}
              onClick={reload}
            >
              Refresh
            </Button>
            {canManage && loaded && (
              <Button
                size="sm"
                className="shrink-0 whitespace-nowrap"
                leftIcon={<Plus />}
                onClick={() => openSheet(null)}
              >
                Add storage
              </Button>
            )}
          </div>
        }
      />

      {isFirstLoad && <LoadingState variant="cards" label="Loading storages" />}
      {!loaded && failure?.key === nonce && (
        <ErrorState error={failure.error} title="Could not load the storages" onRetry={reload} />
      )}

      {loaded && (
        <div className="space-y-6">
          {!canManage && (
            <Alert
              variant="info"
              title="View only"
              message="Changing storages needs the Manage file storage settings permission."
            />
          )}

          {active && (
            <section
              aria-label="Active storage"
              className="flex flex-col gap-4 rounded-md border border-primary/40 bg-primary-soft p-card sm:flex-row sm:items-center"
            >
              <ProviderLogo provider={active.provider} size="lg" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold tracking-wide text-primary-soft-foreground uppercase">
                  New uploads go to
                </p>
                <p className="truncate text-lg font-semibold text-foreground">{active.name}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {active.providerLabel} · {storageSummary(active)}
                </p>
              </div>
              <div className="w-full sm:w-72">
                <UsageBar usage={active.usage} />
              </div>
            </section>
          )}

          <div className="@container">
            <div className="grid items-start gap-6 @5xl:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
              <section aria-label="Storages" className="min-w-0">
                <h2 className="mb-3 text-base font-semibold text-foreground">
                  Storages <span className="text-muted-foreground">({loaded.configs.length})</span>
                </h2>
                <div className="grid gap-4 @2xl:grid-cols-2">
                  {loaded.configs.map((config) => (
                    <StorageCard
                      key={config.id}
                      config={config}
                      canManage={canManage}
                      onChanged={reload}
                      onEdit={openSheet}
                    />
                  ))}
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => openSheet(null)}
                      className="flex min-h-48 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed border-field bg-surface p-card text-center transition-colors hover:border-primary hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      <span className="flex size-10 items-center justify-center rounded-full bg-primary-soft text-primary-soft-foreground">
                        <Plus className="size-5" aria-hidden="true" />
                      </span>
                      <span className="text-sm font-semibold text-foreground">Add a storage</span>
                      <span className="max-w-60 text-xs text-muted-foreground">
                        Amazon S3, Backblaze B2, Tigris, Supabase or any S3-compatible bucket
                      </span>
                    </button>
                  )}
                </div>
              </section>

              <aside aria-label="Help and test" className="min-w-0 space-y-6">
                <UploadTester activeName={active?.name ?? 'Local folder'} onUploaded={reload} />
                <SettingCard title="How it works">
                  <ul className="space-y-4">
                    {HOW_IT_WORKS.map(({ icon: Icon, title, text }) => (
                      <li key={title} className="flex gap-3">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                          <Icon className="size-4" aria-hidden="true" />
                        </span>
                        <span>
                          <span className="block text-sm font-semibold text-foreground">
                            {title}
                          </span>
                          <span className="block text-xs text-muted-foreground">{text}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </SettingCard>
              </aside>
            </div>
          </div>

          <StorageFormSheet
            key={sheet.key}
            open={sheet.open}
            onOpenChange={(open) => setSheet((s) => ({ ...s, open }))}
            providers={loaded.providers}
            editing={sheet.editing}
            onSaved={reload}
          />
        </div>
      )}
    </PageContainer>
  );
}
