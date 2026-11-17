import type {
  AppearanceOption,
  ColorMode,
  ResolvedColorMode,
  ThemePresetId,
  ThemeState,
} from '../../types/theme.types.ts';

/**
 * Pure theme logic shared by the React provider and the no-flash inline script in
 * index.html. `resolveThemeState` and `applyThemeToElement` are serialized with
 * Function#toString() into that script, so they must stay self-contained:
 * no imports, no outer variables, no helpers defined outside their bodies.
 */
export interface ThemeRuntimeOptions {
  /** localStorage key, `<slug>:theme:v1`. */
  storageKey: string;
  defaults: ThemeState;
  customizable: {
    mode: boolean;
    preset: boolean;
    appearance: readonly AppearanceOption[];
  };
  allowed: {
    modes: readonly ColorMode[];
    presets: readonly ThemePresetId[];
    appearance: { readonly [K in AppearanceOption]: readonly string[] };
  };
  /** app.config.ts → branding.primaryColor (#rrggbb), used by the "brand" preset. */
  brandColor: string;
  /** app.config.ts → themeColor: browser UI color per resolved mode. */
  themeColor: { light: string; dark: string };
  /** Font id → CSS family + Google Fonts stylesheet (null = no download). config/fonts.ts */
  fonts: Record<string, { family: string; url: string | null }>;
}

/** Stored value → valid theme. Unknown or non-customizable values fall back to the defaults. */
export function resolveThemeState(stored: unknown, options: ThemeRuntimeOptions): ThemeState {
  const source = (stored !== null && typeof stored === 'object' ? stored : {}) as {
    mode?: unknown;
    preset?: unknown;
    appearance?: Record<string, unknown>;
  };
  const defaults = options.defaults;
  const mode =
    options.customizable.mode && options.allowed.modes.includes(source.mode as ColorMode)
      ? (source.mode as ColorMode)
      : defaults.mode;
  const preset =
    options.customizable.preset && options.allowed.presets.includes(source.preset as ThemePresetId)
      ? (source.preset as ThemePresetId)
      : defaults.preset;
  const appearance = { ...defaults.appearance };
  const storedAppearance =
    source.appearance !== null && typeof source.appearance === 'object' ? source.appearance : {};
  for (const key of options.customizable.appearance) {
    const value = storedAppearance[key];
    // customColor is free: any #rrggbb.
    if (key === 'customColor') {
      if (typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value))
        appearance.customColor = value;
      continue;
    }
    if (typeof value === 'string' && options.allowed.appearance[key].includes(value)) {
      (appearance as Record<string, string>)[key] = value;
    }
  }
  return { mode, preset, appearance };
}

/** Theme → data-* attributes, color-scheme, brand variables and theme-color meta on <html>. */
export function applyThemeToElement(
  root: HTMLElement,
  state: ThemeState,
  resolvedMode: ResolvedColorMode,
  options: ThemeRuntimeOptions,
): void {
  const look = state.appearance;
  const attributes: Record<string, string> = {
    'data-mode': resolvedMode,
    'data-preset': state.preset,
    'data-radius': look.radius,
    'data-density': look.density,
    'data-font': look.font,
    'data-shadow': look.shadows,
    'data-borders': look.borders,
    'data-sidebar': look.sidebar,
    'data-navbar': look.navbar,
    'data-cards': look.cards,
    'data-inputs': look.inputs,
    'data-buttons': look.buttons,
    'data-icons': look.icons,
    'data-contrast': look.contrast,
    'data-content': look.contentWidth,
    'data-sidebar-position': look.sidebarPosition,
    'data-striped': look.striped,
    'data-gradient': look.gradientButtons,
    'data-focus': look.strongFocus === 'on' ? 'strong' : 'standard',
    'data-motion': look.reduceMotion === 'on' ? 'reduce' : 'full',
  };
  for (const name of Object.keys(attributes)) {
    const value = attributes[name];
    if (value !== undefined && root.getAttribute(name) !== value) root.setAttribute(name, value);
  }
  root.style.colorScheme = resolvedMode;

  // Text size: the whole UI is rem-based, so scaling the root scales it (14 px = 100 %).
  const size = Number(look.fontSize) || 14;
  root.style.fontSize = size === 14 ? '' : `${(size / 14) * 100}%`;

  // Typeface: family variable + the font's stylesheet (Google Fonts) only when needed.
  const font = options.fonts[look.font] ?? options.fonts.system;
  if (font) {
    root.style.setProperty('--font-family-sans', font.family);
    const doc = root.ownerDocument;
    let link = doc.getElementById('theme-font') as HTMLLinkElement | null;
    if (font.url) {
      if (!link) {
        link = doc.createElement('link');
        link.id = 'theme-font';
        link.rel = 'stylesheet';
        doc.head.appendChild(link);
      }
      if (link.getAttribute('href') !== font.url) link.setAttribute('href', font.url);
    } else if (link) {
      link.remove();
    }
  }

  // Brand preset: the project color, darkened (light mode) or lightened (dark mode) just
  // enough to read as text on the page (WCAG 4.5:1), plus black or white text on top of it.
  // Keep in sync with brandVariant() in scripts/check-contrast.mjs.
  // The "custom" preset uses the user's own color the same way.
  const source =
    state.preset === 'custom' && /^#[0-9a-f]{6}$/i.test(look.customColor)
      ? look.customColor
      : options.brandColor;
  const hex = /^#([0-9a-f]{6})$/i.exec(source)?.[1] ?? '4f46e5';
  const base = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const lum = (rgb: number[]): number => {
    const lin = rgb.map((v) => {
      const c = v / 255;
      return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * (lin[0] ?? 0) + 0.7152 * (lin[1] ?? 0) + 0.0722 * (lin[2] ?? 0);
  };
  const ratio = (a: number, b: number): number => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  const pageLum = resolvedMode === 'dark' ? 0.012 : 0.96;
  const toward = resolvedMode === 'dark' ? 255 : 0;
  let rgb = base;
  for (let step = 1; step <= 25 && ratio(lum(rgb), pageLum) < 4.6; step++) {
    rgb = base.map((v) => Math.round(v + (toward - v) * step * 0.04));
  }
  const brandLum = lum(rgb);
  root.style.setProperty('--brand-color', `rgb(${rgb.join(' ')})`);
  root.style.setProperty(
    '--brand-foreground',
    ratio(brandLum, 1) >= ratio(brandLum, 0) ? '#ffffff' : '#0b0f19',
  );

  // Browser UI color follows the resolved mode, not only the OS preference.
  const metas = root.ownerDocument.querySelectorAll('meta[name="theme-color"]');
  for (const meta of Array.from(metas)) {
    meta.setAttribute('content', options.themeColor[resolvedMode]);
  }
}

/** Inline <script> for index.html: applies the stored theme before the first paint. */
export function buildNoFlashScript(options: ThemeRuntimeOptions): string {
  return [
    '(function(){try{',
    `var o=${JSON.stringify(options).replace(/</g, '\\u003c')};`,
    'var raw=null;try{raw=JSON.parse(window.localStorage.getItem(o.storageKey)||"null")}catch(e){}',
    `var s=(${resolveThemeState.toString()})(raw,o);`,
    'var h=new Date().getHours();',
    "var dark=s.mode==='dark'||(s.mode==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches)||(s.appearance.autoDark==='on'&&(h>=19||h<6));",
    `(${applyThemeToElement.toString()})(document.documentElement,s,dark?'dark':'light',o);`,
    '}catch(e){}})();',
  ].join('');
}
