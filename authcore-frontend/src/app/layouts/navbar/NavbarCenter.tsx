import { Search } from 'lucide-react';

import { Kbd } from '@/components/ui';
import { featuresConfig, layoutConfig } from '@/config';
import { modKeyLabel } from '@/lib/utils';

import { useCommandMenu } from '../command-menu/command-menu-context';

/** Global search slot (wide screens): a search box that opens the command menu. */
export function NavbarCenter() {
  const { setOpen } = useCommandMenu();
  if (!featuresConfig.ui.globalSearch || !layoutConfig.navbar.actions.includes('search'))
    return null;
  return (
    <div className="hidden w-full max-w-xs shrink lg:block xl:max-w-sm">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-keyshortcuts={featuresConfig.ui.commandMenu ? 'Control+K Meta+K' : undefined}
        className="flex h-control-md w-full cursor-pointer items-center gap-2 rounded-md border border-field bg-muted/50 px-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <Search className="size-4 shrink-0" aria-hidden="true" />
        <span className="flex-1 truncate text-left">Search…</span>
        {featuresConfig.ui.commandMenu && (
          <span className="hidden items-center gap-0.5 sm:inline-flex" aria-hidden="true">
            <Kbd>{modKeyLabel()}</Kbd>
            <Kbd>K</Kbd>
          </span>
        )}
      </button>
    </div>
  );
}
