import { appConfig } from './app.config';
import { env } from './env';

export interface ProjectBranding {
  primaryColor: string;
  logoUrl: string | null;
  companyName: string | null;
  supportEmail: string | null;
  websiteUrl: string | null;
}

export interface ProjectFeatures {
  allowRegistration: boolean;
  registrationFlow: 'otp' | 'link' | 'none' | 'approval';
  loginIdentifiers: ('email' | 'username')[];
  enableRememberMe: boolean;
  enableSessionsPage: boolean;
  enableActivityPage: boolean;
  enablePreferencesPage: boolean;
  enableSelfRecovery: boolean;
  enableAdminPanel: boolean;
}

export interface ProjectConfig {
  name: string;
  slug: string;
  description: string;
  defaultLanguage: string;
  apiBaseUrl: string;
  branding: ProjectBranding;
  features: ProjectFeatures;
}

/** Identity comes from app.config.ts, the API URL from env.ts; auth-flow toggles live here (split further in Level 1 · module 2). */
export const projectConfig: ProjectConfig = {
  name: appConfig.name,
  slug: appConfig.slug,
  description: appConfig.description,
  defaultLanguage: appConfig.defaultLanguage,
  apiBaseUrl: env.apiBaseUrl,
  branding: appConfig.branding,
  features: {
    allowRegistration: true,
    registrationFlow: 'otp', // 'otp' | 'link' | 'none' | 'approval'
    loginIdentifiers: ['email', 'username'],
    enableRememberMe: true,
    enableSessionsPage: true,
    enableActivityPage: true,
    enablePreferencesPage: true,
    enableSelfRecovery: true,
    enableAdminPanel: true,
  },
};
