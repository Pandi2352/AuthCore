import { defineConfig, devices } from '@playwright/test';

// Reads .env and picks the target: PW_ENV=test (default, npm run env:test) or dev.
import { resolveTarget } from './target.mjs';

const target = resolveTarget();
const baseURL = target.baseURL;
const isCI = Boolean(process.env.CI);
const PUBLIC_TESTS = /public[\\/].*\.spec\.ts/;

/**
 * AuthCore browser tests. By default against the separate test environment (own database,
 * emails to a folder): start it with `npm run env:test`. PW_ENV=dev uses your dev servers.
 * Signed-in tests: each worker signs in once and keeps its tab (tests/support/fixtures.ts).
 * https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests',
  // Stops early with a clear message when the app isn't running.
  globalSetup: './tests/support/global-setup.ts',
  outputDir: './test-results',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  // Each worker signs in once; the backend allows 10 sign-ins a minute per IP.
  workers: isCI ? 2 : 4,
  timeout: 30_000,
  // The dev server compiles each page on first open, so allow a little longer.
  expect: { timeout: 12_000 },
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    // Full history for the test dashboard (npm run dashboard).
    ['./reporters/dashboard-reporter.ts'],
  ],

  use: {
    baseURL,
    // Evidence only when something fails.
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
  },

  projects: [
    // Pages that need no sign-in.
    { name: 'public', testMatch: PUBLIC_TESTS, use: { ...devices['Desktop Chrome'] } },
    // Signed-in pages, desktop and phone (phone runs the tests tagged @mobile).
    { name: 'chromium', testIgnore: PUBLIC_TESTS, use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', testIgnore: PUBLIC_TESTS, grep: /@mobile/, use: { ...devices['Pixel 7'] } },
  ],
});
