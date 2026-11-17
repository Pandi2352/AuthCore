import { Check, Copy, HardDrive, RotateCcw } from 'lucide-react';

import { useTheme } from '@/app/theme';
import { PageContainer, PageHeader } from '@/components/page';
import { Button } from '@/components/ui';
import { useCopyToClipboard } from '@/hooks';

import { AccessibilityCheck } from '../components/appearance/AccessibilityCheck';
import { ConfigSummary } from '../components/appearance/ConfigSummary';
import { EffectsSection, PreferencesSection } from '../components/appearance/EffectsSections';
import {
  DensitySection,
  NavbarSection,
  RadiusSection,
  SidebarSection,
} from '../components/appearance/LayoutSections';
import { LivePreview } from '../components/appearance/LivePreview';
import { ColorSection, ModeSection } from '../components/appearance/ModeColorSections';
import { QuickPresets } from '../components/appearance/QuickPresets';
import { IconSection, TypographySection } from '../components/appearance/StyleSections';

export function AppearanceSettingsPage() {
  const { mode, preset, appearance, reset, isCustomized } = useTheme();
  const { copied, copy } = useCopyToClipboard();

  return (
    <PageContainer>
      <PageHeader
        title="Appearance"
        description="Personalize how the application looks and feels on this device."
        actions={
          <div className="flex items-center gap-2">
            <span
              title="Saved in this browser"
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-border bg-muted px-2.5 text-xs font-medium whitespace-nowrap text-muted-foreground"
            >
              <HardDrive className="size-3.5" aria-hidden="true" />
              <span className="sr-only sm:not-sr-only">Saved in this browser</span>
            </span>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 whitespace-nowrap"
              leftIcon={copied ? <Check /> : <Copy />}
              onClick={() => void copy(JSON.stringify({ mode, preset, appearance }, null, 2))}
            >
              {copied ? 'Copied' : 'Copy settings'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 whitespace-nowrap"
              leftIcon={<RotateCcw />}
              disabled={!isCustomized}
              onClick={reset}
            >
              Reset to default
            </Button>
          </div>
        }
      />

      <div className="@container space-y-6">
        <QuickPresets />
        <div className="grid items-start gap-6 @5xl:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] @7xl:grid-cols-[minmax(0,1fr)_minmax(0,30rem)]">
          <div className="grid min-w-0 gap-6 @3xl:grid-cols-2">
            <ModeSection />
            <ColorSection />
            <RadiusSection />
            <DensitySection />
            <SidebarSection />
            <NavbarSection />
            <IconSection />
            <TypographySection />
            <EffectsSection />
            <PreferencesSection />
          </div>
          <aside
            aria-label="Preview and summary"
            className="min-w-0 space-y-6 @5xl:sticky @5xl:top-[calc(var(--navbar-height)+1.5rem)]"
          >
            <LivePreview />
            <ConfigSummary />
            <AccessibilityCheck />
          </aside>
        </div>
      </div>
    </PageContainer>
  );
}
