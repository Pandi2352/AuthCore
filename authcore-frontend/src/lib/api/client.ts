import { env } from '@/config/env';

import { CLIENT_ERROR_CODES } from '../constants/error-codes';
import { HTTP_HEADERS, HTTP_STATUS, isServerError } from '../constants/http';
import { buildQueryString, type QueryParams } from '../utils/url';
import { ApiError } from './api-error';
import { createRequestId, isOffline, linkSignals, parseRetryAfter } from './request-utils';
import { isErrorEnvelope, isSuccessEnvelope, type Paginated, type PaginationMeta } from './types';

// ---------------------------------------------------------------- public types

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RequestOptions {
  /** Query string values (null / undefined / '' are left out; arrays repeat the key). */
  query?: QueryParams;
  /** JSON-serialisable value, or FormData / Blob / URLSearchParams sent as-is. */
  body?: unknown;
  headers?: HeadersInit;
  /** Cancel from outside (React effect cleanup, newer search …) → ApiError ABORTED. */
  signal?: AbortSignal;
  /** Per-request timeout (ms); default VITE_API_TIMEOUT_MS. 0 = none. → ApiError TIMEOUT. */
  timeoutMs?: number;
  /**
   * Send the access token and refresh it once on 401 (default true). false for public
   * endpoints and for the auth calls themselves (login, refresh, …).
   */
  auth?: boolean;
}

/** Access-token source and refresher, registered by the auth layer (the client imports no feature). */
export interface AuthAdapter {
  getAccessToken: () => string | null;
  /** Get a new access token (e.g. with the refresh cookie). null = the session is over. */
  refreshAccessToken: () => Promise<string | null>;
}

export interface ApiEvents {
  /** Session over: refresh failed after a 401. The auth layer signs the user out. */
  unauthorized: ApiError;
  /** 403: e.g. permissions changed — the auth layer can reload them. */
  forbidden: ApiError;
  /** 5xx from the backend (logging / monitoring). */
  serverError: ApiError;
  /** Every request that failed (after the more specific events). */
  error: ApiError;
}

type Listener<E extends keyof ApiEvents> = (payload: ApiEvents[E]) => void;

// ---------------------------------------------------------------- client

/**
 * The only place that calls fetch (architecture rule). Responsibilities:
 * - base URL (VITE_API_BASE_URL), query strings, JSON / FormData bodies, cookies (refresh token)
 * - X-Request-Id per request (the backend reuses it in its logs)
 * - envelope unwrapped: callers receive `data`; lists via getPage() → { items, meta }
 * - every failure is an ApiError: backend envelope, network (NETWORK_ERROR), timeout (TIMEOUT),
 *   caller abort (ABORTED), unexpected response (HTTP_ERROR)
 * - Bearer token from the auth adapter; on 401 one shared refresh, then the request is retried once
 * - events for the app (unauthorized / forbidden / serverError / error), registered by providers
 */
export class ApiClient {
  private readonly baseUrl: string;
  private readonly defaultTimeoutMs: number;
  private auth: AuthAdapter | null = null;
  private refreshing: Promise<string | null> | null = null;
  private readonly listeners: { [E in keyof ApiEvents]: Set<Listener<E>> } = {
    unauthorized: new Set(),
    forbidden: new Set(),
    serverError: new Set(),
    error: new Set(),
  };

  constructor(options: { baseUrl: string; timeoutMs: number }) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.defaultTimeoutMs = options.timeoutMs;
  }

  // ---- configuration (called by providers)

  /** Register (or clear with null) the auth adapter. */
  setAuthAdapter(adapter: AuthAdapter | null): void {
    this.auth = adapter;
  }

  /** Subscribe to an event; returns the unsubscribe function. */
  on<E extends keyof ApiEvents>(event: E, listener: Listener<E>): () => void {
    this.listeners[event].add(listener);
    return () => this.listeners[event].delete(listener);
  }

  // ---- HTTP verbs (envelope unwrapped)

  get<T>(path: string, options?: Omit<RequestOptions, 'body'>): Promise<T> {
    return this.request<T>('GET', path, options);
  }
  post<T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'body'>): Promise<T> {
    return this.request<T>('POST', path, { ...options, body });
  }
  put<T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'body'>): Promise<T> {
    return this.request<T>('PUT', path, { ...options, body });
  }
  patch<T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'body'>): Promise<T> {
    return this.request<T>('PATCH', path, { ...options, body });
  }
  delete<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>('DELETE', path, options);
  }

  /** A paginated list endpoint: `{ items, meta }` (meta from the envelope). */
  async getPage<T>(path: string, options?: Omit<RequestOptions, 'body'>): Promise<Paginated<T>> {
    const { data, meta } = await this.send<T[]>('GET', path, options ?? {});
    const items = Array.isArray(data) ? data : [];
    return { items, meta: meta ?? singlePageMeta(items.length) };
  }

  /** Envelope-unwrapped request with any method. */
  async request<T>(method: HttpMethod, path: string, options: RequestOptions = {}): Promise<T> {
    const { data } = await this.send<T>(method, path, options);
    return data;
  }

  /**
   * The raw Response (status checked, auth / refresh / errors handled) — for downloads and
   * endpoints that don't use the envelope.
   */
  async raw(method: HttpMethod, path: string, options: RequestOptions = {}): Promise<Response> {
    return this.execute(method, path, options);
  }

  // ---- auth helpers for transports that don't use fetch (upload.ts)

  /** Authorization header for the current token (empty when signed out or not our API). */
  authHeaders(path = '/'): Record<string, string> {
    if (!this.isApiUrl(path)) return {};
    const token = this.auth?.getAccessToken();
    return token ? { [HTTP_HEADERS.AUTHORIZATION]: `Bearer ${token}` } : {};
  }

  /** One shared refresh for all callers at the same moment (null = session over). */
  refreshAccessToken(): Promise<string | null> {
    if (!this.auth) return Promise.resolve(null);
    if (!this.refreshing) {
      this.refreshing = this.auth
        .refreshAccessToken()
        .catch(() => null)
        .finally(() => {
          this.refreshing = null;
        });
    }
    return this.refreshing;
  }

  url(path: string, query?: QueryParams): string {
    const qs = query ? buildQueryString(query) : '';
    const base = /^https?:\/\//i.test(path)
      ? path // absolute URL given on purpose
      : `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    if (!qs) return base;
    return `${base}${base.includes('?') ? '&' : '?'}${qs}`;
  }

  /** A path of our API (relative, or an absolute URL under the base URL): the only place the token goes. */
  isApiUrl(path: string): boolean {
    if (!/^https?:\/\//i.test(path)) return true;
    return (
      /^https?:\/\//i.test(this.baseUrl) &&
      (path === this.baseUrl || path.startsWith(`${this.baseUrl}/`))
    );
  }

  /** Report a failure from another transport (upload.ts) to the listeners. */
  notifyError(error: ApiError): void {
    this.emitError(error);
  }

  /** The session ended (refresh failed): tells the auth layer to sign out locally. */
  notifyUnauthorized(error: ApiError): void {
    for (const listener of this.listeners.unauthorized) listener(error);
  }

  // ---- internals

  private async send<T>(
    method: HttpMethod,
    path: string,
    options: RequestOptions,
  ): Promise<{ data: T; meta?: PaginationMeta }> {
    const response = await this.execute(method, path, options);
    const requestId = response.headers.get(HTTP_HEADERS.REQUEST_ID) ?? undefined;
    if (response.status === HTTP_STATUS.NO_CONTENT) return { data: undefined as T };
    const text = await response.text();
    if (!text) return { data: undefined as T };
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      throw this.fail(
        new ApiError({
          status: response.status,
          code: CLIENT_ERROR_CODES.HTTP_ERROR,
          message: 'The server sent an unexpected response.',
          requestId,
          method,
          path,
        }),
      );
    }
    // Endpoints that skip the envelope return their body as-is.
    if (isSuccessEnvelope(body)) return { data: body.data as T, meta: body.meta };
    return { data: body as T };
  }

  /** fetch + timeout + abort + token + one refresh-and-retry; throws ApiError for !ok. */
  private async execute(
    method: HttpMethod,
    path: string,
    options: RequestOptions,
    isRetry = false,
  ): Promise<Response> {
    const { query, body, signal, timeoutMs = this.defaultTimeoutMs, auth = true } = options;
    const requestId = createRequestId();
    const headers = new Headers(options.headers);
    headers.set(HTTP_HEADERS.REQUEST_ID, requestId);
    if (!headers.has('Accept')) headers.set('Accept', 'application/json');

    let payload: BodyInit | undefined;
    if (body === undefined || body === null) {
      payload = undefined;
    } else if (
      body instanceof FormData ||
      body instanceof Blob ||
      body instanceof URLSearchParams
    ) {
      payload = body; // the browser sets the content type (multipart boundary …)
    } else {
      payload = JSON.stringify(body);
      if (!headers.has(HTTP_HEADERS.CONTENT_TYPE))
        headers.set(HTTP_HEADERS.CONTENT_TYPE, 'application/json');
    }

    // The token only ever goes to our own API, never to an absolute URL elsewhere.
    const token = auth && this.isApiUrl(path) ? (this.auth?.getAccessToken() ?? null) : null;
    if (token && !headers.has(HTTP_HEADERS.AUTHORIZATION)) {
      headers.set(HTTP_HEADERS.AUTHORIZATION, `Bearer ${token}`);
    }

    // Offline: fail fast instead of waiting for the network stack to give up.
    if (isOffline()) {
      throw this.fail(
        new ApiError({
          status: 0,
          code: CLIENT_ERROR_CODES.NETWORK_ERROR,
          message: "You're offline.",
          requestId,
          method,
          path,
        }),
      );
    }

    const timeout = new AbortController();
    const timer = timeoutMs > 0 ? setTimeout(() => timeout.abort(), timeoutMs) : undefined;
    const combined = linkSignals([timeout.signal, signal]);

    let response: Response;
    try {
      response = await fetch(this.url(path, query), {
        method,
        headers,
        body: payload,
        signal: combined.signal,
        credentials: 'include', // refresh-token cookie
      });
    } catch (cause) {
      const base = { status: 0, requestId, method, path, cause };
      if (signal?.aborted) {
        throw new ApiError({
          ...base,
          code: CLIENT_ERROR_CODES.ABORTED,
          message: 'The request was cancelled.',
        });
      }
      if (timeout.signal.aborted) {
        throw this.fail(
          new ApiError({
            ...base,
            code: CLIENT_ERROR_CODES.TIMEOUT,
            message: 'The server took too long to respond.',
          }),
        );
      }
      throw this.fail(
        new ApiError({
          ...base,
          code: CLIENT_ERROR_CODES.NETWORK_ERROR,
          message: 'Cannot reach the server.',
        }),
      );
    } finally {
      clearTimeout(timer);
      combined.cleanup();
    }

    if (response.ok) return response;

    const error = await toApiError(response, { method, path, requestId });

    // Expired / invalid access token: refresh once (shared), retry once.
    if (response.status === HTTP_STATUS.UNAUTHORIZED && auth && token && !isRetry && this.auth) {
      const fresh = await this.refreshAccessToken();
      if (fresh) return this.execute(method, path, options, true);
      const ended = new ApiError({
        status: HTTP_STATUS.UNAUTHORIZED,
        code: CLIENT_ERROR_CODES.AUTH_SESSION_EXPIRED,
        message: 'Your session has expired. Please sign in again.',
        requestId: error.requestId,
        method,
        path,
        cause: error,
      });
      this.notifyUnauthorized(ended);
      throw this.fail(ended);
    }
    throw this.fail(error);
  }

  /** Emit events for an error and return it (for `throw this.fail(error)`). */
  private fail(error: ApiError): ApiError {
    this.emitError(error);
    return error;
  }

  private emitError(error: ApiError): void {
    if (error.status === HTTP_STATUS.FORBIDDEN) for (const l of this.listeners.forbidden) l(error);
    if (isServerError(error.status)) for (const l of this.listeners.serverError) l(error);
    for (const l of this.listeners.error) l(error);
  }
}

/** Response (not ok) → ApiError from the backend envelope, or a generic HTTP_ERROR. */
export async function toApiError(
  response: Response,
  context: { method?: string; path?: string; requestId?: string },
): Promise<ApiError> {
  const requestId = response.headers.get(HTTP_HEADERS.REQUEST_ID) ?? context.requestId;
  const retryAfter = parseRetryAfter(response.headers.get(HTTP_HEADERS.RETRY_AFTER));
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // not JSON (proxy error page …)
  }
  if (isErrorEnvelope(body)) {
    return new ApiError({
      status: response.status,
      code: body.code,
      message: body.message,
      errors: Array.isArray(body.errors) ? body.errors : [],
      requestId,
      retryAfter,
      method: context.method,
      path: context.path,
    });
  }
  return new ApiError({
    status: response.status,
    code: CLIENT_ERROR_CODES.HTTP_ERROR,
    message: response.statusText || `Request failed (${response.status})`,
    requestId,
    retryAfter,
    method: context.method,
    path: context.path,
  });
}

const singlePageMeta = (count: number): PaginationMeta => ({
  page: 1,
  limit: count,
  totalItems: count,
  totalPages: count === 0 ? 0 : 1,
  hasNextPage: false,
  hasPreviousPage: false,
});

export const apiClient = new ApiClient({ baseUrl: env.apiBaseUrl, timeoutMs: env.apiTimeoutMs });
