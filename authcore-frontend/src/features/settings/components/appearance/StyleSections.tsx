import { ChartBarIcon, HouseIcon, UserIcon } from '@phosphor-icons/react';
import { BarChart3, House, UserRound } from 'lucide-react';
import { useEffect } from 'react';

import { useTheme } from '@/app/theme';
import { Button, Select } from '@/components/ui';
import { FEATURED_FONTS, fontById, FONTS, googleFontUrl } from '@/config/fonts';
import { cn } from '@/lib/utils';
import type { IconStyle, TextSize } from '@/types/theme.types';

import { entries, ICON_LABEL } from './appearance-labels';
import { ChoiceCard, ChoiceGroup, SettingCard } from './AppearanceParts';
import { lockKeysOf } from './lock-groups';

function IconPreview({ style }: { style: IconStyle }) {
  if (style === 'classic') {
    return (
      <span className="flex gap-2 text-muted-foreground [&_svg]:size-4.5">
        <House />
        <BarChart3 />
        <UserRound />
      </span>
    );
  }
  const weight = style === 'modern' ? 'regular' : 'duotone';
  const tint =
    style === 'duotone'
      ? 'text-foreground [&_[opacity]]:fill-primary [&_[opacity]]:opacity-35'
      : '';
  return (
    <span className={cn('flex gap-2', style === 'modern' && 'text-foreground', tint)}>
      <HouseIcon size={18} weight={weight} className={cn(style === 'color' && 'text-nav-blue')} />
      <ChartBarIcon
        size={18}
        weight={weight}
        className={cn(style === 'color' && 'text-nav-violet')}
      />
      <UserIcon size={18} weight={weight} className={cn(style === 'color' && 'text-nav-emerald')} />
    </span>
  );
}

export function IconSection() {
  const { appearance, setAppearance } = useTheme();
  return (
    <SettingCard
      title="Icon style"
      lockKeys={lockKeysOf('icons')}
      description="How navigation icons are drawn."
      badge={ICON_LABEL[appearance.icons].title}
    >
      <ChoiceGroup legend="Icon style">
        {entries(ICON_LABEL).map(([value, label]) => (
          <ChoiceCard
            key={value}
            name="icons"
            value={value}
            checked={appearance.icons === value}
            onSelect={() => setAppearance({ icons: value })}
            preview={<IconPreview style={value} />}
            title={label.title}
            description={label.description}
          />
        ))}
      </ChoiceGroup>
    </SettingCard>
  );
}

export function TypographySection() {
  const { appearance, setAppearance } = useTheme();
  const current = fontById(appearance.font);
  const size = Number(appearance.fontSize);
  const moreFonts = FONTS.filter((f) => !FEATURED_FONTS.includes(f.id) && f.id !== 'custom');

  // Load the featured faces so each card previews its own font (this page only).
  useEffect(() => {
    for (const id of FEATURED_FONTS) {
      const url = googleFontUrl(fontById(id));
      const linkId = `font-preview-${id}`;
      if (!url || document.getElementById(linkId)) continue;
      const link = document.createElement('link');
      link.id = linkId;
      link.rel = 'stylesheet';
      link.href = url;
      document.head.appendChild(link);
    }
  }, []);

  const setSize = (next: number) => {
    const clamped = String(Math.min(18, Math.max(13, next))) as TextSize;
    setAppearance({ fontSize: clamped });
  };

  return (
    <SettingCard
      title="Typography"
      lockKeys={lockKeysOf('typography')}
      description="Typeface and base text size."
      badge={`${current.label} · ${size} px`}
    >
      <ChoiceGroup legend="Typeface">
        {FEATURED_FONTS.map((id) => {
          const font = fontById(id);
          return (
            <ChoiceCard
              key={id}
              name="font"
              value={id}
              checked={appearance.font === id}
              onSelect={() => setAppearance({ font: id })}
              preview={
                <span
                  className="text-xl font-semibold text-foreground"
                  style={{ fontFamily: font.family }}
                >
                  Aa
                </span>
              }
              title={font.label}
              description={font.note}
            />
          );
        })}
      </ChoiceGroup>
      <Select
        aria-label={`More fonts (${moreFonts.length})`}
        placeholder={`More fonts (${moreFonts.length})…`}
        value={FEATURED_FONTS.includes(appearance.font) ? null : appearance.font}
        onValueChange={(value) => value && setAppearance({ font: value as typeof appearance.font })}
        options={moreFonts.map((f) => ({ value: f.id, label: f.label, description: f.note }))}
      />
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          aria-label="Smaller text"
          disabled={size <= 13}
          onClick={() => setSize(size - 1)}
        >
          A−
        </Button>
        <input
          type="range"
          min={13}
          max={18}
          step={1}
          value={size}
          aria-label="Text size"
          aria-valuetext={`${size} pixels`}
          onChange={(e) => setSize(Number(e.target.value))}
          className="h-2 min-w-0 flex-1 cursor-pointer accent-primary"
        />
        <Button
          variant="outline"
          size="sm"
          aria-label="Larger text"
          disabled={size >= 18}
          onClick={() => setSize(size + 1)}
        >
          A+
        </Button>
      </div>
      <p className="rounded-md bg-muted px-3 py-3 text-sm text-foreground">
        The quick brown fox jumps over the lazy dog. 0123456789
      </p>
    </SettingCard>
  );
}
