import { ExternalLink, UploadCloud } from 'lucide-react';
import { useRef, useState, type DragEvent } from 'react';

import { CopyButton } from '@/components/common/CopyButton';
import { notifyError, notifySuccess } from '@/components/feedback';
import { Button, Progress } from '@/components/ui';
import { UPLOAD_ACCEPT, uploadToStorage, type UploadedFile } from '@/lib/api';
import { cn } from '@/lib/utils';

import { SettingCard } from '../appearance/AppearanceParts';

/** Try POST /uploads with the active storage: shows the response the API returns. */
export function UploadTester({
  activeName,
  onUploaded,
}: {
  activeName: string;
  /** After a successful upload (e.g. refresh file counts). */
  onUploaded?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [result, setResult] = useState<UploadedFile | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const upload = async (file: File) => {
    setProgress(0);
    setResult(null);
    try {
      const uploaded = await uploadToStorage(file, { onProgress: (p) => setProgress(p.percent) });
      setResult(uploaded);
      onUploaded?.();
      notifySuccess(`${uploaded.name} uploaded`, { description: `Stored on ${activeName}.` });
    } catch (err) {
      notifyError(err, 'Upload failed');
    } finally {
      setProgress(null);
    }
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files[0];
    if (file && progress === null) void upload(file);
  };

  return (
    <SettingCard
      title="Try an upload"
      description="Sends a file to POST /uploads — the endpoint every feature uses — and shows the response."
      badge={activeName}
    >
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        className={cn(
          'flex flex-col items-center gap-3 rounded-md border border-dashed px-4 py-6 text-center',
          isDragging ? 'border-primary bg-primary-soft' : 'border-field bg-muted/40',
        )}
      >
        <UploadCloud className="size-6 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">Drop a file here, or</p>
        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          accept={UPLOAD_ACCEPT.join(',')}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) void upload(file);
          }}
        />
        <Button
          variant="outline"
          size="sm"
          isLoading={progress !== null}
          onClick={() => inputRef.current?.click()}
        >
          Choose a file
        </Button>
        <p className="text-xs text-muted-foreground">
          Images, PDF, Word, Excel, PowerPoint, CSV or text
        </p>
        {progress !== null && (
          <Progress value={progress} size="sm" className="w-full max-w-xs" label="Uploading" />
        )}
      </div>

      {result && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={result.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-w-0 items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <ExternalLink className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">Open the uploaded file</span>
            </a>
            <CopyButton value={result.url} label="Copy URL" size="sm" />
          </div>
          <pre className="max-h-64 overflow-auto rounded-md bg-muted p-3 font-mono text-xs text-foreground">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </SettingCard>
  );
}
