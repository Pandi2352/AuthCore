import { useTheme } from '@/app/theme';
import { Switch } from '@/components/ui';
import type { Appearance } from '@/types/theme.types';

import { CONTRAST_LABEL, entries, SHADOW_LABEL, WIDTH_LABEL } from './appearance-labels';
import { ChoiceCard, ChoiceGroup, SettingCard } from './AppearanceParts';

export function EffectsSection() {
  const { appearance, setAppearance } = useTheme();
  return (
    <SettingCard
      title="Contrast & effects"
      description="Borders, depth and content width."
      className="@3xl:col-span-2"
      badge={CONTRAST_LABEL[appearance.contrast].title}
    >
      <ChoiceGroup legend="Contrast" showLegend>
        {entries(CONTRAST_LABEL).map(([value, label]) => (
          <ChoiceCard
            key={value}
            name="contrast"
            value={value}
            checked={appearance.contrast === value}
            onSelect={() => setAppearance({ contrast: value })}
            title={label.title}
            description={label.description}
          />
        ))}
      </ChoiceGroup>
      <ChoiceGroup legend="Card shadows" showLegend columns={3}>
        {entries(SHADOW_LABEL).map(([value, label]) => (
          <ChoiceCard
            key={value}
            name="shadows"
            value={value}
            checked={appearance.shadows === value}
            onSelect={() => setAppearance({ shadows: value })}
            title={label.title}
            description={label.description}
          />
        ))}
      </ChoiceGroup>
      <ChoiceGroup legend="Content width" showLegend columns={3}>
        {entries(WIDTH_LABEL).map(([value, label]) => (
          <ChoiceCard
            key={value}
            name="content-width"
            value={value}
            checked={appearance.contentWidth === value}
            onSelect={() => setAppearance({ contentWidth: value })}
            title={label.title}
            description={label.description}
          />
        ))}
      </ChoiceGroup>
    </SettingCard>
  );
}

type ToggleKey = 'striped' | 'gradientButtons' | 'strongFocus' | 'reduceMotion' | 'tooltips';
const PREFERENCES: ReadonlyArray<{ key: ToggleKey; label: string; hint: string }> = [
  { key: 'striped', label: 'Striped table rows', hint: 'Easier scanning of long tables' },
  { key: 'gradientButtons', label: 'Gradient buttons', hint: 'Subtle gradient on primary actions' },
  { key: 'strongFocus', label: 'Stronger focus ring', hint: 'Thicker outline for keyboard users' },
  { key: 'reduceMotion', label: 'Reduce motion', hint: 'Turn off transitions and animations' },
  { key: 'tooltips', label: 'Tooltips', hint: 'Hover hints on icon-only buttons' },
];

export function PreferencesSection() {
  const { appearance, setAppearance } = useTheme();
  const onCount = PREFERENCES.filter((p) => appearance[p.key] === 'on').length;
  const set = (key: ToggleKey, on: boolean) =>
    setAppearance({ [key]: on ? 'on' : 'off' } as Partial<Appearance>);
  return (
    <SettingCard
      title="Preferences"
      description="Comfort, accessibility and sync options."
      className="@3xl:col-span-2"
      badge={`${onCount} on`}
    >
      <div className="grid gap-x-8 gap-y-1 @3xl:grid-cols-2">
        {PREFERENCES.map((p) => (
          <div key={p.key} className="border-b border-border py-3">
            <Switch
              label={p.label}
              hint={p.hint}
              checked={appearance[p.key] === 'on'}
              onCheckedChange={(on) => set(p.key, on)}
            />
          </div>
        ))}
        <div className="border-b border-border py-3">
          {/* Needs an "appearance" field in the account preferences API (backend). */}
          <Switch
            label="Sync across devices"
            hint="Available once account sync is enabled — saved in this browser for now"
            checked={false}
            disabled
          />
        </div>
      </div>
    </SettingCard>
  );
}
