import type { Page } from '@playwright/test';

/**
 * Calls the AuthCore API as the signed-in admin, for test setup and clean-up (creating a
 * role to edit, deleting what a test made), so tests use the screen only for what they test.
 *
 * Uses the access token the app itself received (captured from its sign-in / refresh
 * responses, see fixtures.ts): no extra sign-ins (the backend allows 10 a minute) and the
 * browser's session is never disturbed.
 */
export class AdminApi {
  constructor(
    private readonly page: Page,
    private readonly token: { value: string | null },
    private readonly reauth: () => Promise<void>,
    /** Told about every call (for the dashboard's API coverage). */
    private readonly onCall?: (method: string, url: string, status: number) => void,
  ) {}

  private url(path: string): string {
    return new URL(`/api/v1${path}`, this.page.url()).toString();
  }

  private async send<T>(method: string, path: string, data?: unknown, retry = true): Promise<T> {
    if (!this.token.value) await this.reauth();
    const res = await this.page.request.fetch(this.url(path), {
      method,
      data,
      headers: { authorization: `Bearer ${this.token.value}` },
      failOnStatusCode: false,
    });
    this.onCall?.(method, this.url(path), res.status());
    // Access tokens last 15 minutes: let the app refresh it, then try once more.
    if (res.status() === 401 && retry) {
      this.token.value = null;
      await this.reauth();
      return this.send(method, path, data, false);
    }
    const body = (await res.json().catch(() => null)) as { data?: T; message?: string } | null;
    if (!res.ok()) {
      throw new Error(`${method} ${path} → ${res.status()}: ${body?.message ?? 'no message'}`);
    }
    return (body && 'data' in body ? body.data : body) as T;
  }

  get<T>(path: string): Promise<T> {
    return this.send<T>('GET', path);
  }
  post<T>(path: string, data?: unknown): Promise<T> {
    return this.send<T>('POST', path, data);
  }
  patch<T>(path: string, data?: unknown): Promise<T> {
    return this.send<T>('PATCH', path, data);
  }
  delete<T>(path: string): Promise<T> {
    return this.send<T>('DELETE', path);
  }
}

/** Short unique text for names and keys made by tests (worker + time + random). */
export function uniqueId(workerIndex: number): string {
  return `${workerIndex}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`.toUpperCase();
}
