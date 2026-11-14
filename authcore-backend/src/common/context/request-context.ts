import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext {
  requestId: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

/** Runs `callback` with the given request context available to all code it calls. */
export function runWithRequestContext<T>(
  context: RequestContext,
  callback: () => T,
): T {
  return storage.run(context, callback);
}

/** The current request's id, or undefined outside a request (startup, jobs). */
export function getRequestId(): string | undefined {
  return storage.getStore()?.requestId;
}
