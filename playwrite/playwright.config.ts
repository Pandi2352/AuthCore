import { existsSync } from 'node:fs';

import { defineConfig, devices } from '@playwright/test';

// Local settings (URLs, test account) from .env when present — never committed.
if (existsSync('.env')) process.loadEnvFile('.env');

const baseURL = process.env.PW_BASE_URL ?? 'http://localhost:5173';
const isCI = Boolean(process.env.CI);
const PUBLIC_TESTS = /public[\\/].*\.spec\.ts/;

/**
 * AuthCore browser tests. Run against a running frontend (default: the Vite dev server on
 * 5173); point PW_BASE_URL at a test environment to keep test data and email out of dev.
 * Signed-in tests: each worker signs in once and keeps its tab (tests/support/fixtures.ts).
 * https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests',
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
