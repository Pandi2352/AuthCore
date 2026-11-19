import { LogOut, Monitor, Moon, Palette, ShieldCheck, Sun, SunMoon, UserRound } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

import {
  Avatar,
  Badge,
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
} from '@/components/ui';
import { featuresConfig, paths } from '@/config';
import { useMyAvatar } from '@/features/account';
import { useAuth, usePermissions } from '@/features/auth';
import type { ColorMode } from '@/types/theme.types';

import { useTheme } from '../../theme';

/** Avatar menu: who is signed in, account links, theme, sign out. */
export function UserMenu() {
  const { user, logout } = useAuth();
  const { isSuperAdmin } = usePermissions();
  const { mode, setMode, userCustomizable } = useTheme();
  const navigate = useNavigate();
  const avatar = useMyAvatar(user?.id);
  if (!user) return null;
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;

  const signOut = async () => {
    await logout();
    navigate(paths.auth.login, { replace: true });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Account menu for ${fullName}`}
        className="inline-flex cursor-pointer items-center gap-2 rounded-md p-1 transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:pr-2"
      >
        <Avatar src={avatar} name={fullName} size="sm" />
        <span className="hidden max-w-36 truncate text-sm font-medium sm:block">{fullName}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <span className="block truncate text-sm font-medium text-foreground">{fullName}</span>
          <span className="block truncate text-xs">{user.email}</span>
          {isSuperAdmin && (
            <Badge tone="primary" size="sm" className="mt-1.5">
              Administrator
            </Badge>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to={paths.account.profile}>
            <UserRound aria-hidden="true" />
            My profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to={paths.account.security}>
            <ShieldCheck aria-hidden="true" />
            Security
          </Link>
        </DropdownMenuItem>
        {featuresConfig.ui.themeCustomizer && (
          <DropdownMenuItem asChild>
            <Link to={paths.settings.appearance}>
              <Palette aria-hidden="true" />
              Appearance
            </Link>
          </DropdownMenuItem>
        )}
        {userCustomizable.mode && (
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
        <DropdownMenuSeparator />
        <DropdownMenuItem
          destructive
          icon={<LogOut aria-hidden="true" />}
          onSelect={() => void signOut()}
        >
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
