/**
 * The only module that reads import.meta.env (enforced by
 * scripts/check-architecture.mjs). Values are parsed and validated once at
 * startup; a bad value fails loudly instead of misbehaving later.
 * Everything here ends up in the browser bundle: never put secrets in VITE_ variables.
 */

function readString(name: keyof ImportMetaEnv, fallback: string): string {
  const value = import.meta.env[name];
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : fallback;
}

function readApiBaseUrl(): string {
  const value = readString('VITE_API_BASE_URL', '/api/v1').replace(/\/+$/, '');
  if (!value.startsWith('/') && !/^https?:\/\//.test(value)) {
    throw new Error(
      `VITE_API_BASE_URL must be a path ("/api/v1") or an http(s) URL, got "${value}"`,
    );
  }
  return value;
}

export const env = Object.freeze({
  /** API root, e.g. "/api/v1" (dev proxy) or "https://api.example.com/api/v1". */
  apiBaseUrl: readApiBaseUrl(),
  /** "development" | "production" (Vite mode). */
  mode: import.meta.env.MODE,
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
});

export type Env = typeof env;
