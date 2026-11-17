import type { AppConfig } from '@/types/app-config.types';
import type { FeatureFlag, FeaturesConfig, LayoutConfig } from '@/types/config.types';
import type { NavGroup, NavItem } from '@/types/navigation.types';
import {
  APPEARANCE_VALUES,
  COLOR_MODES,
  type AppearanceOption,
  type ThemeConfig,
  type ThemePreset,
} from '@/types/theme.types';

import { isIconName } from './icons';

/**
 * Checks the config files for mistakes TypeScript can't catch (duplicate ids,
 * unknown icons, bad URLs, impossible sizes, unregistered presets …).
 * Pure: returns the problems; main.tsx decides what to do with them.
 */
export interface ConfigSet {
  app: AppConfig;
  features: FeaturesConfig;
  navigation: readonly NavGroup[];
  navigationFooter: NavGroup;
  layout: LayoutConfig;
  theme: ThemeConfig;
  presets: readonly ThemePreset[];
}

const SLUG = /^[a-z][a-z0-9-]{1,30}[a-z0-9]$/;
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const LANGUAGE = /^[a-z]{2,3}(-[A-Z]{2})?$/;
const EMAIL = /^[^\s@]+@[^\s@]+$/;

const isHttpUrl = (value: string): boolean => /^https?:\/\/[^\s]+$/.test(value);
const isAsset = (value: string): boolean => value.startsWith('/') || value.startsWith('https://');

function isTimeZone(value: string): boolean {
  try {
    return new Intl.DateTimeFormat('en', { timeZone: value }).resolvedOptions().timeZone !== '';
  } catch {
    return false;
  }
}

function featureFlags(features: FeaturesConfig): Set<string> {
  const flags = new Set<string>();
  for (const [section, values] of Object.entries(features)) {
    for (const [key, value] of Object.entries(values as Record<string, unknown>)) {
      if (typeof value === 'boolean') flags.add(`${section}.${key}`);
    }
  }
  return flags;
}

function checkApp(app: AppConfig, problems: string[]): void {
  const at = (field: string, message: string) =>
    problems.push(`app.config.ts › ${field}: ${message}`);
  if (!app.name.trim() || app.name.length > 50) at('name', 'must be 1–50 characters');
  if (!app.shortName.trim() || app.shortName.length > 20)
    at('shortName', 'must be 1–20 characters');
  if (!SLUG.test(app.slug))
    at('slug', 'lowercase letters, digits and "-", 3–32 characters (e.g. "nexa-crm")');
  for (const [key, value] of Object.entries(app.themeColor)) {
    if (!HEX_COLOR.test(value)) at(`themeColor.${key}`, `"${value}" is not a #rrggbb color`);
  }
  if (!HEX_COLOR.test(app.branding.primaryColor))
    at('branding.primaryColor', 'must be a #rrggbb color');
  for (const [key, value] of Object.entries(app.logos)) {
    if (value !== null && !isAsset(value))
      at(`logos.${key}`, 'must start with "/" (public/) or be an https URL');
  }
  if (!isAsset(app.favicon)) at('favicon', 'must start with "/" (public/) or be an https URL');
  if (!LANGUAGE.test(app.locale.defaultLanguage))
    at('locale.defaultLanguage', 'must look like "en" or "en-IN"');
  if (!isTimeZone(app.locale.defaultTimeZone))
    at('locale.defaultTimeZone', `"${app.locale.defaultTimeZone}" is not an IANA time zone`);
  if (app.branding.supportEmail !== null && !EMAIL.test(app.branding.supportEmail))
    at('branding.supportEmail', 'is not an email address');
  for (const [key, value] of Object.entries({
    ...app.legal,
    websiteUrl: app.branding.websiteUrl,
  })) {
    if (value !== null && !isHttpUrl(value)) at(key, 'must be an http(s) URL or null');
  }
}

function checkFeatures(features: FeaturesConfig, problems: string[]): void {
  if (features.auth.loginIdentifiers.length === 0) {
    problems.push(
      'features.config.ts › auth.loginIdentifiers: at least one of "email", "username"',
    );
  }
  if (!features.auth.allowRegistration && features.auth.registrationFlow === 'approval') {
    problems.push(
      'features.config.ts › auth: registrationFlow "approval" has no effect while allowRegistration is false',
    );
  }
}

function checkNavigation(
  groups: readonly NavGroup[],
  flags: Set<string>,
  problems: string[],
): void {
  const ids = new Set<string>();
  const at = (where: string, message: string) =>
    problems.push(`navigation.config.ts › ${where}: ${message}`);
  const checkFlag = (where: string, flag: FeatureFlag | undefined) => {
    if (flag !== undefined && !flags.has(flag)) at(where, `unknown featureFlag "${flag}"`);
  };
  const checkItem = (item: NavItem, depth: number) => {
    const where = `item "${item.id}"`;
    if (ids.has(item.id)) at(where, 'duplicate id (ids must be unique across the navigation)');
    ids.add(item.id);
    if (!item.title.trim()) at(where, 'title is empty');
    if (item.icon !== undefined && !isIconName(item.icon))
      at(where, `unknown icon "${item.icon}" (add it to config/icons.ts)`);
    if (item.path === undefined && !item.children?.length) at(where, 'needs a path or children');
    if (item.path !== undefined) {
      if (item.external && !isHttpUrl(item.path)) at(where, 'external items need an http(s) URL');
      if (!item.external && !item.path.startsWith('/'))
        at(where, 'internal paths start with "/" (use config/paths.ts)');
    }
    if (item.children?.length && depth > 0) at(where, 'only one nested level is supported');
    checkFlag(where, item.featureFlag);
    for (const child of item.children ?? []) checkItem(child, depth + 1);
  };
  for (const group of groups) {
    if (ids.has(group.id)) at(`group "${group.id}"`, 'duplicate id');
    ids.add(group.id);
    if (group.items.length === 0) at(`group "${group.id}"`, 'has no items');
    checkFlag(`group "${group.id}"`, group.featureFlag);
    for (const item of group.items) checkItem(item, 0);
  }
}

function checkLayout(layout: LayoutConfig, problems: string[]): void {
  const at = (field: string, message: string) =>
    problems.push(`layout.config.ts › ${field}: ${message}`);
  const { sidebar, navbar } = layout;
  if (sidebar.width < 180 || sidebar.width > 400) at('sidebar.width', 'use 180–400 px');
  if (sidebar.collapsedWidth < 48 || sidebar.collapsedWidth >= sidebar.width) {
    at('sidebar.collapsedWidth', 'use at least 48 px and less than sidebar.width');
  }
  if (sidebar.defaultCollapsed && !sidebar.collapsible)
    at('sidebar.defaultCollapsed', 'requires collapsible: true');
  if (navbar.height < 40 || navbar.height > 120) at('navbar.height', 'use 40–120 px');
  if (!sidebar.enabled && !navbar.enabled)
    at('sidebar / navbar', 'disabling both leaves no navigation');
  const actionIds = new Set<string>();
  for (const action of navbar.customActions) {
    if (actionIds.has(action.id)) at(`navbar.customActions "${action.id}"`, 'duplicate id');
    actionIds.add(action.id);
    if (!isIconName(action.icon))
      at(`navbar.customActions "${action.id}"`, `unknown icon "${action.icon}"`);
    if (action.external ? !isHttpUrl(action.href) : !action.href.startsWith('/')) {
      at(
        `navbar.customActions "${action.id}"`,
        'href must be "/…" or an http(s) URL when external',
      );
    }
  }
  if (
    layout.auth.variant === 'split' &&
    layout.auth.sideImage !== null &&
    !isAsset(layout.auth.sideImage)
  ) {
    at('auth.sideImage', 'must start with "/" or be an https URL');
  }
}

function checkTheme(theme: ThemeConfig, presets: readonly ThemePreset[], problems: string[]): void {
  const at = (field: string, message: string) =>
    problems.push(`theme.config.ts › ${field}: ${message}`);
  const registered = new Set(presets.map((p) => p.id));
  if (registered.size !== presets.length) problems.push('theme.presets.ts: duplicate preset id');
  if (!COLOR_MODES.includes(theme.defaults.mode))
    at('defaults.mode', `"${theme.defaults.mode}" is not light / dark / system`);
  if (!registered.has(theme.defaults.preset))
    at('defaults.preset', `"${theme.defaults.preset}" is not registered in theme.presets.ts`);
  for (const id of theme.presets) {
    if (!registered.has(id)) at('presets', `"${id}" is not registered in theme.presets.ts`);
  }
  if (theme.presets.length > 0 && !theme.presets.includes(theme.defaults.preset)) {
    at('presets', 'must include the default preset');
  }
  for (const option of Object.keys(APPEARANCE_VALUES) as AppearanceOption[]) {
    const allowed: readonly string[] = APPEARANCE_VALUES[option];
    if (!allowed.includes(theme.defaults.appearance[option])) {
      at(
        `defaults.appearance.${option}`,
        `"${theme.defaults.appearance[option]}" is not one of ${allowed.join(', ')}`,
      );
    }
  }
  for (const option of theme.userCustomizable.appearance) {
    if (!(option in APPEARANCE_VALUES))
      at('userCustomizable.appearance', `unknown option "${option}"`);
  }
}

export function validateConfig(config: ConfigSet): string[] {
  const problems: string[] = [];
  checkApp(config.app, problems);
  checkFeatures(config.features, problems);
  checkNavigation(
    [...config.navigation, config.navigationFooter],
    featureFlags(config.features),
    problems,
  );
  checkLayout(config.layout, problems);
  checkTheme(config.theme, config.presets, problems);
  return problems;
}
