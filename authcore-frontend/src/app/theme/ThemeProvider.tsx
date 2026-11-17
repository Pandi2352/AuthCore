import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';

import { layoutConfig, themeConfig } from '@/config';
import { storage } from '@/lib/storage';
import type { Appearance, ColorMode, ThemePresetId, ThemeState } from '@/types/theme.types';

import { ThemeContext, type ThemeContextValue } from './theme-context';
import { applyThemeToElement, resolveThemeState } from './theme-core';
import { themeRuntimeOptions as options } from './theme-options';

const DARK_QUERY = '(prefers-color-scheme: dark)';

function subscribeToSystemMode(onChange: () => void): () => void {
  const query = window.matchMedia(DARK_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}
const getSystemIsDark = (): boolean => window.matchMedia(DARK_QUERY).matches;

/** Only what users may change is stored; the rest always follows theme.config.ts. */
function toStored(state: ThemeState) {
  const { customizable } = options;
  return {
    ...(customizable.mode ? { mode: state.mode } : {}),
    ...(customizable.preset ? { preset: state.preset } : {}),
    appearance: Object.fromEntries(
      customizable.appearance.map((key) => [key, state.appearance[key]]),
    ),
  };
}

/**
 * Applies a theme change in one frame. Many elements have `transition-colors` (hover
 * effects); without this they would fade to the new colors one by one. Transitions are
 * switched off, the new theme applied and styles flushed, then transitions come back on
 * the next frame — hover / open animations keep working.
 */
function withoutTransitions(apply: () => void): void {
  const style = document.createElement('style');
  style.textContent = '*,*::before,*::after{transition:none!important}';
  document.head.append(style);
  apply();
  // Force the new styles to be computed while transitions are off.
  void window.getComputedStyle(document.body).backgroundColor;
  requestAnimationFrame(() => requestAnimationFrame(() => style.remove()));
}

const sameTheme = (a: ThemeState, b: ThemeState): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

/** Layout sizes from layout.config.ts as CSS variables (static per build). */
function applyLayoutTokens(root: HTMLElement): void {
  const maxWidth = { full: 'none', container: '80rem', narrow: '48rem' }[
    layoutConfig.content.maxWidth
  ];
  root.style.setProperty('--sidebar-width', `${layoutConfig.sidebar.width}px`);
  root.style.setProperty('--sidebar-width-collapsed', `${layoutConfig.sidebar.collapsedWidth}px`);
  root.style.setProperty('--navbar-height', `${layoutConfig.navbar.height}px`);
  root.style.setProperty('--content-max-width', maxWidth);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeState>(() =>
    resolveThemeState(storage.read(options.storageKey), options),
  );
  const systemIsDark = useSyncExternalStore(subscribeToSystemMode, getSystemIsDark, () => false);
  const resolvedMode = theme.mode === 'system' ? (systemIsDark ? 'dark' : 'light') : theme.mode;

  // Before paint, so a change never flashes the old theme. The first run only syncs what
  // the no-flash script already applied; later changes switch instantly (no color fades).
  const firstApply = useRef(true);
  useLayoutEffect(() => {
    const apply = () => applyThemeToElement(document.documentElement, theme, resolvedMode, options);
    if (firstApply.current) {
      firstApply.current = false;
      apply();
    } else {
      withoutTransitions(apply);
    }
  }, [theme, resolvedMode]);

  useLayoutEffect(() => {
    applyLayoutTokens(document.documentElement);
  }, []);

  // Other tabs: follow their changes.
  useEffect(
    () =>
      storage.subscribe(options.storageKey, (value) => {
        const next = resolveThemeState(value, options);
        setTheme((current) => (sameTheme(current, next) ? current : next));
      }),
    [],
  );

  const update = useCallback((change: (current: ThemeState) => ThemeState) => {
    setTheme((current) => {
      const next = change(current);
      if (sameTheme(current, next)) return current;
      storage.write(options.storageKey, toStored(next));
      return next;
    });
  }, []);

  const setMode = useCallback(
    (mode: ColorMode) => {
      if (options.customizable.mode) update((current) => ({ ...current, mode }));
    },
    [update],
  );

  const setPreset = useCallback(
    (preset: ThemePresetId) => {
      if (options.customizable.preset && options.allowed.presets.includes(preset)) {
        update((current) => ({ ...current, preset }));
      }
    },
    [update],
  );

  const setAppearance = useCallback(
    (changes: Partial<Appearance>) => {
      const allowed = Object.fromEntries(
        Object.entries(changes).filter(([key]) =>
          options.customizable.appearance.includes(key as keyof Appearance),
        ),
      ) as Partial<Appearance>;
      update((current) => ({ ...current, appearance: { ...current.appearance, ...allowed } }));
    },
    [update],
  );

  const reset = useCallback(() => {
    storage.remove(options.storageKey);
    setTheme(options.defaults);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      ...theme,
      resolvedMode,
      userCustomizable: themeConfig.userCustomizable,
      presets: options.allowed.presets,
      setMode,
      setPreset,
      setAppearance,
      reset,
      isCustomized: !sameTheme(theme, options.defaults),
    }),
    [theme, resolvedMode, setMode, setPreset, setAppearance, reset],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
