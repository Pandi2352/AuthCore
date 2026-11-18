import { useTheme } from '@/app/theme';
import { themeConfig } from '@/config';
import { QUICK_PRESETS, type QuickPreset } from '@/config/appearance-presets';
import type { ThemeState } from '@/types/theme.types';

/** Full theme a quick preset produces: project defaults + the preset's changes. */
export const presetTarget = (preset: QuickPreset): ThemeState => ({
  mode: preset.changes.mode ?? themeConfig.defaults.mode,
  preset: preset.changes.preset ?? themeConfig.defaults.preset,
  appearance: { ...themeConfig.defaults.appearance, ...preset.changes.appearance },
});

const sameTheme = (a: ThemeState, b: ThemeState) =>
  a.mode === b.mode &&
  a.preset === b.preset &&
  (Object.keys(a.appearance) as Array<keyof ThemeState['appearance']>).every(
    (key) => a.appearance[key] === b.appearance[key],
  );

/** The quick preset matching the current theme exactly, if any. */
export function useActiveQuickPreset(): QuickPreset | undefined {
  const { defaultMode: mode, preset, appearance } = useTheme();
  return QUICK_PRESETS.find((p) => sameTheme(presetTarget(p), { mode, preset, appearance }));
}
