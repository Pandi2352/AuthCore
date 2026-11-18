import { useState, useSyncExternalStore } from 'react';

import { useTheme } from '@/app/theme';
import { notifyError, notifySuccess } from '@/components/feedback';
import { Switch } from '@/components/ui';
import type { Appearance } from '@/types/theme.types';

import { appearanceApi } from '../../api/appearance.api';
import { appearanceSyncStore, themeValues } from '../../appearance-sync';
import { CONTRAST_LABEL, entries, SHADOW_LABEL, WIDTH_LABEL } from './appearance-labels';
import { ChoiceCard, ChoiceGroup, SettingCard } from './AppearanceParts';
import { lockKeysOf } from './lock-groups';

export function EffectsSection() {
  const { appearance, setAppearance } = useTheme();
  return (
    <SettingCard
      title="Contrast & effects"
      lockKeys={lockKeysOf('effects')}
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
  const theme = useTheme();
  const { appearance, setAppearance, isLocked } = theme;
  const sync = useSyncExternalStore(appearanceSyncStore.subscribe, appearanceSyncStore.get);
  const [isSaving, setIsSaving] = useState(false);
  const prefsLocked = lockKeysOf('preferences').every((key) => isLocked(key));
  const onCount = PREFERENCES.filter((p) => appearance[p.key] === 'on').length;
  const set = (key: ToggleKey, on: boolean) =>
    setAppearance({ [key]: on ? 'on' : 'off' } as Partial<Appearance>);

  // On: this look is saved to the account (and pulled on other devices). Off: removed there.
  const toggleSync = async (enabled: boolean) => {
    setIsSaving(true);
    try {
      const saved = await appearanceApi.updateMine({
        syncEnabled: enabled,
        theme: enabled && theme.isCustomized ? themeValues(theme) : null,
      });
      appearanceSyncStore.set({ syncEnabled: saved.syncEnabled, lastSyncedAt: saved.updatedAt });
      notifySuccess(enabled ? 'Sync turned on' : 'Sync turned off', {
        description: enabled
          ? 'This look follows you to every device you sign in on.'
          : 'This look now stays in this browser only.',
      });
    } catch (err) {
      notifyError(err, 'Could not change syncing');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SettingCard
      title="Preferences"
      description="Comfort, accessibility and sync options."
      className="@3xl:col-span-2"
      badge={prefsLocked ? undefined : `${onCount} on`}
    >
      <div className="grid gap-x-8 gap-y-1 @3xl:grid-cols-2">
        {PREFERENCES.map((p) => (
          <div key={p.key} className="border-b border-border py-3">
            <Switch
              label={p.label}
              hint={prefsLocked ? 'Set by your organization' : p.hint}
              checked={appearance[p.key] === 'on'}
              disabled={prefsLocked}
              onCheckedChange={(on) => set(p.key, on)}
            />
          </div>
        ))}
        <div className="border-b border-border py-3">
          <Switch
            label="Sync across devices"
            hint={
              sync.isAvailable
                ? sync.syncEnabled
                  ? 'Saved to your account: the same look on every device'
                  : 'Off: this look stays in this browser'
                : 'Sign in to sync your look across devices'
            }
            checked={sync.isAvailable && sync.syncEnabled}
            disabled={!sync.isAvailable || isSaving}
            onCheckedChange={(on) => void toggleSync(on)}
          />
        </div>
      </div>
    </SettingCard>
  );
}
