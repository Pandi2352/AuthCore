import path from 'node:path';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

import packageJson from './package.json' with { type: 'json' };
import { appConfig } from './src/config/app.config.ts';

const escapeHtml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Fills %APP_*% placeholders in index.html from src/config/app.config.ts,
 * so the browser title and meta tags follow the project config.
 */
function appConfigHtml(): Plugin {
  const values: Record<string, string> = {
    APP_NAME: appConfig.name,
    APP_DESCRIPTION: appConfig.description,
    APP_LANG: appConfig.locale.defaultLanguage,
    APP_THEME_COLOR_LIGHT: appConfig.themeColor.light,
    APP_THEME_COLOR_DARK: appConfig.themeColor.dark,
    APP_FAVICON: appConfig.favicon,
    APP_SHORT_NAME: appConfig.shortName,
  };
  return {
    name: 'app-config-html',
    transformIndexHtml(html) {
      return html.replace(/%(APP_[A-Z_]+)%/g, (match, key: string) => {
        const value = values[key];
        if (value === undefined) {
          throw new Error(`index.html uses unknown placeholder ${match}`);
        }
        return escapeHtml(value);
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), appConfigHtml()],
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
