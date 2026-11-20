import {
  Accessibility,
  AppWindow,
  Building2,
  ClipboardList,
  Contrast,
  Eye,
  Image as ImageIcon,
  Lightbulb,
  Palette,
  PanelLeft,
  PanelTop,
  Rows3,
  Settings2,
  Shapes,
  SlidersHorizontal,
  Sparkles,
  Square,
  SunMoon,
  Type,
  UploadCloud,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';

import { SectionCard, type SectionTone } from '@/components/common/SectionCard';
import { Badge } from '@/components/ui';
import { cn } from '@/lib/utils';

/** Each settings card's color and icon (by title), so every settings page reads the same way. */
const CARD_LOOK: Record<string, { tone: SectionTone; icon: LucideIcon }> = {
  'Site identity': { tone: 'primary', icon: Building2 },
  Logos: { tone: 'violet', icon: ImageIcon },
  Favicon: { tone: 'cyan', icon: AppWindow },
  'Try an upload': { tone: 'success', icon: UploadCloud },
  'How it works': { tone: 'info', icon: Lightbulb },
  'Quick presets': { tone: 'primary', icon: Sparkles },
  Mode: { tone: 'violet', icon: SunMoon },
  Color: { tone: 'danger', icon: Palette },
  Typography: { tone: 'info', icon: Type },
  'Icon style': { tone: 'cyan', icon: Shapes },
  'Corner radius': { tone: 'warning', icon: Square },
  Density: { tone: 'success', icon: Rows3 },
  'Sidebar style': { tone: 'violet', icon: PanelLeft },
  'Navbar style': { tone: 'info', icon: PanelTop },
  'Contrast & effects': { tone: 'warning', icon: Contrast },
  Preferences: { tone: 'cyan', icon: SlidersHorizontal },
  'Live preview': { tone: 'primary', icon: Eye },
  'Accessibility check': { tone: 'success', icon: Accessibility },
  'Your configuration': { tone: 'info', icon: ClipboardList },
};

/**
 * One settings card: a colored section (shared SectionCard) with the title, description,
 * current value badge and content. Color and icon come from the title unless given.
 */
export function SettingCard({
  title,
  description,
  badge,
  tone,
  icon,
  children,
  className,
}: {
  title: string;
  description?: string;
  badge?: ReactNode;
  tone?: SectionTone;
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
}) {
  const look = CARD_LOOK[title] ?? { tone: 'primary' as const, icon: Settings2 };
  const Icon = icon ?? look.icon;
  return (
    <SectionCard
      title={title}
      description={description}
      tone={tone ?? look.tone}
      icon={<Icon aria-hidden="true" />}
      aside={
        badge !== undefined && badge !== null ? (
          <Badge tone="primary" variant="soft">
            {badge}
          </Badge>
        ) : undefined
      }
      className={className}
      bodyClassName="flex flex-col gap-4"
    >
      {children}
    </SectionCard>
  );
}

/** Radio card: native radio (keyboard, screen readers), visible indicator, optional preview. */
export function ChoiceCard({
  name,
  value,
  checked,
  onSelect,
  title,
  description,
  preview,
  className,
}: {
  name: string;
  value: string;
  checked: boolean;
  onSelect: () => void;
  title: ReactNode;
  description?: ReactNode;
  preview?: ReactNode;
  className?: string;
}) {
  return (
    <label
      className={cn(
        'relative flex min-h-11 cursor-pointer flex-col gap-0.5 rounded-md border p-3 text-left transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring',
        checked
          ? 'border-primary bg-primary-soft'
          : 'border-border bg-surface hover:border-field hover:bg-accent',
        className,
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onSelect}
        className="sr-only"
      />
      <span className="flex items-start justify-between gap-2">
        {preview ? (
          <span className="mb-2 flex min-h-6 min-w-0 flex-1 items-center" aria-hidden="true">
            {preview}
          </span>
        ) : (
          <span className="min-w-0 text-sm font-semibold text-foreground">{title}</span>
        )}
        <span
          aria-hidden="true"
          className={cn(
            'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border bg-surface',
            checked ? 'border-primary' : 'border-input',
          )}
        >
          {checked && <span className="size-2 rounded-full bg-primary" />}
        </span>
      </span>
      {preview && <span className="text-sm font-semibold text-foreground">{title}</span>}
      {description && <span className="text-xs text-muted-foreground">{description}</span>}
    </label>
  );
}

/** A group of choice cards (fieldset + legend; the legend can be a visible sub-heading). */
export function ChoiceGroup({
  legend,
  showLegend = false,
  columns = 2,
  children,
}: {
  legend: string;
  showLegend?: boolean;
  columns?: 2 | 3;
  children: ReactNode;
}) {
  return (
    <fieldset className="min-w-0">
      <legend
        className={
          showLegend
            ? 'mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase'
            : 'sr-only'
        }
      >
        {legend}
      </legend>
      <div className={cn('grid gap-2', columns === 3 ? 'grid-cols-3' : 'grid-cols-2')}>
        {children}
      </div>
    </fieldset>
  );
}
