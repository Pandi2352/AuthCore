import { Monitor, Moon, Sun } from 'lucide-react';

import { useTheme } from '@/app/theme';
import { featuresConfig } from '@/config';
import { cn } from '@/lib/utils';
import type { ColorMode } from '@/types/theme.types';

const ORDER: readonly ColorMode[] = ['light', 'dark', 'system'];
const LABEL: Record<ColorMode, string> = { light: 'Light', dark: 'Dark', system: 'System' };
const ICON = { light: Sun, dark: Moon, system: Monitor } as const;

/** Navbar button: light → dark → system. Hidden when the project fixes the mode. */
export function ThemeToggle({ className }: { className?: string }) {
  const { mode, setMode, userCustomizable } = useTheme();
  if (!featuresConfig.ui.themeSwitcher || !userCustomizable.mode) return null;

  const next = ORDER[(ORDER.indexOf(mode) + 1) % ORDER.length] ?? 'light';
  const Icon = ICON[mode];
  const label = `Theme: ${LABEL[mode]} (switch to ${LABEL[next]})`;

  return (
    <button
      type="button"
      onClick={() => setMode(next)}
      className={cn(
        'inline-flex h-control-sm w-control-sm items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
        className,
      )}
      title={label}
      aria-label={label}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}
