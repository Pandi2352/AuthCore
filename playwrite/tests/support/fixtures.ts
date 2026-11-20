import {
  test as base,
  expect,
  type ConsoleMessage,
  type Page,
  type Request,
  type Response,
} from '@playwright/test';

import { AdminApi } from './api';
import { adminCredentials, ROUTES } from './constants';
import { CoverageRecorder } from './coverage';

/** The app's current access token per signed-in tab (captured from its own auth calls). */
const tokens = new WeakMap<Page, { value: string | null }>();

/**
 * Why signed-in tests share one browser tab per worker:
 * - the refresh token is single-use (each refresh rotates it; reusing an old one ends the
 *   session), so a saved cookie can't be shared between parallel tests;
 * - the backend allows 10 sign-ins and 30 refreshes per minute from one IP.
 * So each worker signs in once in its own context, keeps that tab, and moves between pages
 * inside the app (like clicking the menu) instead of reloading it.
 */
export interface AdminApp {
  page: Page;
  /** Go to a route without reloading the app (keeps the session). */
  open: (path: string) => Promise<void>;
}

/** Sign in through the real login page; resolves on the dashboard. */
export async function signIn(page: Page): Promise<void> {
  const { email, password } = adminCredentials();
  await page.goto(ROUTES.login);
  await page.getByRole('textbox', { name: /^email/i }).fill(email);
  await page.getByRole('textbox', { name: /^password/i }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  // The dashboard greets by name ("Welcome back, Playwright!"); the login page only says
  // "Welcome back", so this proves the sign-in worked.
  await expect(page.getByRole('heading', { name: /^welcome back, /i })).toBeVisible({
    timeout: 15_000,
  });
  // Let the post-login redirects and first data loads finish, so they can't pull the
  // first test's page back to the dashboard.
  await page.waitForURL((url) => url.pathname === ROUTES.dashboard);
  await page.waitForLoadState('networkidle');
}

export const test = base.extend<
  { app: AdminApp; api: AdminApi; coverage: CoverageRecorder },
  { adminPage: Page }
>({
  // Pages and API calls each test touched (dashboard coverage pages).
  coverage: async ({}, use, testInfo) => {
    const recorder = new CoverageRecorder();
    await use(recorder);
    await recorder.attach(testInfo);
  },

  // Tests without sign-in use the plain page: record it too.
  page: async ({ page, coverage }, use) => {
    const stop = coverage.watch(page);
    await use(page);
    coverage.visit(page.url());
    stop();
  },

  // One signed-in tab per worker, with the project's device settings (desktop / phone).
  adminPage: [
    async ({ browser }, use, workerInfo) => {
      const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch, locale, baseURL } =
        workerInfo.project.use;
      const context = await browser.newContext({
        viewport,
        userAgent,
        deviceScaleFactor,
        isMobile,
        hasTouch,
        locale,
        baseURL,
      });
      // Playwright traces this context per test by itself (the `trace` setting).
      const page = await context.newPage();
      // Keep the access token the app gets at sign-in and on every refresh, for AdminApi.
      const token = { value: null as string | null };
      tokens.set(page, token);
      page.on('response', async (response) => {
        const { pathname } = new URL(response.url());
        if (!/\/api\/v1\/auth\/(login|refresh)$/.test(pathname) || !response.ok()) return;
        try {
          const body = (await response.json()) as { data?: { accessToken?: string }; accessToken?: string };
          token.value = body.data?.accessToken ?? body.accessToken ?? token.value;
        } catch {
          /* not JSON */
        }
      });
      await signIn(page);
      await use(page);
      await context.close();
    },
    { scope: 'worker' },
  ],

  app: async ({ adminPage, coverage }, use, testInfo) => {
    const stopRecording = coverage.watch(adminPage);
    // Evidence for the report: browser console problems and failed API calls.
    const consoleLines: string[] = [];
    const apiFailures: string[] = [];
    const onConsole = (message: ConsoleMessage) => {
      // The router warns about the tests' own navigation shortcut (app.open); not an app issue.
      if (message.text().includes('POP navigation to a location that was not created')) return;
      if (message.type() === 'error' || message.type() === 'warning') {
        consoleLines.push(`[${message.type()}] ${message.text()}`);
      }
    };
    const onResponse = (response: Response) => {
      if (response.status() >= 400 && response.url().includes('/api/')) {
        apiFailures.push(`${response.status()} ${response.request().method()} ${response.url()}`);
      }
    };
    const onRequestFailed = (request: Request) => {
      // Cancelled by the app itself when a page is left (normal), not a failure.
      if (request.failure()?.errorText === 'net::ERR_ABORTED') return;
      apiFailures.push(
        `FAILED ${request.method()} ${request.url()} (${request.failure()?.errorText ?? 'unknown'})`,
      );
    };
    adminPage.on('console', onConsole);
    adminPage.on('response', onResponse);
    adminPage.on('requestfailed', onRequestFailed);

    const target = (path: string) => path.split('?')[0];
    const go = async (path: string) => {
      // React Router follows history changes: push the route and tell it. Right after
      // sign-in the app may still be finishing its own redirect and override ours, so
      // check the route stuck and push again if not.
      if (new URL(adminPage.url()).pathname === target(path)) return;
      const heading = () =>
        adminPage
          .locator('main h1')
          .first()
          .textContent({ timeout: 2_000 })
          .catch(() => null);
      const before = await heading();
      for (let attempt = 0; attempt < 4; attempt++) {
        await adminPage.evaluate((to) => {
          window.history.pushState({}, '', to);
          window.dispatchEvent(new PopStateEvent('popstate'));
        }, path);
        await adminPage.waitForURL((url) => url.pathname === target(path));
        // The router can drop this navigation if the app starts another one, so check the
        // new page actually rendered (its heading changed) and is still the current route.
        const rendered = await adminPage
          .waitForFunction(
            (old) => {
              const h1 = document.querySelector('main h1');
              return Boolean(h1 && h1.textContent !== old);
            },
            before,
            { timeout: 8_000 },
          )
          .then(() => true)
          .catch(() => false);
        await adminPage.waitForLoadState('networkidle');
        if (rendered && new URL(adminPage.url()).pathname === target(path)) return;
      }
      throw new Error(`Could not open ${path}: the app kept redirecting`);
    };
    // One readable step in reports instead of the navigation internals.
    const open = (path: string) => base.step(`Open ${path}`, () => go(path), { box: true });
    await use({ page: adminPage, open });

    // The page a test ends on counts as visited even when it was already open.
    coverage.visit(adminPage.url());
    stopRecording();
    adminPage.off('console', onConsole);
    adminPage.off('response', onResponse);
    adminPage.off('requestfailed', onRequestFailed);
    if (testInfo.status !== testInfo.expectedStatus) {
      await testInfo.attach('page-url', { body: adminPage.url(), contentType: 'text/plain' });
    }
    if (consoleLines.length) {
      await testInfo.attach('console', { body: consoleLines.join('\n'), contentType: 'text/plain' });
    }
    if (apiFailures.length) {
      await testInfo.attach('api-failures', {
        body: apiFailures.join('\n'),
        contentType: 'text/plain',
      });
    }
  },

  api: async ({ adminPage, coverage }, use) => {
    const token = tokens.get(adminPage) ?? { value: null };
    // Token expired (or not seen yet): a reload makes the app refresh it with its cookie
    // (one tab per worker, so the single-use refresh token is never shared). Captured above.
    const reauth = async () => {
      await adminPage.reload({ waitUntil: 'networkidle' });
    };
    await use(new AdminApi(adminPage, token, reauth, (method, url, status) => coverage.call(method, url, status)));
  },
});

export { expect };
