/// <reference types="vite/client" />

/** Every VITE_ variable the app reads (see .env.example). Read only through src/config/env.ts. */
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_API_TIMEOUT_MS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** package.json version, injected by vite.config.ts (`define`). Read through `env.appVersion`. */
declare const __APP_VERSION__: string;

/** true in the dev server, false in builds (vite.config.ts `define`). Dev-only code only. */
declare const __DEV_BUILD__: boolean;
