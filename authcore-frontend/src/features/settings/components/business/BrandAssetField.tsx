import { ImageUp, Info, Trash2, Upload } from 'lucide-react';
import { useEffect, useId, useRef, useState, type DragEvent, type ReactNode } from 'react';

import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { DateTime } from '@/components/common/DateTime';
import { notifyError, notifySuccess } from '@/components/feedback';
import { Badge, Button, Progress } from '@/components/ui';
import { getErrorMessage, isAbortError } from '@/lib/api';
import { formatFileSize } from '@/lib/format';
import { cn } from '@/lib/utils';

import { businessSettingsApi } from '../../api/business-settings.api';
import {
  BRAND_IMAGE_MAX_BYTES,
  BRAND_IMAGE_TYPES,
  type BrandAsset,
  type BrandAssetSlot,
  type BusinessSettings,
} from '../../types/business-settings.types';

export interface BrandAssetFieldProps {
  slot: BrandAssetSlot;
  title: string;
  description: string;
  /** Size / format advice. */
  recommendation: string;
  /** wide: logos · square: mark, favicon (preview tile shape). */
  shape: 'wide' | 'square';
  asset: BrandAsset | null;
  /** Shown in the tile when nothing is uploaded (what is used instead). */
  fallback: ReactNode;
  fallbackLabel: string;
  canManage: boolean;
  onChange: (settings: BusinessSettings) => void;
}

/** Client checks before uploading (the backend checks the real content again). */
function checkFile(file: File): string | null {
  if (!(BRAND_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return 'Use a PNG, WebP or JPEG image (SVG is not accepted).';
  }
  if (file.size > BRAND_IMAGE_MAX_BYTES) {
    return `The image is ${formatFileSize(file.size)}; the limit is ${formatFileSize(BRAND_IMAGE_MAX_BYTES)}.`;
  }
  return null;
}

/** One branding image: preview, upload / replace (button or drop), remove, file details. */
export function BrandAssetField({
  slot,
  title,
  description,
  recommendation,
  shape,
  asset,
  fallback,
  fallbackLabel,
  canManage,
  onChange,
}: BrandAssetFieldProps) {
  const inputId = useId();
  const errorId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const isUploading = progress !== null;

  // Leaving the page cancels an upload in progress.
  useEffect(() => () => controllerRef.current?.abort(), []);

  const upload = async (file: File) => {
    const problem = checkFile(file);
    if (problem) {
      setError(problem);
      notifyError(problem);
      return;
    }
    setError(null);
    setProgress(0);
    const controller = new AbortController();
    controllerRef.current = controller;
    try {
      const settings = await businessSettingsApi.uploadAsset(slot, file, {
        signal: controller.signal,
        onProgress: (p) => setProgress(p.percent),
      });
      onChange(settings);
      notifySuccess(`${title} updated`, { description: 'Visible everywhere right away.' });
    } catch (err) {
      if (isAbortError(err)) return;
      setError(getErrorMessage(err, `Could not upload the ${title.toLowerCase()}`));
      notifyError(err, `Could not upload the ${title.toLowerCase()}`);
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
      setProgress(null);
    }
  };

  const remove = async () => {
    try {
      onChange(await businessSettingsApi.removeAsset(slot));
      setError(null);
      notifySuccess(`${title} removed`, { description: `${fallbackLabel} is shown again.` });
    } catch (err) {
      notifyError(err, `Could not remove the ${title.toLowerCase()}`);
      throw err; // keeps the dialog open
    }
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    if (!canManage || isUploading) return;
    const file = event.dataTransfer.files[0];
    if (file) void upload(file);
  };

  return (
    <div className="flex flex-col gap-4 rounded-md border border-border p-4 sm:flex-row">
      {/* Preview tile: checkerboard shows transparency; also a drop target (pointer). */}
      <div
        onDragOver={(e) => {
          if (!canManage) return;
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        className={cn(
          'relative flex shrink-0 items-center justify-center overflow-hidden rounded-md border',
          '[background:repeating-conic-gradient(var(--muted)_0_25%,var(--surface)_0_50%)_0_0/14px_14px]',
          shape === 'wide' ? 'h-28 w-full sm:w-56' : 'size-28 self-center sm:self-start',
          isDragging ? 'border-dashed border-primary ring-2 ring-primary/30' : 'border-border',
        )}
      >
        {asset ? (
          <img
            src={asset.url}
            alt={`Current ${title.toLowerCase()}`}
            className={cn('object-contain', shape === 'wide' ? 'max-h-20 max-w-[85%]' : 'size-16')}
          />
        ) : (
          <span className="flex flex-col items-center gap-1.5 text-center">{fallback}</span>
        )}
        {isDragging && (
          <span className="absolute inset-0 flex items-center justify-center bg-surface/85 text-sm font-medium text-primary">
            <ImageUp className="mr-1.5 size-4" aria-hidden="true" /> Drop to upload
          </span>
        )}
        {isUploading && (
          <span className="absolute inset-x-3 bottom-3">
            <Progress value={progress} size="sm" label={`Uploading ${title.toLowerCase()}`} />
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {asset ? (
            <Badge size="sm" tone="success">
              Custom
            </Badge>
          ) : (
            <Badge size="sm" tone="neutral">
              Default
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{description}</p>
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Info className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          {recommendation}
        </p>

        {asset && (
          <p className="truncate text-xs text-muted-foreground" title={asset.originalName}>
            <span className="font-medium text-foreground">{asset.originalName}</span>
            {asset.width && asset.height ? ` · ${asset.width} × ${asset.height}` : ''}
            {` · ${formatFileSize(asset.size)} · `}
            <DateTime value={asset.uploadedAt} format="relative" />
          </p>
        )}

        {error && (
          <p id={errorId} role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}

        {canManage && (
          <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
            <input
              ref={inputRef}
              id={inputId}
              type="file"
              accept={BRAND_IMAGE_TYPES.join(',')}
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) void upload(file);
              }}
            />
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Upload />}
              isLoading={isUploading}
              aria-describedby={error ? errorId : undefined}
              onClick={() => inputRef.current?.click()}
            >
              {asset ? 'Replace' : 'Upload'}
            </Button>
            {asset && (
              <ConfirmDialog
                trigger={
                  <Button
                    variant="ghost"
                    size="sm"
                    leftIcon={<Trash2 />}
                    className="text-danger hover:text-danger"
                    disabled={isUploading}
                  >
                    Remove
                  </Button>
                }
                title={`Remove the ${title.toLowerCase()}?`}
                description={`${fallbackLabel} will be shown instead, everywhere, right away.`}
                confirmText="Remove"
                destructive
                onConfirm={remove}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
