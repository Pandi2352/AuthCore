import { Monitor, Moon, Sun } from 'lucide-react';

import { useOptionalTheme } from '@/app/theme';
import { IconButton } from '@/components/ui';
import { featuresConfig } from '@/config';
import type { ColorMode } from '@/types/theme.types';

const ORDER: readonly ColorMode[] = ['light', 'dark', 'system'];
const LABEL: Record<ColorMode, string> = { light: 'Light', dark: 'Dark', system: 'System' };
const ICON = { light: Sun, dark: Moon, system: Monitor } as const;

/** Light → dark → system. Hidden when the project fixes the mode or the flag is off. */
export function ThemeToggle({ className }: { className?: string }) {
  const theme = useOptionalTheme();
  if (!theme || !featuresConfig.ui.themeSwitcher || !theme.userCustomizable.mode) return null;
  const { mode, setMode } = theme;
  const next = ORDER[(ORDER.indexOf(mode) + 1) % ORDER.length] ?? 'light';
  const Icon = ICON[mode];
  return (
    <IconButton
      className={className}
      aria-label={`Theme: ${LABEL[mode]} (switch to ${LABEL[next]})`}
      icon={<Icon />}
      onClick={() => setMode(next)}
    />
  );
}
