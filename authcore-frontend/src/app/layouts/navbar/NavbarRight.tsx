import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { ThemeToggle } from '@/components/common/ThemeToggle';
import { Button, Tooltip } from '@/components/ui';
import { icons, isFeatureEnabled, layoutConfig } from '@/config';
import type { FeatureFlag, NavbarActionId, NavbarCustomAction } from '@/types/config.types';

import { UserMenu } from './UserMenu';

/** Built-in actions need their feature flag (search / command menu / notifications: module 8). */
const ACTION_FLAG: Partial<Record<NavbarActionId, FeatureFlag>> = {
  search: 'ui.globalSearch',
  commandMenu: 'ui.commandMenu',
  themeToggle: 'ui.themeSwitcher',
  notifications: 'ui.notifications',
};

const BUILT_IN: Partial<Record<NavbarActionId, () => ReactNode>> = {
  themeToggle: () => <ThemeToggle />,
  userMenu: () => <UserMenu />,
};

function CustomAction({ action }: { action: NavbarCustomAction }) {
  const Icon = icons[action.icon];
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

/** Actions in the order of layout.config.ts → navbar.actions, after any custom actions. */
export function NavbarRight() {
  const { actions, customActions } = layoutConfig.navbar;
  return (
    <div className="flex shrink-0 items-center gap-1">
      {customActions.map((action) => (
        <CustomAction key={action.id} action={action} />
      ))}
      {actions.map((id) => {
        const flag = ACTION_FLAG[id];
        const render = BUILT_IN[id];
        if (!render || (flag && !isFeatureEnabled(flag))) return null;
        return (
          <span key={id} className="inline-flex">
            {render()}
          </span>
        );
      })}
    </div>
  );
}
