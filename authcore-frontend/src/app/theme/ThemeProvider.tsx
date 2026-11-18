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
import {
  APPEARANCE_VALUES,
  type Appearance,
  type ColorMode,
  type ThemePresetId,
  type ThemeState,
} from '@/types/theme.types';

import { ThemeContext, type ThemeContextValue } from './theme-context';
import {
  applyThemeToElement,
  resolveThemeState,
  withOrganization,
  type OrganizationAppearance,
} from './theme-core';
import { themeRuntimeOptions as baseOptions } from './theme-options';

const DARK_QUERY = '(prefers-color-scheme: dark)';

function subscribeToSystemMode(onChange: () => void): () => void {
  const query = window.matchMedia(DARK_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}
const getSystemIsDark = (): boolean => window.matchMedia(DARK_QUERY).matches;

/** "Auto dark at night": 7 PM – 6 AM (checked every minute). Same rule as the no-flash script. */
const isNightNow = (): boolean => {
  const hour = new Date().getHours();
  return hour >= 19 || hour < 6;
};
function subscribeToClock(onChange: () => void): () => void {
  const timer = window.setInterval(onChange, 60_000);
  return () => window.clearInterval(timer);
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
  root.style.setProperty('--sidebar-width', `${layoutConfig.sidebar.width}px`);
  root.style.setProperty('--sidebar-width-collapsed', `${layoutConfig.sidebar.collapsedWidth}px`);
  root.style.setProperty('--navbar-height-base', `${layoutConfig.navbar.height}px`);
}

/** Everything except the personal light / dark choice follows the application look. */
const LOCKED_FOR_EVERYONE = ['preset', ...Object.keys(APPEARANCE_VALUES)];

/** The application look as cached: the locks make it apply to everyone (also before paint). */
const toCached = (look: OrganizationAppearance | null): OrganizationAppearance => ({
  ...look,
  locked: LOCKED_FOR_EVERYONE,
});

const readLook = (): OrganizationAppearance | null => {
  const value = storage.read(baseOptions.orgStorageKey);
  if (value === null || typeof value !== 'object') return null;
  const { locked: _locked, ...look } = value as OrganizationAppearance;
  return Object.keys(look).length ? look : null;
};

const lookOf = (state: ThemeState): OrganizationAppearance => ({
  mode: state.mode,
  preset: state.preset,
  appearance: { ...state.appearance },
});

const pickAppearance = (changes: Partial<Appearance>): Partial<Appearance> =>
  Object.fromEntries(
    Object.entries(changes).filter(([key]) =>
      baseOptions.customizable.appearance.includes(key as keyof Appearance),
    ),
  ) as Partial<Appearance>;

/**
 * One application look for everyone (Settings → Appearance, super admin; stored on the
 * server, cached in localStorage and applied before the first paint). Each person only keeps
 * their own light / dark choice (`setMode`). With `canEdit` (set by the app from the user's
 * permissions) the look setters change the application look; AppearanceSync saves it.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [look, setLook] = useState<OrganizationAppearance | null>(readLook);
  const [canEdit, setCanEdit] = useState(false);
  const options = useMemo(() => withOrganization(baseOptions, toCached(look)), [look]);
  const [theme, setTheme] = useState<ThemeState>(() =>
    resolveThemeState(storage.read(baseOptions.storageKey), options),
  );
  // A new look re-resolves the theme (the personal mode stays).
  const [appliedOptions, setAppliedOptions] = useState(options);
  if (appliedOptions !== options) {
    setAppliedOptions(options);
    setTheme(resolveThemeState(storage.read(options.storageKey), options));
  }

  const systemIsDark = useSyncExternalStore(subscribeToSystemMode, getSystemIsDark, () => false);
  const isNight = useSyncExternalStore(subscribeToClock, isNightNow, () => false);
  const baseMode = theme.mode === 'system' ? (systemIsDark ? 'dark' : 'light') : theme.mode;
  const resolvedMode =
    theme.appearance.autoDark === 'on' && isNight && baseMode === 'light' ? 'dark' : baseMode;

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
  }, [theme, resolvedMode, options]);

  useLayoutEffect(() => {
    applyLayoutTokens(document.documentElement);
    // The cache always carries the locks (also before the first API answer).
    storage.write(baseOptions.orgStorageKey, toCached(readLook()));
  }, []);

  // Other tabs: their personal mode and the cached look.
  useEffect(() => {
    const offMode = storage.subscribe(baseOptions.storageKey, () => {
      setTheme((current) => {
        const next = resolveThemeState(storage.read(baseOptions.storageKey), options);
        return sameTheme(current, next) ? current : next;
      });
    });
    const offLook = storage.subscribe(baseOptions.orgStorageKey, () => setLook(readLook()));
    return () => {
      offMode();
      offLook();
    };
  }, [options]);

  /** Personal light / dark / system (navbar toggle, user menu, command menu). */
  const setMode = useCallback((mode: ColorMode) => {
    if (!baseOptions.customizable.mode || !baseOptions.allowed.modes.includes(mode)) return;
    storage.write(baseOptions.storageKey, { mode });
    setTheme((current) => (current.mode === mode ? current : { ...current, mode }));
  }, []);

  /** Change the application look (editors only); `resetMode` drops the personal mode. */
  const editLook = useCallback(
    (change: (current: ThemeState) => ThemeState, resetMode = false) => {
      if (!canEdit) return;
      const current = options.defaults;
      const next = change(current);
      if (resetMode) storage.remove(baseOptions.storageKey);
      if (sameTheme(current, next)) {
        if (resetMode) setTheme(resolveThemeState(null, options));
        return;
      }
      const nextLook = lookOf(next);
      storage.write(baseOptions.orgStorageKey, toCached(nextLook));
      setLook(nextLook);
    },
    [canEdit, options],
  );

  /** Everyone's default mode (Appearance page). */
  const setDefaultMode = useCallback(
    (mode: ColorMode) => editLook((current) => ({ ...current, mode }), true),
    [editLook],
  );

  const setPreset = useCallback(
    (preset: ThemePresetId) => {
      if (!baseOptions.allowed.presets.includes(preset)) return;
      editLook((current) => ({ ...current, preset }));
    },
    [editLook],
  );

  const setAppearance = useCallback(
    (changes: Partial<Appearance>) =>
      editLook((current) => ({
        ...current,
        appearance: { ...current.appearance, ...pickAppearance(changes) },
      })),
    [editLook],
  );

  /** Several changes at once (quick presets): one edit, one save. */
  const applyTheme = useCallback(
    (changes: { mode?: ColorMode; preset?: ThemePresetId; appearance?: Partial<Appearance> }) =>
      editLook(
        (current) => ({
          mode: changes.mode ?? current.mode,
          preset:
            changes.preset && baseOptions.allowed.presets.includes(changes.preset)
              ? changes.preset
              : current.preset,
          appearance: { ...current.appearance, ...pickAppearance(changes.appearance ?? {}) },
        }),
        Boolean(changes.mode),
      ),
    [editLook],
  );

  /** Back to the built-in defaults (theme.config.ts) for everyone. */
  const reset = useCallback(() => editLook(() => baseOptions.defaults, true), [editLook]);

  /** The look from the server (AppearanceSync); null = never saved. */
  const setOrganization = useCallback((next: OrganizationAppearance | null) => {
    const clean = next ? lookOf(withOrganization(baseOptions, next).defaults) : null;
    storage.write(baseOptions.orgStorageKey, toCached(clean));
    setLook((current) => (JSON.stringify(current) === JSON.stringify(clean) ? current : clean));
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      ...theme,
      resolvedMode,
      userCustomizable: themeConfig.userCustomizable,
      presets: baseOptions.allowed.presets,
      setMode,
      setDefaultMode,
      setPreset,
      setAppearance,
      applyTheme,
      reset,
      isCustomized: !sameTheme(options.defaults, baseOptions.defaults),
      organization: look,
      defaultMode: options.defaults.mode,
      canEdit,
      setCanEdit,
      setOrganization,
    }),
    [
      theme,
      resolvedMode,
      setMode,
      setDefaultMode,
      setPreset,
      setAppearance,
      applyTheme,
      reset,
      options,
      look,
      canEdit,
      setOrganization,
    ],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
