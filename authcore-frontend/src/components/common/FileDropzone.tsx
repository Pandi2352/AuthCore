import { FileText, ImageIcon, UploadCloud, X } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState, type DragEvent } from 'react';

import { Button, IconButton } from '@/components/ui';
import { formatFileSize } from '@/lib/format';
import { cn } from '@/lib/utils';

const ANY_TYPE: readonly string[] = [];

export interface RejectedFile {
  file: File;
  reason: string;
}

export interface FileDropzoneProps {
  /** Selected files (controlled). */
  files: readonly File[];
  onFilesChange: (files: File[]) => void;
  /** Called with files that failed type / size / count checks. */
  onReject?: (rejected: RejectedFile[]) => void;
  /** MIME types or extensions, e.g. ['image/png', 'image/jpeg', '.pdf']; "image/*" works too. */
  accept?: readonly string[];
  /** Bytes per file. */
  maxSize?: number;
  multiple?: boolean;
  maxFiles?: number;
  disabled?: boolean;
  label?: string;
  hint?: string;
  /** Show image thumbnails. */
  previews?: boolean;
  className?: string;
}

function matchesAccept(file: File, accept: readonly string[]): boolean {
  if (accept.length === 0) return true;
  const name = file.name.toLowerCase();
  return accept.some((rule) => {
    const r = rule.trim().toLowerCase();
    if (r.startsWith('.')) return name.endsWith(r);
    if (r.endsWith('/*')) return file.type.startsWith(r.slice(0, -1));
    return file.type === r;
  });
}

function Thumbnail({ file }: { file: File }) {
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return <img src={url} alt="" className="size-10 shrink-0 rounded-md object-cover" />;
}

/**
 * Drag-and-drop or click to choose files, with type / size / count checks and a removable
 * list. Keyboard: the "Choose files" button; the drop area itself is a pointer convenience.
 * Server-side checks still apply (the backend validates and scans uploads).
 */
export function FileDropzone({
  files,
  onFilesChange,
  onReject,
  accept = ANY_TYPE,
  maxSize,
  multiple = false,
  maxFiles = multiple ? 10 : 1,
  disabled = false,
  label = 'Drag files here',
  hint,
  previews = true,
  className,
}: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const hintId = useId();
  const [isDragging, setIsDragging] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const describe = [
    accept.length ? accept.join(', ') : null,
    maxSize ? `max ${formatFileSize(maxSize)} each` : null,
    multiple ? `up to ${maxFiles} files` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const add = (incoming: File[]) => {
    const rejected: RejectedFile[] = [];
    const accepted: File[] = [];
    for (const file of incoming) {
      if (!matchesAccept(file, accept)) rejected.push({ file, reason: 'file type not allowed' });
      else if (maxSize !== undefined && file.size > maxSize)
        rejected.push({ file, reason: `larger than ${formatFileSize(maxSize)}` });
      else accepted.push(file);
    }
    let next = multiple ? [...files, ...accepted] : accepted.slice(0, 1);
    if (next.length > maxFiles) {
      for (const file of next.slice(maxFiles))
        rejected.push({ file, reason: `more than ${maxFiles} files` });
      next = next.slice(0, maxFiles);
    }
    setErrors(rejected.map((r) => `${r.file.name}: ${r.reason}`));
    if (rejected.length) onReject?.(rejected);
    onFilesChange(next);
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    if (!disabled) add(Array.from(event.dataTransfer.files));
  };

  return (
    <div className={cn('space-y-3', className)}>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        className={cn(
          'flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed px-4 py-8 text-center transition-colors',
          isDragging ? 'border-primary bg-primary-soft' : 'border-input bg-muted/40',
          disabled && 'cursor-not-allowed opacity-60',
        )}
      >
        <UploadCloud className="size-8 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint ?? describe}
        </p>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          aria-describedby={hintId}
          onClick={() => inputRef.current?.click()}
        >
          Choose {multiple ? 'files' : 'a file'}
        </Button>
        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          accept={accept.join(',') || undefined}
          multiple={multiple}
          disabled={disabled}
          onChange={(event) => {
            add(Array.from(event.target.files ?? []));
            event.target.value = '';
          }}
        />
      </div>

      {errors.length > 0 && (
        <ul role="alert" className="space-y-0.5 text-xs text-danger">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      {files.length > 0 && (
        <ul
          className="divide-y divide-border rounded-md border border-border"
          aria-label="Selected files"
        >
          {files.map((file, index) => (
            <li
              key={`${file.name}-${file.size}-${file.lastModified}`}
              className="flex items-center gap-3 px-3 py-2"
            >
              {previews && file.type.startsWith('image/') ? (
                <Thumbnail file={file} />
              ) : (
                <span
                  className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"
                  aria-hidden="true"
                >
                  {file.type.startsWith('image/') ? (
                    <ImageIcon className="size-5" />
                  ) : (
                    <FileText className="size-5" />
                  )}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-foreground">{file.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {formatFileSize(file.size)}
                </span>
              </span>
              <IconButton
                aria-label={`Remove ${file.name}`}
                size="sm"
                icon={<X />}
                disabled={disabled}
                onClick={() => onFilesChange(files.filter((_f, i) => i !== index))}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
