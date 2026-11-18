import { Check, Cloud, CloudAlert, Copy, HardDrive, Loader2, Lock, RotateCcw } from 'lucide-react';
import { useSyncExternalStore } from 'react';

import { useTheme } from '@/app/theme';
import { PageContainer, PageHeader } from '@/components/page';
import { Alert, Button } from '@/components/ui';
import { usePermissions } from '@/features/auth';
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
import { lockedGroups } from '../components/appearance/lock-groups';
import { ColorSection, ModeSection } from '../components/appearance/ModeColorSections';
import { OrganizationAppearanceCard } from '../components/appearance/OrganizationAppearanceCard';
import { QuickPresets } from '../components/appearance/QuickPresets';
import { IconSection, TypographySection } from '../components/appearance/StyleSections';

export function AppearanceSettingsPage() {
  const { mode, preset, appearance, reset, isCustomized, lockedOptions, organization } = useTheme();
  const { copied, copy } = useCopyToClipboard();
  const { hasPermission } = usePermissions();
  const sync = useSyncExternalStore(appearanceSyncStore.subscribe, appearanceSyncStore.get);
  const isSynced = sync.isAvailable && sync.syncEnabled;
  const lockedCount = lockedGroups(lockedOptions).size;

  const chip = !isSynced
    ? { icon: HardDrive, text: 'Saved in this browser' }
    : sync.status === 'saving'
      ? { icon: Loader2, text: 'Syncing…' }
      : sync.status === 'error'
        ? { icon: CloudAlert, text: 'Sync failed — saved in this browser' }
        : { icon: Cloud, text: 'Synced across devices' };
  const ChipIcon = chip.icon;

  return (
    <PageContainer>
      <PageHeader
        title="Appearance"
        description={
          isSynced
            ? 'Personalize how the application looks and feels — on every device you sign in on.'
            : 'Personalize how the application looks and feels on this device.'
        }
        actions={
          <div className="flex items-center gap-2">
            <output
              title={chip.text}
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-border bg-muted px-2.5 text-xs font-medium whitespace-nowrap text-muted-foreground"
            >
              <ChipIcon
                className={
                  sync.status === 'saving' && isSynced ? 'size-3.5 animate-spin' : 'size-3.5'
                }
                aria-hidden="true"
              />
              <span className="sr-only sm:not-sr-only">{chip.text}</span>
            </output>
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
              title={
                organization ? "Back to your organization's look" : 'Back to the built-in defaults'
              }
              onClick={reset}
            >
              Reset to default
            </Button>
          </div>
        }
      />

      <div className="@container space-y-6">
        {lockedCount > 0 && (
          <Alert
            variant="info"
            icon={<Lock />}
            title={`Your organization set ${lockedCount} section${lockedCount === 1 ? '' : 's'}`}
            message="Locked sections follow the organization's look; everything else is yours to change."
          />
        )}
        {hasPermission('APPEARANCE_SETTINGS_READ') && (
          <OrganizationAppearanceCard canManage={hasPermission('APPEARANCE_SETTINGS_MANAGE')} />
        )}
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
