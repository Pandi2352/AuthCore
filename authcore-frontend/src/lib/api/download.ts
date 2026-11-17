import type { QueryParams } from '../utils/url';
import { apiClient, type HttpMethod } from './client';
import { filenameFromContentDisposition } from './request-utils';

export interface DownloadOptions {
  method?: HttpMethod;
  query?: QueryParams;
  body?: unknown;
  signal?: AbortSignal;
  timeoutMs?: number;
  /** Used when the response has no Content-Disposition file name. */
  fallbackFilename?: string;
  /** false = only return the blob (e.g. to preview it); default true = save it. */
  save?: boolean;
}

/** Save a Blob with a file name (object URL + temporary <a download>). */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.append(link);
  link.click();
  link.remove();
  // Give the browser time to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/**
 * Download a file from the API (auth, refresh, errors as in apiClient) and save it with the
 * name from Content-Disposition (RFC 5987 aware).
 *
 *   await downloadFile('/users/me/export', { method: 'POST', body: { currentPassword } });
 */
export async function downloadFile(
  path: string,
  options: DownloadOptions = {},
): Promise<{ blob: Blob; filename: string }> {
  const {
    method = 'GET',
    query,
    body,
    signal,
    timeoutMs,
    fallbackFilename = 'download',
    save = true,
  } = options;
  const response = await apiClient.raw(method, path, { query, body, signal, timeoutMs });
  const blob = await response.blob();
  const filename =
    filenameFromContentDisposition(response.headers.get('Content-Disposition')) ?? fallbackFilename;
  if (save) saveBlob(blob, filename);
  return { blob, filename };
}
