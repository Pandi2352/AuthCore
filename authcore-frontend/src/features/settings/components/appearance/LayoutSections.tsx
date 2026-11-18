import { useTheme } from '@/app/theme';
import { Switch } from '@/components/ui';
import { RADIUS_PX } from '@/config/appearance-presets';

import {
  DENSITY_LABEL,
  entries,
  NAVBAR_LABEL,
  POSITION_LABEL,
  RADIUS_LABEL,
  SIDEBAR_LABEL,
} from './appearance-labels';
import { ChoiceCard, ChoiceGroup, SettingCard } from './AppearanceParts';
import { lockKeysOf } from './lock-groups';

const DENSITY_GAP = { compact: 2, comfortable: 4, spacious: 6 } as const;

export function RadiusSection() {
  const { appearance, setAppearance } = useTheme();
  return (
    <SettingCard
      title="Corner radius"
      lockKeys={lockKeysOf('radius')}
      description="How curved buttons, cards and fields feel."
      badge={RADIUS_LABEL[appearance.radius].title}
    >
      <ChoiceGroup legend="Corner radius">
        {entries(RADIUS_LABEL).map(([value, label]) => (
          <ChoiceCard
            key={value}
            name="radius"
            value={value}
            checked={appearance.radius === value}
            onSelect={() => setAppearance({ radius: value })}
            preview={
              <span
                className="block size-5 border-2 border-foreground/70"
                style={{ borderRadius: value === 'pill' ? 9999 : RADIUS_PX[value] * 1.25 }}
              />
            }
            title={label.title}
            description={label.description}
          />
        ))}
      </ChoiceGroup>
    </SettingCard>
  );
}

export function DensitySection() {
  const { appearance, setAppearance } = useTheme();
  return (
    <SettingCard
      title="Density"
      lockKeys={lockKeysOf('density')}
      description="Spacing between and inside elements."
      badge={DENSITY_LABEL[appearance.density].title}
    >
      <ChoiceGroup legend="Density" columns={3}>
        {entries(DENSITY_LABEL).map(([value, label]) => (
          <ChoiceCard
            key={value}
            name="density"
            value={value}
            checked={appearance.density === value}
            onSelect={() => setAppearance({ density: value })}
            preview={
              <span className="flex w-16 flex-col" style={{ gap: DENSITY_GAP[value] }}>
                {[0, 1, 2].map((i) => (
                  <span key={i} className="block h-1 rounded-md bg-muted-foreground/40" />
                ))}
              </span>
            }
            title={label.title}
            description={label.description}
          />
        ))}
      </ChoiceGroup>
    </SettingCard>
  );
}

export function SidebarSection() {
  const { appearance, setAppearance } = useTheme();
  return (
    <SettingCard
      title="Sidebar style"
      lockKeys={lockKeysOf('sidebar')}
      description="Shape of the main navigation panel."
      badge={SIDEBAR_LABEL[appearance.sidebar].title}
    >
      <ChoiceGroup legend="Sidebar style">
        {entries(SIDEBAR_LABEL).map(([value, label]) => (
          <ChoiceCard
            key={value}
            name="sidebar"
            value={value}
            checked={appearance.sidebar === value}
            onSelect={() => setAppearance({ sidebar: value })}
            title={label.title}
            description={label.description}
          />
        ))}
      </ChoiceGroup>
      <ChoiceGroup legend="Position" showLegend>
        {entries(POSITION_LABEL).map(([value, label]) => (
          <ChoiceCard
            key={value}
            name="sidebar-position"
            value={value}
            checked={appearance.sidebarPosition === value}
            onSelect={() => setAppearance({ sidebarPosition: value })}
            title={label.title}
            description={label.description}
          />
        ))}
      </ChoiceGroup>
    </SettingCard>
  );
}

export function NavbarSection() {
  const { appearance, setAppearance } = useTheme();
  return (
    <SettingCard
      title="Navbar style"
      lockKeys={lockKeysOf('navbar')}
      description="Shape of the top bar."
      badge={NAVBAR_LABEL[appearance.navbar].title}
    >
      <ChoiceGroup legend="Navbar style">
        {entries(NAVBAR_LABEL).map(([value, label]) => (
          <ChoiceCard
            key={value}
            name="navbar"
            value={value}
            checked={appearance.navbar === value}
            onSelect={() => setAppearance({ navbar: value })}
            title={label.title}
            description={label.description}
          />
        ))}
      </ChoiceGroup>
      <div className="space-y-4 border-t border-border pt-4">
        <Switch
          label="Show search bar"
          hint="Quick search in the top bar"
          checked={appearance.navbarSearch === 'on'}
          onCheckedChange={(on) => setAppearance({ navbarSearch: on ? 'on' : 'off' })}
        />
        <Switch
          label="Show breadcrumbs"
          hint="Page path above the content"
          checked={appearance.breadcrumbs === 'on'}
          onCheckedChange={(on) => setAppearance({ breadcrumbs: on ? 'on' : 'off' })}
        />
      </div>
    </SettingCard>
  );
}
