import {
  Maximize,
  Minimize,
  Monitor,
  Moon,
  MoreVertical,
  Search,
  Sun,
  SunMoon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { ThemeToggle } from '@/components/common/ThemeToggle';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  IconButton,
  Tooltip,
} from '@/components/ui';
import { featuresConfig, icons, isFeatureEnabled, layoutConfig } from '@/config';
import { useFullscreen } from '@/hooks/useFullscreen';
import { useBreakpoint } from '@/hooks/useMediaQuery';
import { modKeyLabel } from '@/lib/utils';
import type { FeatureFlag, NavbarActionId, NavbarCustomAction } from '@/types/config.types';
import type { ColorMode } from '@/types/theme.types';

import { useTheme } from '../../theme';
import { useCommandMenu } from '../command-menu/command-menu-context';
import { NotificationsButton } from './notifications/NotificationsButton';
import { useNavbarCommands } from './use-navbar-commands';
import { UserMenu } from './UserMenu';

const ACTION_FLAG: Record<Exclude<NavbarActionId, 'userMenu'>, FeatureFlag> = {
  search: 'ui.globalSearch',
  commandMenu: 'ui.commandMenu',
  fullscreen: 'ui.fullscreen',
  themeToggle: 'ui.themeSwitcher',
  notifications: 'ui.notifications',
};

const isOn = (id: NavbarActionId) => id === 'userMenu' || isFeatureEnabled(ACTION_FLAG[id]);

function CustomActionButton({ action }: { action: NavbarCustomAction }) {
  const commands = useNavbarCommands();
  const Icon = icons[action.icon];
  if (action.command !== undefined) {
    return (
      <IconButton aria-label={action.label} icon={<Icon />} onClick={commands[action.command]} />
    );
  }
  return (
    <Tooltip content={action.label}>
      <Button variant="ghost" size="icon" asChild>
        {action.external ? (
          <a
            href={action.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${action.label} (opens in a new tab)`}
          >
            <Icon aria-hidden="true" />
          </a>
        ) : (
          <Link to={action.href} aria-label={action.label}>
            <Icon aria-hidden="true" />
          </Link>
        )}
      </Button>
    </Tooltip>
  );
}

function CustomActionItem({ action }: { action: NavbarCustomAction }) {
  const commands = useNavbarCommands();
  const Icon = icons[action.icon];
  if (action.command !== undefined) {
    return (
      <DropdownMenuItem icon={<Icon aria-hidden="true" />} onSelect={commands[action.command]}>
        {action.label}
      </DropdownMenuItem>
    );
  }
  return (
    <DropdownMenuItem asChild>
      {action.external ? (
        <a href={action.href} target="_blank" rel="noopener noreferrer">
          <Icon aria-hidden="true" />
          {action.label}
        </a>
      ) : (
        <Link to={action.href}>
          <Icon aria-hidden="true" />
          {action.label}
        </Link>
      )}
    </DropdownMenuItem>
  );
}

function FullscreenButton() {
  const { isFullscreen, toggle } = useFullscreen();
  return (
    <IconButton
      aria-label={isFullscreen ? 'Exit full screen' : 'Full screen'}
      aria-pressed={isFullscreen}
      icon={isFullscreen ? <Minimize /> : <Maximize />}
      onClick={() => void toggle()}
    />
  );
}

/** "More" menu on small screens: custom actions, full screen, theme choice. */
function OverflowMenu({
  actions,
  showTheme,
  showFullscreen,
}: {
  actions: readonly NavbarCustomAction[];
  showTheme: boolean;
  showFullscreen: boolean;
}) {
  const { mode, setMode } = useTheme();
  const fullscreen = useFullscreen();
  if (actions.length === 0 && !showTheme && !showFullscreen) return null;
  return (
    <DropdownMenu>
      <Tooltip content="More">
        <DropdownMenuTrigger
          aria-label="More actions"
          className="inline-flex size-control-md cursor-pointer items-center justify-center rounded-md text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <MoreVertical className="size-4" aria-hidden="true" />
        </DropdownMenuTrigger>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-56">
        {actions.length > 0 && <DropdownMenuLabel>Actions</DropdownMenuLabel>}
        {actions.map((action) => (
          <CustomActionItem key={action.id} action={action} />
        ))}
        {showFullscreen && (
          <DropdownMenuItem
            icon={
              fullscreen.isFullscreen ? (
                <Minimize aria-hidden="true" />
              ) : (
                <Maximize aria-hidden="true" />
              )
            }
            onSelect={() => void fullscreen.toggle()}
          >
            {fullscreen.isFullscreen ? 'Exit full screen' : 'Full screen'}
          </DropdownMenuItem>
        )}
        {(actions.length > 0 || showFullscreen) && showTheme && <DropdownMenuSeparator />}
        {showTheme && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger icon={<SunMoon aria-hidden="true" />}>
              Theme
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuRadioGroup
                value={mode}
                onValueChange={(value) => setMode(value as ColorMode)}
              >
                <DropdownMenuRadioItem value="light">
                  <Sun aria-hidden="true" /> Light
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="dark">
                  <Moon aria-hidden="true" /> Dark
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="system">
                  <Monitor aria-hidden="true" /> System
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Actions in the order of layout.config.ts → navbar.actions (custom actions first).
 * Below navbar.overflowBelow, the theme toggle and custom actions move into a "more" menu;
 * search becomes an icon, notifications and the user menu stay visible.
 */
export function NavbarRight() {
  const { actions, customActions, overflowBelow } = layoutConfig.navbar;
  const isWide = useBreakpoint(overflowBelow);
  const isSearchBoxVisible = useBreakpoint('lg');
  const { setOpen } = useCommandMenu();
  const { userCustomizable } = useTheme();
  const enabled = actions.filter(isOn);
  const themeAllowed = enabled.includes('themeToggle') && userCustomizable.mode;
  const { supported: fullscreenSupported } = useFullscreen();
  const fullscreenAllowed = enabled.includes('fullscreen') && fullscreenSupported;

  const searchIcon = (
    <IconButton
      aria-label={featuresConfig.ui.commandMenu ? `Search (${modKeyLabel()} K)` : 'Search'}
      aria-haspopup="dialog"
      icon={<Search />}
      onClick={() => setOpen(true)}
    />
  );

  const nodeFor = (id: NavbarActionId): ReactNode => {
    switch (id) {
      case 'search':
        // the search box lives in NavbarCenter on large screens
        return isSearchBoxVisible ? null : searchIcon;
      case 'commandMenu':
        // a separate icon only when there is no search box / icon already
        return enabled.includes('search') ? null : searchIcon;
      case 'fullscreen':
        return isWide && fullscreenAllowed ? <FullscreenButton /> : null;
      case 'themeToggle':
        return isWide ? <ThemeToggle /> : null;
      case 'notifications':
        return <NotificationsButton />;
      case 'userMenu':
        return <UserMenu />;
    }
  };

  return (
    <div className="flex shrink-0 items-center gap-1">
      {isWide &&
        customActions.map((action) => <CustomActionButton key={action.id} action={action} />)}
      {enabled.map((id) => {
        const node = nodeFor(id);
        return node ? (
          <span key={id} className="inline-flex">
            {node}
          </span>
        ) : null;
      })}
      {!isWide && (
        <OverflowMenu
          actions={customActions}
          showTheme={themeAllowed}
          showFullscreen={fullscreenAllowed}
        />
      )}
    </div>
  );
}
