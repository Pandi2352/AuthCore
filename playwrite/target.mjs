// Which AuthCore the tests run against. One place, used by playwright.config.ts, the
// dashboard and the test environment script.
//
//   PW_ENV=test (default)  the separate test environment (npm run env:test):
//                          own database, emails to a folder, never your dev data
//   PW_ENV=dev             your dev servers (5173 / 3000) and dev database
import { existsSync } from 'node:fs';
import path from 'node:path';

export const ROOT = import.meta.dirname;
if (existsSync(path.join(ROOT, '.env'))) process.loadEnvFile(path.join(ROOT, '.env'));

/** Fixed settings of the test environment (ports and database are its own). */
export const TEST_ENV = {
  webPort: Number(process.env.PW_TEST_WEB_PORT ?? 5174),
  apiPort: Number(process.env.PW_TEST_API_PORT ?? 3998),
  mongoUri: process.env.PW_TEST_MONGODB_URI ?? 'mongodb://localhost:27017/authcore_pw_test',
  adminEmail: 'playwright.admin@authcore.test',
  dir: path.join(ROOT, '.test-env'),
};

export const TARGETS = ['test', 'dev'];

/** { name, baseURL, email, password } for PW_ENV (or the given name). */
export function resolveTarget(name = process.env.PW_ENV || 'test') {
  if (name === 'dev') {
    return {
      name: 'dev',
      label: 'Dev servers',
      baseURL: process.env.PW_DEV_BASE_URL ?? process.env.PW_BASE_URL ?? 'http://localhost:5173',
      email: process.env.E2E_ADMIN_EMAIL ?? null,
      password: process.env.E2E_ADMIN_PASSWORD ?? null,
    };
  }
  return {
    name: 'test',
    label: 'Test environment',
    baseURL: `http://localhost:${TEST_ENV.webPort}`,
    email: TEST_ENV.adminEmail,
    password: process.env.E2E_TEST_ADMIN_PASSWORD ?? null,
  };
}
