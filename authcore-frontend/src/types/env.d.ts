/// <reference types="vite/client" />

/** Every VITE_ variable the app reads (see .env.example). Read only through src/config/env.ts. */
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
