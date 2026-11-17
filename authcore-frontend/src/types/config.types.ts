/** Types of the files in src/config/ (everything a new project edits). */

import type { IconName } from '@/config/icons';

export type BadgeTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';

export type { AppConfig } from './app-config.types';

// ---------------------------------------------------------------------------
// features.config.ts — feature toggles
// ---------------------------------------------------------------------------

export type RegistrationFlow = 'otp' | 'link' | 'none' | 'approval';
export type LoginIdentifier = 'email' | 'username';

export interface FeaturesConfig {
  ui: {
    /** Light / dark / system toggle in the navbar. */
    themeSwitcher: boolean;
    /** Preset + appearance pickers on the appearance settings page. */
    themeCustomizer: boolean;
    globalSearch: boolean;
    commandMenu: boolean;
    notifications: boolean;
    breadcrumbs: boolean;
  };
  /** Must match the backend .env (docs/new-project-guide.md, step 7). */
  auth: {
    allowRegistration: boolean;
    /** Backend: REGISTRATION_EMAIL_VERIFICATION (+ REGISTRATION_REQUIRE_APPROVAL for "approval"). */
    registrationFlow: RegistrationFlow;
    /** Backend: LOGIN_IDENTIFIERS. */
    loginIdentifiers: readonly LoginIdentifier[];
    enableRememberMe: boolean;
    enableSelfRecovery: boolean;
    enableInvites: boolean;
  };
  account: {
    sessionsPage: boolean;
    activityPage: boolean;
    devicesPage: boolean;
    preferencesPage: boolean;
    dataExport: boolean;
    selfDeletion: boolean;
  };
  admin: {
    /** Administration area (users, access control, policies …). */
    enabled: boolean;
  };
}

/** "section.flag" for every boolean in FeaturesConfig, e.g. "ui.notifications". */
export type FeatureFlag = {
  [S in keyof FeaturesConfig]: {
    [K in keyof FeaturesConfig[S]]: FeaturesConfig[S][K] extends boolean
      ? `${S}.${K & string}`
      : never;
  }[keyof FeaturesConfig[S]];
}[keyof FeaturesConfig];

// ---------------------------------------------------------------------------
// layout.config.ts — sizes and behavior (looks: theme appearance)
// ---------------------------------------------------------------------------

export type Breakpoint = 'sm' | 'md' | 'lg' | 'xl';
/**
 * Built-in navbar actions:
 * - search: search box (center, wide screens) / icon (small screens) → opens the command menu
 * - commandMenu: Ctrl / Cmd + K command menu (pages + actions); icon button when there is no search box
 * - themeToggle, notifications (bell + popover), userMenu (avatar dropdown)
 */
export type NavbarActionId =
  'search' | 'commandMenu' | 'themeToggle' | 'notifications' | 'userMenu';

/** Built-in behaviours a custom action can trigger instead of a link. */
export type NavbarCommand = 'openCommandMenu' | 'toggleSidebar' | 'toggleTheme';

interface NavbarCustomActionBase {
  id: string;
  label: string;
  icon: IconName;
}

/** Custom navbar button: a link (internal path / external URL) or a built-in command. */
export type NavbarCustomAction = NavbarCustomActionBase &
  (
    | { href: string; external?: boolean; command?: never }
    | { command: NavbarCommand; href?: never; external?: never }
  );

export interface LayoutConfig {
  sidebar: {
    enabled: boolean;
    position: 'left' | 'right';
    /** Expanded width in px. */
    width: number;
    /** Icon-only width in px. */
    collapsedWidth: number;
    collapsible: boolean;
    defaultCollapsed: boolean;
    /** sticky: scrolls with the page but stays in view; fixed: always pinned. */
    behavior: 'sticky' | 'fixed';
    /** Below this breakpoint the sidebar becomes a drawer. */
    mobileBreakpoint: Breakpoint;
    showAppName: boolean;
  };
  navbar: {
    enabled: boolean;
    /** Height in px. */
    height: number;
    sticky: boolean;
    /** when-sidebar-collapsed: also while the sidebar is icon-only. */
    showLogo: 'always' | 'never' | 'when-sidebar-hidden' | 'when-sidebar-collapsed';
    /** Button that collapses the sidebar (desktop) / opens the drawer (mobile). */
    showSidebarToggle: boolean;
    showBreadcrumbs: boolean;
    /** Built-in actions, in order (each still needs its feature flag where one exists). */
    actions: readonly NavbarActionId[];
    customActions: readonly NavbarCustomAction[];
    /** Below this breakpoint, theme toggle and custom actions move into a "more" menu. */
    overflowBelow: Breakpoint;
  };
  content: {
    maxWidth: 'full' | 'container' | 'narrow';
    padding: 'compact' | 'comfortable' | 'spacious';
  };
  /** Where sign-in / sign-up pages are shown. */
  auth: {
    variant: 'centered' | 'split';
    /** Image for the split variant (public/ path or https URL). */
    sideImage: string | null;
  };
}
