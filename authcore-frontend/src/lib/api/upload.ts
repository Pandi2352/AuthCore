import { CLIENT_ERROR_CODES } from '../constants/error-codes';
import { HTTP_HEADERS, HTTP_STATUS } from '../constants/http';
import { ApiError } from './api-error';
import { apiClient } from './client';
import { createRequestId, parseRetryAfter } from './request-utils';
import { isErrorEnvelope, isSuccessEnvelope } from './types';

export interface UploadProgress {
  loaded: number;
  total: number;
  /** 0–100 (rounded). */
  percent: number;
}

export interface UploadOptions {
  /** Form field name for the file (backend: "file"). */
  fieldName?: string;
  /** Extra form fields. */
  fields?: Record<string, string | Blob>;
  onProgress?: (progress: UploadProgress) => void;
  /** Cancel the upload → ApiError ABORTED. */
  signal?: AbortSignal;
  /** Default: none (large files on slow links). */
  timeoutMs?: number;
  method?: 'POST' | 'PUT' | 'PATCH';
  query?: Record<string, string | number | boolean | undefined>;
}

/**
 * Multipart upload with progress (fetch can't report upload progress, so this uses XHR).
 * Same contract as apiClient: Bearer token, one refresh-and-retry on 401, envelope unwrapped,
 * every failure an ApiError (NETWORK_ERROR / TIMEOUT / ABORTED / backend envelope).
 *
 *   const file = await uploadFile<StoredFile>('/files', picked, { onProgress: (p) => setPercent(p.percent) });
 */
export function uploadFile<T>(
  path: string,
  file: Blob | FormData,
  options: UploadOptions = {},
): Promise<T> {
  return send<T>(path, file, options, false);
}

function send<T>(
  path: string,
  file: Blob | FormData,
  options: UploadOptions,
  isRetry: boolean,
): Promise<T> {
  const {
    fieldName = 'file',
    fields = {},
    onProgress,
    signal,
    timeoutMs = 0,
    method = 'POST',
    query,
  } = options;

  let form: FormData;
  if (file instanceof FormData) {
    form = file;
  } else {
    form = new FormData();
    for (const [key, value] of Object.entries(fields)) form.append(key, value);
    form.append(fieldName, file, file instanceof File ? file.name : 'upload');
  }

  return new Promise<T>((resolve, reject) => {
    const requestId = createRequestId();
    const xhr = new XMLHttpRequest();
    xhr.open(method, apiClient.url(path, query));
    xhr.withCredentials = true;
    xhr.timeout = timeoutMs;
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.setRequestHeader(HTTP_HEADERS.REQUEST_ID, requestId);
    const authHeaders = apiClient.authHeaders(path);
    for (const [name, value] of Object.entries(authHeaders)) xhr.setRequestHeader(name, value);

    const base = { method, path, requestId };
    const failWith = (error: ApiError) => {
      if (!error.isAborted) apiClient.notifyError(error);
      reject(error);
    };

    if (onProgress) {
      xhr.upload.addEventListener('progress', (event) => {
        if (!event.lengthComputable) return;
        onProgress({
          loaded: event.loaded,
          total: event.total,
          percent: Math.round((event.loaded / event.total) * 100),
        });
      });
    }

    const onAbort = () => xhr.abort();
    signal?.addEventListener('abort', onAbort, { once: true });
    const done = () => signal?.removeEventListener('abort', onAbort);

    const handleAbort = () => {
      done();
      failWith(
        new ApiError({
          ...base,
          status: 0,
          code: CLIENT_ERROR_CODES.ABORTED,
          message: 'The upload was cancelled.',
        }),
      );
    };
    xhr.addEventListener('abort', handleAbort);
    xhr.addEventListener('timeout', () => {
      done();
      failWith(
        new ApiError({
          ...base,
          status: 0,
          code: CLIENT_ERROR_CODES.TIMEOUT,
          message: 'The upload took too long.',
        }),
      );
    });
    xhr.addEventListener('error', () => {
      done();
      failWith(
        new ApiError({
          ...base,
          status: 0,
          code: CLIENT_ERROR_CODES.NETWORK_ERROR,
          message: 'Cannot reach the server.',
        }),
      );
    });
    xhr.addEventListener('load', () => {
      done();
      const responseId = xhr.getResponseHeader(HTTP_HEADERS.REQUEST_ID) ?? requestId;
      let body: unknown = null;
      try {
        body = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        body = null;
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve((isSuccessEnvelope(body) ? body.data : body) as T);
        return;
      }

      // Expired token: refresh once, upload again (progress restarts from 0).
      if (
        xhr.status === HTTP_STATUS.UNAUTHORIZED &&
        !isRetry &&
        Object.keys(authHeaders).length > 0
      ) {
        void apiClient.refreshAccessToken().then((token) => {
          if (token) {
            send<T>(path, file, options, true).then(resolve, reject);
            return null;
          }
          const ended = new ApiError({
            ...base,
            requestId: responseId,
            status: HTTP_STATUS.UNAUTHORIZED,
            code: CLIENT_ERROR_CODES.AUTH_SESSION_EXPIRED,
            message: 'Your session has expired. Please sign in again.',
          });
          apiClient.notifyUnauthorized(ended);
          failWith(ended);
          return null;
        });
        return;
      }

      const retryAfter = parseRetryAfter(xhr.getResponseHeader(HTTP_HEADERS.RETRY_AFTER));
      failWith(
        isErrorEnvelope(body)
          ? new ApiError({
              ...base,
              requestId: responseId,
              retryAfter,
              status: xhr.status,
              code: body.code,
              message: body.message,
              errors: body.errors ?? [],
            })
          : new ApiError({
              ...base,
              requestId: responseId,
              retryAfter,
              status: xhr.status,
              code: CLIENT_ERROR_CODES.HTTP_ERROR,
              message: xhr.statusText || `Upload failed (${xhr.status})`,
            }),
      );
    });

    if (signal?.aborted) {
      handleAbort();
      return;
    }
    xhr.send(form);
  });
}
