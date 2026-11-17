import { useEffect, useRef, useState } from 'react';

import { FileDropzone } from '@/components/common/FileDropzone';
import { PageContainer, PageHeader, PageSection } from '@/components/page';
import { Badge, Button, Card, Progress } from '@/components/ui';
import { tokenStore } from '@/features/auth/session/token-store';
import { apiClient, downloadFile, getErrorMessage, isApiError, uploadFile } from '@/lib/api';
import { ERROR_CODES } from '@/lib/constants';

interface LogEntry {
  id: number;
  name: string;
  ok: boolean;
  ms: number;
  summary: string;
  detail?: string;
}

interface StoredFile {
  id: string;
  originalName?: string;
  sizeBytes?: number;
}

let nextId = 1;

/** Runs a call and measures it (module scope: not part of rendering). */
async function timed(
  fn: () => Promise<unknown>,
): Promise<{ ms: number; value?: unknown; error?: unknown }> {
  const started = performance.now();
  try {
    const value = await fn();
    return { ms: Math.round(performance.now() - started), value };
  } catch (error) {
    return {
      ms: Math.round(performance.now() - started),
      error: error ?? new Error('Unknown error'),
    };
  }
}

/**
 * Development only: run every API-layer scenario against the real backend (sign in first)
 * and see what the client returns — envelope, errors, timeout, abort, refresh, upload, download.
 */
export function ApiPlaygroundPage() {
  const [log, setLog] = useState<LogEntry[]>([]);
  const [events, setEvents] = useState<Array<{ id: number; text: string }>>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [percent, setPercent] = useState<number | null>(null);
  const [uploaded, setUploaded] = useState<StoredFile | null>(null);
  const uploadAbort = useRef<AbortController | null>(null);

  useEffect(() => {
    const offs = (['unauthorized', 'forbidden', 'serverError'] as const).map((event) =>
      apiClient.on(event, (error) =>
        setEvents((list) =>
          [{ id: nextId++, text: `${event}: ${error.status} ${error.code}` }, ...list].slice(0, 8),
        ),
      ),
    );
    return () => offs.forEach((off) => off());
  }, []);

  const run = async (name: string, fn: () => Promise<unknown>) => {
    const { ms, value, error } = await timed(fn);
    const e = isApiError(error) ? error : null;
    const entry: LogEntry =
      error === undefined
        ? {
            id: nextId++,
            name,
            ok: true,
            ms,
            summary: 'OK',
            detail: JSON.stringify(value, null, 2)?.slice(0, 600),
          }
        : {
            id: nextId++,
            name,
            ok: false,
            ms,
            summary: e ? `${e.status} ${e.code} — “${getErrorMessage(e)}”` : String(error),
            detail: e
              ? JSON.stringify(
                  {
                    requestId: e.requestId,
                    retryAfter: e.retryAfter,
                    fieldErrors: e.fieldErrors,
                    message: e.message,
                  },
                  null,
                  2,
                )
              : undefined,
          };
    setLog((list) => [entry, ...list].slice(0, 30));
  };

  const scenarios: Array<{ name: string; hint: string; fn: () => Promise<unknown> }> = [
    {
      name: 'Envelope',
      hint: 'GET /auth/me → data unwrapped',
      fn: () => apiClient.get('/auth/me'),
    },
    {
      name: 'Paginated',
      hint: 'GET /files?page=1&limit=5 → { items, meta }',
      fn: async () => {
        const page = await apiClient.getPage<StoredFile>('/files', {
          query: { page: 1, limit: 5 },
        });
        return { count: page.items.length, meta: page.meta };
      },
    },
    {
      name: '404 envelope',
      hint: 'GET /does-not-exist',
      fn: () => apiClient.get('/does-not-exist'),
    },
    {
      name: 'Validation',
      hint: 'POST /auth/login (bad email) → fieldErrors',
      fn: () =>
        apiClient.post('/auth/login', { email: 'not-an-email', password: '' }, { auth: false }),
    },
    {
      name: 'Timeout',
      hint: 'GET /auth/me with timeoutMs 1',
      fn: () => apiClient.get('/auth/me', { timeoutMs: 1 }),
    },
    {
      name: 'Abort',
      hint: 'cancelled by the caller',
      fn: () => {
        const controller = new AbortController();
        const request = apiClient.get('/auth/me', { signal: controller.signal });
        controller.abort();
        return request;
      },
    },
    {
      name: 'Network',
      hint: 'unreachable host (no token sent)',
      fn: () => apiClient.get('http://127.0.0.1:9/nothing', { timeoutMs: 3000 }),
    },
    {
      name: 'Refresh + retry',
      hint: 'invalid token → 401 → refresh cookie → retried',
      fn: async () => {
        const before = tokenStore.get();
        tokenStore.set('invalid-token-for-testing');
        const me = await apiClient.get<{ email: string }>('/auth/me');
        const after = tokenStore.get();
        return {
          email: me.email,
          tokenReplaced: after !== 'invalid-token-for-testing' && after !== before,
        };
      },
    },
    {
      name: '3× parallel 401',
      hint: 'one shared refresh for all three',
      fn: async () => {
        tokenStore.set('invalid-token-for-testing');
        const results = await Promise.all(
          [1, 2, 3].map(() => apiClient.get<{ email: string }>('/auth/me')),
        );
        return { succeeded: results.length };
      },
    },
  ];

  const upload = async () => {
    const file = files[0];
    if (!file) return;
    uploadAbort.current = new AbortController();
    setPercent(0);
    await run('Upload', async () => {
      const stored = await uploadFile<StoredFile>('/files', file, {
        fields: { purpose: 'DOCUMENT' },
        onProgress: (p) => setPercent(p.percent),
        signal: uploadAbort.current?.signal,
      });
      setUploaded(stored);
      return stored;
    });
    setPercent(null);
  };

  return (
    <PageContainer>
      <PageHeader
        title="API playground"
        description="Development only. Sign in first; every scenario calls the running backend through the real API layer."
      />
      <PageSection title="Scenarios">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {scenarios.map((s) => (
            <Button
              key={s.name}
              variant="outline"
              className="h-auto flex-col items-start py-2 text-left"
              onClick={() => void run(s.name, s.fn)}
            >
              <span>{s.name}</span>
              <span className="text-xs font-normal whitespace-normal text-muted-foreground">
                {s.hint}
              </span>
            </Button>
          ))}
        </div>
      </PageSection>

      <PageSection
        title="Upload with progress → download"
        description="POST /files (purpose DOCUMENT), then GET /files/:id/content."
      >
        <div className="space-y-3">
          <FileDropzone
            files={files}
            onFilesChange={setFiles}
            accept={['image/png', 'image/jpeg', 'image/webp', '.pdf']}
          />
          {percent !== null && <Progress value={percent} showValue label="Upload progress" />}
          <div className="flex flex-wrap gap-2">
            <Button disabled={!files.length || percent !== null} onClick={() => void upload()}>
              Upload
            </Button>
            <Button
              variant="outline"
              disabled={percent === null}
              onClick={() => uploadAbort.current?.abort()}
            >
              Cancel upload
            </Button>
            <Button
              variant="outline"
              disabled={!uploaded}
              onClick={() =>
                uploaded &&
                void run('Download', () =>
                  downloadFile(`/files/${encodeURIComponent(uploaded.id)}/content`, {
                    fallbackFilename: uploaded.originalName,
                  }),
                )
              }
            >
              Download uploaded file
            </Button>
          </div>
        </div>
      </PageSection>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card
          title="Results"
          className="lg:col-span-2"
          actions={
            <Button size="sm" variant="ghost" onClick={() => setLog([])}>
              Clear
            </Button>
          }
        >
          {log.length === 0 && <p className="text-sm text-muted-foreground">Run a scenario.</p>}
          <ol className="space-y-3">
            {log.map((entry) => (
              <li key={entry.id} className="rounded-md border border-border p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={entry.ok ? 'success' : 'danger'} dot>
                    {entry.ok ? 'resolved' : 'ApiError'}
                  </Badge>
                  <span className="font-medium">{entry.name}</span>
                  <span className="text-xs text-muted-foreground">{entry.ms} ms</span>
                </div>
                <p className="mt-1 wrap-break-word">{entry.summary}</p>
                {entry.detail && (
                  <pre className="mt-2 max-h-48 overflow-auto rounded-md bg-muted p-2 font-mono text-xs">
                    {entry.detail}
                  </pre>
                )}
              </li>
            ))}
          </ol>
        </Card>
        <Card title="Client events">
          {events.length === 0 && (
            <p className="text-sm text-muted-foreground">
              unauthorized / forbidden / serverError appear here.
            </p>
          )}
          <ul className="space-y-1 font-mono text-xs">
            {events.map((e) => (
              <li key={e.id}>{e.text}</li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted-foreground">
            Codes: {ERROR_CODES.NETWORK_ERROR}, {ERROR_CODES.TIMEOUT}, {ERROR_CODES.ABORTED},{' '}
            {ERROR_CODES.AUTH_SESSION_EXPIRED}
          </p>
          {uploaded && (
            <p className="mt-2 text-xs">Last upload: {uploaded.originalName ?? uploaded.id}</p>
          )}
        </Card>
      </div>
    </PageContainer>
  );
}
