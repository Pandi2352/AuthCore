import { Globe, House, Lock, Search, Settings, Users, X } from 'lucide-react';

import { appConfig } from '@/config';
import type { BrandingAssets } from '@/lib/branding';
import { cn } from '@/lib/utils';

import { SettingCard } from '../appearance/AppearanceParts';

const NAV = [
  { icon: House, label: 'Dashboard', active: true },
  { icon: Users, label: 'Users', active: false },
  { icon: Settings, label: 'Settings', active: false },
];

/** Search engines cut descriptions at about this many characters. */
const SNIPPET_LENGTH = 155;

interface PreviewProps {
  siteName: string;
  siteDescription: string;
  assets: BrandingAssets;
}

function Mark({
  name,
  src,
  size = 'md',
}: {
  name: string;
  src: string | null;
  size?: 'sm' | 'md';
}) {
  const box = size === 'sm' ? 'size-6 text-xs' : 'size-8 text-sm';
  return src ? (
    <img src={src} alt="" className={cn(box, 'shrink-0 rounded-md object-contain')} />
  ) : (
    <span
      className={cn(
        box,
        'flex shrink-0 items-center justify-center rounded-md bg-primary font-black text-primary-foreground',
      )}
    >
      {name.trim().charAt(0).toUpperCase() || '?'}
    </span>
  );
}

function FullLogo({
  name,
  logo,
  mark,
}: {
  name: string;
  logo: string | null;
  mark: string | null;
}) {
  return logo ? (
    <img src={logo} alt="" className="h-8 w-full object-contain object-center" />
  ) : (
    <span className="flex min-w-0 items-center gap-2">
      <Mark name={name} src={mark} size="sm" />
      <span className="truncate text-sm font-bold text-foreground">{name}</span>
    </span>
  );
}

const Label = ({ children }: { children: string }) => (
  <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
    {children}
  </p>
);

/** Where the business settings appear, drawn from the current (unsaved) values. Decorative. */
export function BrandingPreview({ siteName, siteDescription, assets }: PreviewProps) {
  const name = siteName.trim() || 'Your site';
  const favicon = assets.favicon ?? appConfig.favicon;
  const host = typeof window === 'undefined' ? 'app.example.com' : window.location.host;
  const snippet =
    siteDescription.length > SNIPPET_LENGTH
      ? `${siteDescription.slice(0, SNIPPET_LENGTH).trimEnd()}…`
      : siteDescription;

  return (
    <SettingCard
      title="Live preview"
      description="Unsaved text changes appear here first."
      badge="Preview"
    >
      <div aria-hidden="true" inert className="space-y-5 select-none">
        {/* Browser tab */}
        <div>
          <Label>Browser tab</Label>
          <div className="overflow-hidden rounded-md border border-border bg-muted">
            <div className="flex items-end gap-1 px-2 pt-2">
              <div className="flex h-8 max-w-[75%] min-w-0 items-center gap-2 rounded-md bg-surface px-3 text-xs text-foreground">
                <img src={favicon} alt="" className="size-4 shrink-0 object-contain" />
                <span className="truncate">Dashboard · {name}</span>
                <X className="size-3 shrink-0 text-muted-foreground" />
              </div>
            </div>
            <div className="flex items-center gap-2 border-t border-border bg-surface px-3 py-2 text-xs text-muted-foreground">
              <Lock className="size-3 shrink-0" />
              <span className="truncate">{host}/dashboard</span>
            </div>
          </div>
        </div>

        {/* Sidebar expanded + collapsed */}
        <div>
          <Label>Sidebar · expanded and collapsed</Label>
          <div className="flex gap-3">
            <div className="min-w-0 flex-1 overflow-hidden rounded-md border border-sidebar-border bg-sidebar">
              <div className="flex h-12 items-center border-b border-sidebar-border px-3">
                <FullLogo name={name} logo={assets.logo} mark={assets.logoMark} />
              </div>
              <div className="space-y-1 p-2 text-xs">
                {NAV.map(({ icon: Icon, label, active }) => (
                  <div
                    key={label}
                    className={cn(
                      'flex items-center gap-2 rounded-md px-2 py-1.5',
                      active
                        ? 'bg-sidebar-active font-medium text-sidebar-active-foreground'
                        : 'text-sidebar-foreground',
                    )}
                  >
                    <Icon className="size-3.5" /> {label}
                  </div>
                ))}
              </div>
            </div>
            <div className="w-14 shrink-0 overflow-hidden rounded-md border border-sidebar-border bg-sidebar">
              <div className="flex h-12 items-center justify-center border-b border-sidebar-border">
                <Mark name={name} src={assets.logoMark} />
              </div>
              <div className="flex flex-col items-center gap-1 p-2">
                {NAV.map(({ icon: Icon, label, active }) => (
                  <span
                    key={label}
                    className={cn(
                      'flex size-8 items-center justify-center rounded-md',
                      active
                        ? 'bg-sidebar-active text-sidebar-active-foreground'
                        : 'text-sidebar-foreground',
                    )}
                  >
                    <Icon className="size-3.5" />
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Sign-in page */}
        <div>
          <Label>Sign-in page</Label>
          <div className="rounded-md border border-border bg-background p-3">
            <div className="mb-3 flex h-7 items-center">
              <FullLogo name={name} logo={assets.authLogo ?? assets.logo} mark={assets.logoMark} />
            </div>
            <div className="rounded-md border border-border bg-surface p-3">
              <p className="text-sm font-semibold text-foreground">Welcome back</p>
              <p className="text-xs text-muted-foreground">
                Sign in to your {name} account to continue.
              </p>
              <div className="mt-3 h-7 rounded-md border border-field bg-surface" />
              <div className="mt-2 flex h-7 items-center justify-center rounded-md bg-primary text-xs font-medium text-primary-foreground">
                Sign in
              </div>
            </div>
          </div>
        </div>

        {/* Search result */}
        <div>
          <Label>Search result & link preview</Label>
          <div className="rounded-md border border-border bg-surface p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="flex size-6 items-center justify-center rounded-full border border-border bg-muted">
                <img src={favicon} alt="" className="size-3.5 object-contain" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-foreground">{name}</span>
                <span className="flex items-center gap-1 truncate">
                  <Globe className="size-3" /> {host}
                </span>
              </span>
            </div>
            <p className="mt-2 truncate text-base text-primary">{name}</p>
            <p className="line-clamp-2 text-xs text-muted-foreground">
              {snippet || (
                <span className="flex items-center gap-1 italic">
                  <Search className="size-3" /> No description: search engines pick text from the
                  page.
                </span>
              )}
            </p>
          </div>
        </div>
      </div>
    </SettingCard>
  );
}
