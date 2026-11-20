import type { Frame, Page, Response, TestInfo } from '@playwright/test';

/**
 * Records what a test touched, for the dashboard's coverage pages: every app page it
 * visited and every API call it made (by the page or through AdminApi). Attached to the
 * test as "coverage" JSON; the dashboard reporter folds it into the run and keeps no file.
 */
export class CoverageRecorder {
  private readonly pages = new Set<string>();
  private readonly calls = new Map<string, { method: string; path: string; status: number; count: number }>();

  /** Follow a tab's navigations and API responses until the returned function is called. */
  watch(page: Page): () => void {
    const onNavigated = (frame: Frame) => {
      if (frame === page.mainFrame()) this.visit(frame.url());
    };
    const onResponse = (response: Response) =>
      this.call(response.request().method(), response.url(), response.status());
    page.on('framenavigated', onNavigated);
    page.on('response', onResponse);
    return () => {
      page.off('framenavigated', onNavigated);
      page.off('response', onResponse);
    };
  }

  visit(url: string): void {
    try {
      const { protocol, pathname } = new URL(url);
      if (protocol === 'http:' || protocol === 'https:') this.pages.add(pathname);
    } catch {
      /* about:blank and the like */
    }
  }

  call(method: string, url: string, status: number): void {
    let pathname: string;
    try {
      pathname = new URL(url).pathname;
    } catch {
      return;
    }
    if (!pathname.startsWith('/api/')) return;
    const key = `${method} ${pathname} ${status}`;
    const known = this.calls.get(key);
    if (known) known.count++;
    else this.calls.set(key, { method, path: pathname, status, count: 1 });
  }

  async attach(testInfo: TestInfo): Promise<void> {
    if (!this.pages.size && !this.calls.size) return;
    await testInfo.attach('coverage', {
      body: JSON.stringify({ pages: [...this.pages], api: [...this.calls.values()] }),
      contentType: 'application/json',
    });
  }
}
