import { Monitor, Moon, Sun } from 'lucide-react';
import { useState } from 'react';

import { useTheme } from '@/app/theme';
import { Input, Switch } from '@/components/ui';
import { appConfig, findThemePreset } from '@/config';
import { cn } from '@/lib/utils';
import type { ColorMode } from '@/types/theme.types';

import { MODE_LABEL } from './appearance-labels';
import { ChoiceCard, ChoiceGroup, SettingCard } from './AppearanceParts';
import { lockKeysOf } from './lock-groups';

const MODE_ICON = { light: Sun, dark: Moon, system: Monitor } as const;
const HEX = /^#[0-9a-f]{6}$/i;

export function ModeSection() {
  const { mode, resolvedMode, setMode, appearance, setAppearance } = useTheme();
  return (
    <SettingCard
      title="Mode"
      lockKeys={lockKeysOf('mode')}
      description="Light, dark, or follow your device."
      badge={mode === 'system' ? `System (${resolvedMode})` : MODE_LABEL[mode].title}
    >
      <ChoiceGroup legend="Color mode" columns={3}>
        {(Object.keys(MODE_LABEL) as ColorMode[]).map((value) => {
          const Icon = MODE_ICON[value];
          return (
            <ChoiceCard
              key={value}
              name="mode"
              value={value}
              checked={mode === value}
              onSelect={() => setMode(value)}
              preview={<Icon className="size-4 text-muted-foreground" />}
              title={MODE_LABEL[value].title}
              description={MODE_LABEL[value].description}
            />
          );
        })}
      </ChoiceGroup>
      <Switch
        label="Auto dark at night"
        hint="Switch to dark between 7 PM and 6 AM"
        checked={appearance.autoDark === 'on'}
        onCheckedChange={(on) => setAppearance({ autoDark: on ? 'on' : 'off' })}
      />
    </SettingCard>
  );
}

export function ColorSection() {
  const { preset, presets, resolvedMode, appearance, applyTheme, setPreset } = useTheme();
  const custom = HEX.test(appearance.customColor) ? appearance.customColor : '';
  const [draft, setDraft] = useState(custom || appConfig.branding.primaryColor);
  const [lastCustom, setLastCustom] = useState(custom);
  if (custom !== lastCustom) {
    setLastCustom(custom);
    if (custom) setDraft(custom);
  }
  const chips = presets.filter((id) => id !== 'custom');
  const applyCustom = (hex: string) => {
    setDraft(hex);
    if (HEX.test(hex))
      applyTheme({ preset: 'custom', appearance: { customColor: hex.toLowerCase() } });
  };

  return (
    <SettingCard
      title="Color"
      lockKeys={lockKeysOf('color')}
      description="Accent used for buttons, links and highlights."
      badge={findThemePreset(preset)?.label ?? preset}
    >
      <fieldset>
        <legend className="sr-only">Accent color</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {chips.map((id) => {
            const meta = findThemePreset(id);
            const checked = preset === id;
            return (
              <label
                key={id}
                className={cn(
                  'flex h-9 cursor-pointer items-center gap-2 rounded-md border px-2.5 text-sm transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring',
                  checked
                    ? 'border-primary bg-primary-soft font-medium text-primary-soft-foreground'
                    : 'border-border bg-surface text-foreground hover:bg-accent',
                )}
              >
                <input
                  type="radio"
                  name="accent"
                  value={id}
                  checked={checked}
                  onChange={() => setPreset(id)}
                  className="sr-only"
                />
                <span
                  aria-hidden="true"
                  className="size-3 shrink-0 rounded-full"
                  style={{ background: meta?.swatch[resolvedMode] }}
                />
                {meta?.label ?? id}
              </label>
            );
          })}
        </div>
      </fieldset>
      <div className="flex items-center gap-2 border-t border-border pt-4">
        <label htmlFor="custom-color" className="shrink-0 text-sm font-medium text-foreground">
          Custom color
        </label>
        <input
          id="custom-color"
          type="color"
          value={HEX.test(draft) ? draft : appConfig.branding.primaryColor}
          onChange={(e) => applyCustom(e.target.value)}
          className={cn(
            'h-9 w-11 shrink-0 cursor-pointer rounded-md border bg-surface p-1',
            preset === 'custom' ? 'border-primary' : 'border-border',
          )}
        />
        <Input
          aria-label="Custom color hex"
          value={draft}
          maxLength={7}
          onChange={(e) => applyCustom(e.target.value.trim())}
          invalid={Boolean(draft) && !HEX.test(draft)}
          className="font-mono"
          size="sm"
        />
      </div>
      {draft && !HEX.test(draft) && (
        <p className="-mt-2 text-xs text-danger">Use a 6-digit hex color (#rrggbb)</p>
      )}
    </SettingCard>
  );
}
