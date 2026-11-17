import { useTheme } from '@/app/theme';
import { findThemePreset } from '@/config';
import { fontById } from '@/config/fonts';

import {
  CONTRAST_LABEL,
  DENSITY_LABEL,
  ICON_LABEL,
  MODE_LABEL,
  NAVBAR_LABEL,
  POSITION_LABEL,
  RADIUS_LABEL,
  SHADOW_LABEL,
  SIDEBAR_LABEL,
  WIDTH_LABEL,
} from './appearance-labels';
import { SettingCard } from './AppearanceParts';
import { useActiveQuickPreset } from './quick-preset-state';

/** Everything currently selected, in one list. */
export function ConfigSummary() {
  const { mode, resolvedMode, preset, appearance: a } = useTheme();
  const active = useActiveQuickPreset();
  const prefs = [
    a.striped === 'on' && 'Striped rows',
    a.gradientButtons === 'on' && 'Gradient buttons',
    a.strongFocus === 'on' && 'Strong focus',
    a.reduceMotion === 'on' && 'Reduced motion',
    a.tooltips === 'off' && 'No tooltips',
    a.autoDark === 'on' && 'Auto dark',
  ].filter(Boolean);
  const rows: Array<[string, string]> = [
    ['Mode', mode === 'system' ? `System (${resolvedMode})` : MODE_LABEL[mode].title],
    [
      'Accent',
      preset === 'custom' ? `Custom ${a.customColor}` : (findThemePreset(preset)?.label ?? preset),
    ],
    ['Corner radius', RADIUS_LABEL[a.radius].title],
    ['Density', DENSITY_LABEL[a.density].title],
    [
      'Sidebar',
      `${SIDEBAR_LABEL[a.sidebar].title} · ${POSITION_LABEL[a.sidebarPosition].title.toLowerCase()}`,
    ],
    ['Navbar', NAVBAR_LABEL[a.navbar].title],
    ['Icons', ICON_LABEL[a.icons].title],
    ['Typeface', fontById(a.font).label],
    ['Text size', `${a.fontSize} px`],
    ['Contrast', CONTRAST_LABEL[a.contrast].title],
    ['Card shadows', SHADOW_LABEL[a.shadows].title],
    ['Content width', WIDTH_LABEL[a.contentWidth].title],
    ['Preferences', prefs.length ? prefs.join(', ') : 'Defaults'],
  ];
  return (
    <SettingCard
      title="Your configuration"
      description="A summary of everything currently selected."
      badge={active?.label ?? 'Custom'}
    >
      <dl className="divide-y divide-border text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-4 py-2">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="text-right font-medium text-foreground">{value}</dd>
          </div>
        ))}
      </dl>
    </SettingCard>
  );
}
