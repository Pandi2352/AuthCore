import { useTheme } from '@/app/theme';
import { QUICK_PRESETS } from '@/config/appearance-presets';

import { ChoiceCard, SettingCard } from './AppearanceParts';
import { presetTarget, useActiveQuickPreset } from './quick-preset-state';

const SWATCH_PARTS = ['background', 'surface', 'accent', 'text'] as const;

export function QuickPresets() {
  const { applyTheme } = useTheme();
  const active = useActiveQuickPreset();
  return (
    <SettingCard
      title="Quick presets"
      description="Apply a complete look in one tap, then fine-tune it below."
      badge={active?.label ?? 'Custom'}
    >
      <fieldset>
        <legend className="sr-only">Quick presets</legend>
        <div className="grid grid-cols-2 gap-3 @2xl:grid-cols-3 @5xl:grid-cols-6">
          {QUICK_PRESETS.map((p) => (
            <ChoiceCard
              key={p.id}
              name="quick-preset"
              value={p.id}
              checked={active?.id === p.id}
              onSelect={() => applyTheme(presetTarget(p))}
              preview={
                <span className="flex h-7 w-full overflow-hidden rounded-md border border-border">
                  {SWATCH_PARTS.map((part, i) => (
                    <span key={part} className="flex-1" style={{ background: p.swatch[i] }} />
                  ))}
                </span>
              }
              title={p.label}
              description={p.description}
            />
          ))}
        </div>
      </fieldset>
    </SettingCard>
  );
}
