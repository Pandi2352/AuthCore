import { CheckCircle2, CircleAlert, Pencil, PlugZap, Power, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { DateTime } from '@/components/common/DateTime';
import { notifyError, notifySuccess } from '@/components/feedback';
import { Badge, Button, Tooltip } from '@/components/ui';
import { cn } from '@/lib/utils';

import { storageApi } from '../../api/storage.api';
import type { StorageConfig } from '../../types/storage.types';
import { storageSummary } from './provider-meta';
import { ProviderLogo, UsageBar } from './StorageVisuals';

interface StorageCardProps {
  config: StorageConfig;
  canManage: boolean;
  /** After any change: reload the list. */
  onChanged: () => void;
  onEdit: (config: StorageConfig) => void;
}

/** One configured storage: status, last test, actions. */
export function StorageCard({ config, canManage, onChanged, onEdit }: StorageCardProps) {
  const [isTesting, setIsTesting] = useState(false);
  const test = config.lastTest;

  const runTest = async () => {
    setIsTesting(true);
    try {
      const result = await storageApi.test(config.id);
      if (result.isSuccess) {
        notifySuccess(`${config.name}: connected`, {
          description: `${result.message} (${result.durationMs} ms)`,
        });
      } else {
        notifyError(new Error(result.message), `${config.name}: connection failed`);
      }
      onChanged();
    } catch (err) {
      notifyError(err, 'Could not run the test');
    } finally {
      setIsTesting(false);
    }
  };

  const activate = async () => {
    try {
      await storageApi.activate(config.id);
      notifySuccess(`${config.name} is now the active storage`, {
        description: 'New uploads go here. Existing files stay where they are.',
      });
      onChanged();
    } catch (err) {
      notifyError(err, 'Could not activate the storage');
      throw err;
    }
  };

  const remove = async () => {
    try {
      await storageApi.remove(config.id);
      notifySuccess(`${config.name} deleted`);
      onChanged();
    } catch (err) {
      notifyError(err, 'Could not delete the storage');
      throw err;
    }
  };

  const deleteBlocker = config.isBuiltIn
    ? 'The local folder is built in'
    : config.isActive
      ? 'Activate another storage first'
      : config.fileCount > 0
        ? `${config.fileCount} file(s) are stored here`
        : null;

  return (
    <article
      aria-label={config.name}
      className={cn(
        'flex flex-col gap-4 rounded-md border bg-surface p-card',
        config.isActive ? 'border-primary ring-1 ring-primary/30' : 'border-border',
      )}
    >
      <header className="flex items-start gap-3">
        <ProviderLogo provider={config.provider} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-foreground">{config.name}</h3>
            {config.isActive && (
              <Badge size="sm" tone="primary" variant="solid">
                Active
              </Badge>
            )}
            {config.isBuiltIn && (
              <Badge size="sm" tone="neutral">
                Built in
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{config.providerLabel}</p>
          <p
            className="mt-0.5 truncate text-xs text-muted-foreground"
            title={storageSummary(config)}
          >
            {storageSummary(config)}
          </p>
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-3 text-xs">
        <div className="min-w-0">
          <dt className="text-muted-foreground">Last test</dt>
          <dd className="mt-0.5 flex items-center gap-1 font-medium text-foreground">
            {test ? (
              <>
                {test.isSuccess ? (
                  <CheckCircle2 className="size-3.5 shrink-0 text-success" aria-hidden="true" />
                ) : (
                  <CircleAlert className="size-3.5 shrink-0 text-danger" aria-hidden="true" />
                )}
                <span className="truncate">
                  {test.isSuccess ? 'Connected' : 'Failed'} ·{' '}
                  <DateTime value={test.testedAt} format="relative" />
                </span>
              </>
            ) : (
              <span className="text-muted-foreground">Not tested yet</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Files stored</dt>
          <dd className="mt-0.5 font-medium text-foreground tabular-nums">{config.fileCount}</dd>
        </div>
        <div className="col-span-2">
          <dt className="sr-only">Usage</dt>
          <dd>
            <UsageBar usage={config.usage} compact />
          </dd>
        </div>
        <div className="col-span-2 min-w-0">
          <dt className="text-muted-foreground">File URLs</dt>
          <dd
            className="mt-0.5 truncate font-mono text-[11px] text-foreground"
            title={config.publicUrlExample ?? undefined}
          >
            {config.publicUrlExample ?? 'Served through the API (/files/public/…)'}
          </dd>
        </div>
      </dl>

      {test && !test.isSuccess && (
        <p
          role="alert"
          className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger-soft-foreground"
        >
          {test.message}
        </p>
      )}

      {canManage && (
        <footer className="mt-auto flex flex-wrap items-center gap-2 border-t border-border pt-4">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<PlugZap />}
            isLoading={isTesting}
            onClick={() => void runTest()}
          >
            Test
          </Button>
          {!config.isActive && (
            <ConfirmDialog
              trigger={
                <Button size="sm" leftIcon={<Power />}>
                  Make active
                </Button>
              }
              title={`Use ${config.name} for new uploads?`}
              description="The connection is tested first. New uploads (profile pictures, logos, attachments …) go here; files already stored elsewhere keep working."
              confirmText="Make active"
              onConfirm={activate}
            />
          )}
          {!config.isBuiltIn && (
            <Button variant="ghost" size="sm" leftIcon={<Pencil />} onClick={() => onEdit(config)}>
              Edit
            </Button>
          )}
          {!config.isBuiltIn &&
            (deleteBlocker ? (
              <Tooltip content={deleteBlocker}>
                <span className="ml-auto">
                  <Button
                    variant="ghost"
                    size="sm"
                    leftIcon={<Trash2 />}
                    disabled
                    aria-label={`Delete ${config.name} (${deleteBlocker})`}
                  >
                    Delete
                  </Button>
                </span>
              </Tooltip>
            ) : (
              <ConfirmDialog
                trigger={
                  <Button
                    variant="ghost"
                    size="sm"
                    leftIcon={<Trash2 />}
                    className="ml-auto text-danger hover:text-danger"
                  >
                    Delete
                  </Button>
                }
                title={`Delete ${config.name}?`}
                description="Its saved credentials are removed. Nothing in the bucket is deleted."
                confirmText="Delete"
                destructive
                onConfirm={remove}
              />
            ))}
        </footer>
      )}
    </article>
  );
}
