import type { FeatureFlag, FeaturesConfig } from '@/types/config.types';

/**
 * Feature toggles. `auth` must match the backend .env
 * (docs/new-project-guide.md, step 7).
 */
export const featuresConfig: FeaturesConfig = {
  ui: {
    themeSwitcher: true,
    themeCustomizer: true,
    globalSearch: false,
    commandMenu: false,
    notifications: false,
    breadcrumbs: true,
  },
  auth: {
    allowRegistration: true,
    registrationFlow: 'otp', // backend REGISTRATION_EMAIL_VERIFICATION=otp
    loginIdentifiers: ['email', 'username'], // backend LOGIN_IDENTIFIERS=email,username
    enableRememberMe: true,
    enableSelfRecovery: true,
    enableInvites: true,
  },
  account: {
    sessionsPage: true,
    activityPage: true,
    devicesPage: true,
    preferencesPage: true,
    dataExport: true,
    selfDeletion: true,
  },
  admin: {
    enabled: true,
  },
};

/** Value of a flag such as "ui.notifications" or "account.sessionsPage". */
export function isFeatureEnabled(
  flag: FeatureFlag,
  config: FeaturesConfig = featuresConfig,
): boolean {
  const [section, key] = flag.split('.') as [keyof FeaturesConfig, string];
  const value: unknown = (config[section] as Record<string, unknown>)[key];
  return value === true;
}
