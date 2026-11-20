import { Check, Cloud, CloudAlert, Copy, Loader2, RotateCcw, Users } from 'lucide-react';
import { useSyncExternalStore } from 'react';

import { useTheme } from '@/app/theme';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { PageContainer, PageHeader } from '@/components/page';
import { Button } from '@/components/ui';
import { useCopyToClipboard } from '@/hooks';

import { appearanceSyncStore } from '../appearance-sync';
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

/**
 * The application look for everyone (super admin, APPEARANCE_SETTINGS_MANAGE). Every change
 * applies at once and is saved automatically (AppearanceSync); other users get it on their
 * next page load.
 */
export function AppearanceSettingsPage() {
  const { defaultMode, preset, appearance, reset, isCustomized } = useTheme();
  const { copied, copy } = useCopyToClipboard();
  const save = useSyncExternalStore(appearanceSyncStore.subscribe, appearanceSyncStore.get);

  const chip =
    save.status === 'saving'
      ? { icon: Loader2, text: 'Saving…', spin: true }
      : save.status === 'error'
        ? { icon: CloudAlert, text: 'Not saved — check your connection', spin: false }
        : save.status === 'saved'
          ? { icon: Cloud, text: 'Saved for everyone', spin: false }
          : { icon: Users, text: 'Applies to everyone', spin: false };
  const ChipIcon = chip.icon;

  return (
    <PageContainer>
      <PageHeader
        title="Appearance"
        description="The look of the application for every user, including the sign-in pages. Changes are saved automatically."
        actions={
          <div className="flex items-center gap-2">
            <output
              title={chip.text}
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-border bg-muted px-2.5 text-xs font-medium whitespace-nowrap text-muted-foreground"
            >
              <ChipIcon
                className={chip.spin ? 'size-3.5 animate-spin' : 'size-3.5'}
                aria-hidden="true"
              />
              <span className="sr-only sm:not-sr-only">{chip.text}</span>
            </output>
            <Button
              variant="outline"
              size="toolbar"
              className="shrink-0 whitespace-nowrap"
              leftIcon={copied ? <Check /> : <Copy />}
              onClick={() =>
                void copy(JSON.stringify({ mode: defaultMode, preset, appearance }, null, 2))
              }
            >
              {copied ? 'Copied' : 'Copy settings'}
            </Button>
            <ConfirmDialog
              trigger={
                <Button
                  variant="outline"
                  size="toolbar"
                  className="shrink-0 whitespace-nowrap"
                  leftIcon={<RotateCcw />}
                  disabled={!isCustomized}
                >
                  Reset to default
                </Button>
              }
              title="Reset the look for everyone?"
              description="Colors, layout, fonts and preferences go back to the built-in defaults for every user."
              confirmText="Reset"
              onConfirm={reset}
            />
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
