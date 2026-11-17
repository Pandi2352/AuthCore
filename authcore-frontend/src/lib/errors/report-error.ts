import { env } from '@/config/env';

import { ApiError, isAbortError } from '../api/api-error';
import { CLIENT_ERROR_CODES } from '../constants/error-codes';

export interface ErrorContext {
  /** Where it happened: "ErrorBoundary:page", "route", "api", "window" … */
  source: string;
  /** Extra details (component stack, route path, request id …). No personal data. */
  extra?: Record<string, unknown>;
}

export type ErrorReporter = (error: unknown, context: ErrorContext) => void;

let reporter: ErrorReporter | null = null;
const recent = new Map<string, number>();
const DEDUPE_MS = 10_000;

/**
 * Plug in an error-monitoring service (Level 3: Sentry). Until then errors are only logged
 * to the console in development.
 *
 *   setErrorReporter((error, ctx) => Sentry.captureException(error, { tags: { source: ctx.source }, extra: ctx.extra }));
 */
export function setErrorReporter(next: ErrorReporter | null): void {
  reporter = next;
}

/**
 * Expected outcomes aren't bugs: cancelled requests, offline, 4xx answers (validation, 401,
 * 403, 404, 429). Server errors (5xx), unexpected responses and real exceptions are reported.
 */
export function shouldReport(error: unknown): boolean {
  if (isAbortError(error)) return false;
  if (error instanceof ApiError) {
    if (error.code === CLIENT_ERROR_CODES.NETWORK_ERROR) return false;
    if (error.code === CLIENT_ERROR_CODES.AUTH_SESSION_EXPIRED) return false;
    return (
      error.status === 0 || error.status >= 500 || error.code === CLIENT_ERROR_CODES.HTTP_ERROR
    );
  }
  return true;
}

const fingerprint = (error: unknown, source: string): string =>
  `${source}|${error instanceof Error ? `${error.name}:${error.message}` : String(error)}`;

/** Report an unexpected error once (deduplicated for 10 s). Never throws. */
export function reportError(error: unknown, context: ErrorContext): void {
  try {
    if (!shouldReport(error)) return;
    const key = fingerprint(error, context.source);
    const now = Date.now();
    if ((recent.get(key) ?? 0) > now - DEDUPE_MS) return;
    recent.set(key, now);
    if (recent.size > 100) recent.clear();

    const extra =
      error instanceof ApiError
        ? { ...context.extra, requestId: error.requestId, code: error.code, status: error.status }
        : context.extra;
    if (env.isDevelopment) console.error(`[${context.source}]`, error, extra ?? '');
    reporter?.(error, { ...context, extra });
  } catch {
    // reporting must never break the app
  }
}
