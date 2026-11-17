import { Monitor, Moon, RotateCcw, Sun } from 'lucide-react';
import type { ReactNode } from 'react';

import { useTheme } from '@/app/theme';
import { findThemePreset } from '@/config';
import { capitalize, cn } from '@/lib/utils';
import { APPEARANCE_VALUES, type AppearanceOption, type ColorMode } from '@/types/theme.types';

const MODES: { value: ColorMode; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

const OPTION_LABEL: Record<AppearanceOption, string> = {
  radius: 'Corner radius',
  density: 'Density',
  font: 'Font',
  shadows: 'Shadows',
  borders: 'Borders',
  sidebar: 'Sidebar style',
  navbar: 'Navbar style',
  cards: 'Card style',
  inputs: 'Input style',
  buttons: 'Button style',
  icons: 'Icon style',
  fontSize: 'Text size',
  contrast: 'Contrast',
  contentWidth: 'Content width',
  sidebarPosition: 'Sidebar position',
  navbarSearch: 'Search bar',
  breadcrumbs: 'Breadcrumbs',
  striped: 'Striped rows',
  gradientButtons: 'Gradient buttons',
  strongFocus: 'Stronger focus ring',
  reduceMotion: 'Reduce motion',
  tooltips: 'Tooltips',
  autoDark: 'Auto dark at night',
  customColor: 'Custom color',
};

/** A native radio group: arrow keys move between choices, the legend names the group. */
function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-foreground">{title}</legend>
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

function Choice({
  name,
  checked,
  onSelect,
  title,
  children,
}: {
  name: string;
  checked: boolean;
  onSelect: () => void;
  title?: string;
  children: ReactNode;
}) {
  return (
    <label
      title={title}
      className={cn(
        'inline-flex h-control-sm cursor-pointer items-center gap-2 rounded-md border px-3 text-sm transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring',
        checked
          ? 'border-primary bg-primary-soft text-primary-soft-foreground'
          : 'border-border bg-surface text-foreground hover:bg-accent',
      )}
    >
      <input type="radio" name={name} checked={checked} onChange={onSelect} className="sr-only" />
      {children}
    </label>
  );
}

/**
 * Mode, color preset and appearance pickers. Shows only what theme.config.ts →
 * userCustomizable allows; changes apply instantly and are remembered in this browser.
 */
export function ThemeCustomizer() {
  const {
    mode,
    preset,
    appearance,
    resolvedMode,
    presets,
    userCustomizable,
    setMode,
    setPreset,
    setAppearance,
    reset,
    isCustomized,
  } = useTheme();

  const hasAnything =
    userCustomizable.mode || userCustomizable.preset || userCustomizable.appearance.length > 0;
  if (!hasAnything) {
    return (
      <p className="text-sm text-muted-foreground">The theme is fixed for this application.</p>
    );
  }

  return (
    <div className="space-y-6">
      {userCustomizable.mode && (
        <Group title="Mode">
          {MODES.map(({ value, label, icon: Icon }) => (
            <Choice
              key={value}
              name="theme-mode"
              checked={mode === value}
              onSelect={() => setMode(value)}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {label}
            </Choice>
          ))}
        </Group>
      )}

      {userCustomizable.preset && presets.length > 1 && (
        <Group title="Color">
          {presets.map((id) => {
            const info = findThemePreset(id);
            return (
              <Choice
                key={id}
                name="theme-preset"
                checked={preset === id}
                onSelect={() => setPreset(id)}
                title={info?.description}
              >
                <span
                  className="h-4 w-4 rounded-full border border-border"
                  style={{ background: info?.swatch[resolvedMode] }}
                  aria-hidden="true"
                />
                {info?.label ?? id}
              </Choice>
            );
          })}
        </Group>
      )}

      {userCustomizable.appearance
        // Free values (custom color) have their own picker on the Appearance page.
        .filter((option) => APPEARANCE_VALUES[option].length > 1)
        .map((option) => (
          <Group key={option} title={OPTION_LABEL[option]}>
            {APPEARANCE_VALUES[option].map((value) => (
              <Choice
                key={value}
                name={`theme-${option}`}
                checked={appearance[option] === value}
                onSelect={() => setAppearance({ [option]: value })}
              >
                {capitalize(value)}
              </Choice>
            ))}
          </Group>
        ))}

      <button
        type="button"
        onClick={reset}
        disabled={!isCustomized}
        className="inline-flex items-center gap-2 rounded-md text-sm font-medium text-primary hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline"
      >
        <RotateCcw className="h-4 w-4" aria-hidden="true" />
        Reset to default
      </button>
    </div>
  );
}
