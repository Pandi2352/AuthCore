import { formatFileSize } from '@/lib/format';
import { cn } from '@/lib/utils';

import type { StorageProviderId, StorageUsage } from '../../types/storage.types';
import { PROVIDER_META } from './provider-meta';

const LOGO_SIZE = { sm: 'size-10', md: 'size-12', lg: 'size-14' } as const;

/** The provider's logo on a white tile (works in light and dark), or its generic icon. */
export function ProviderLogo({
  provider,
  size = 'md',
  className,
}: {
  provider: StorageProviderId;
  size?: keyof typeof LOGO_SIZE;
  className?: string;
}) {
  const meta = PROVIDER_META[provider];
  const Icon = meta.icon;
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-border',
        LOGO_SIZE[size],
        meta.logo ? 'bg-logo-tile p-1' : meta.accent,
        className,
      )}
    >
      {meta.logo ? (
        <img
          src={meta.logo}
          alt=""
          className="size-full object-contain"
          style={{ transform: `scale(${meta.zoom})` }}
        />
      ) : (
        <Icon className="size-1/2" />
      )}
    </span>
  );
}

/**
 * Used vs capacity. Local folder: the server disk (other data on the disk counts as used).
 * Buckets: the optional storage limit; without one only what this app stored is shown.
 */
export function UsageBar({ usage, compact = false }: { usage: StorageUsage; compact?: boolean }) {
  const { usedBytes, capacityBytes, freeBytes, capacitySource, fileCount } = usage;
  const files = `${fileCount} file${fileCount === 1 ? '' : 's'}`;

  if (capacityBytes === null || freeBytes === null || capacityBytes <= 0) {
    return (
      <div className={cn('space-y-1', compact && 'text-xs')}>
        <div className="flex items-baseline justify-between gap-2 text-xs">
          <span className="font-medium text-foreground">
            {formatFileSize(usedBytes)} used · {files}
          </span>
          <span className="text-muted-foreground">No limit set</span>
        </div>
        <div className="h-2 rounded-full bg-muted" />
      </div>
    );
  }

  // Disk: everything not free is used (this app's files are the part we know about).
  const totalUsed = capacitySource === 'disk' ? capacityBytes - freeBytes : usedBytes;
  const usedPercent = Math.min(100, (totalUsed / capacityBytes) * 100);
  const appPercent = Math.min(usedPercent, (usedBytes / capacityBytes) * 100);
  const tone = usedPercent >= 90 ? 'bg-danger' : usedPercent >= 75 ? 'bg-warning' : 'bg-primary';

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="font-medium text-foreground">
          {formatFileSize(totalUsed)} used of {formatFileSize(capacityBytes)}
        </span>
        <span className="text-muted-foreground">{formatFileSize(freeBytes)} free</span>
      </div>
      <meter
        className="sr-only"
        min={0}
        max={100}
        value={Math.round(usedPercent)}
        aria-label={`Storage used: ${formatFileSize(totalUsed)} of ${formatFileSize(capacityBytes)}`}
      />
      {/* Light part: everything used on the disk; strong part: this app's files. */}
      <div aria-hidden="true" className="relative h-2 overflow-hidden rounded-full bg-muted">
        <span
          className={cn('absolute inset-y-0 left-0 rounded-full opacity-35', tone)}
          style={{ width: `${usedPercent}%` }}
        />
        <span
          className={cn('absolute inset-y-0 left-0 rounded-full', tone)}
          style={{ width: `${Math.max(appPercent, usedBytes > 0 ? 1 : 0)}%` }}
        />
      </div>
      {!compact && (
        <p className="text-xs text-muted-foreground">
          {capacitySource === 'disk'
            ? `This app: ${formatFileSize(usedBytes)} in ${files} · the rest is other data on the server disk`
            : `${files} · limit from the storage settings`}
        </p>
      )}
    </div>
  );
}
