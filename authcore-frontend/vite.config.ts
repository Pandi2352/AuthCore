import path from 'node:path';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

import packageJson from './package.json' with { type: 'json' };
import { buildNoFlashScript } from './src/app/theme/theme-core.ts';
import { themeRuntimeOptions } from './src/app/theme/theme-options.ts';
import { appConfig } from './src/config/app.config.ts';
import { keyOf } from './src/lib/constants/storage-keys.ts';

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

/**
 * Applies the stored theme (mode, preset, appearance) before the first paint, so dark mode
 * never flashes white. With a Content-Security-Policy, allow this script by its hash.
 */
function themeNoFlash(): Plugin {
  return {
    name: 'theme-no-flash',
    transformIndexHtml() {
      return [
        {
          tag: 'script',
          children: buildNoFlashScript(themeRuntimeOptions),
          injectTo: 'head-prepend',
        },
      ];
    },
  };
}

/**
 * Applies the cached Business settings (site name, description, favicon; lib/branding) before
 * the first paint, so a renamed site never shows the old name or icon while the app loads.
 * Runs at the end of <head> (after the tags it updates). Only http(s) / same-origin favicons.
 */
function brandingNoFlash(): Plugin {
  const key = JSON.stringify(keyOf('branding'));
  const script = String.raw`(function(){try{
var b=JSON.parse(localStorage.getItem(${key})||'null');
if(!b||typeof b.siteName!=='string'||!b.siteName)return;
document.title=b.siteName;
var m=function(n,v){var e=document.querySelector('meta[name="'+n+'"]');if(e&&typeof v==='string')e.content=v;};
m('description',b.siteDescription);m('application-name',b.siteName);m('apple-mobile-web-app-title',b.siteName);
var f=b.assets&&b.assets.favicon;
if(typeof f==='string'&&/^(https?:\/\/|\/(?!\/))/i.test(f)){var l=document.querySelector('link[rel="icon"]');if(l)l.setAttribute('href',f);}
}catch(e){}})();`;
  return {
    name: 'branding-no-flash',
    transformIndexHtml() {
      return [{ tag: 'script', children: script, injectTo: 'head' }];
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react(), tailwindcss(), appConfigHtml(), themeNoFlash(), brandingNoFlash()],
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
    // true only in the dev server: dev-only routes (/dev/ui) are removed from production builds
    __DEV_BUILD__: JSON.stringify(command === 'serve'),
  },
  // Pre-bundle up front: Phosphor is only imported lazily (non-classic icon styles); found
  // at runtime, Vite would bundle it separately and React could load twice
  // ("Cannot read properties of null (reading 'useContext')").
  optimizeDeps: {
    include: ['@phosphor-icons/react'],
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
}));
