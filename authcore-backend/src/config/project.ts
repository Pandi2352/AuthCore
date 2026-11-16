import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import * as Joi from 'joi';

/**
 * Project identity: project.config.json next to package.json (or
 * PROJECT_CONFIG_PATH). Copying AuthCore for another project means changing
 * this one file (npm run project:init); everything below is derived from it
 * unless an environment variable overrides it (APP_NAME, JWT_ISSUER, …).
 * No secrets here: those stay in .env.
 */
export interface ProjectConfig {
  /** Display name: emails, Swagger, logs. */
  name: string;
  /** Machine name: lowercase, digits, "-". Used for prefixes, cookie, issuer. */
  slug: string;
  description: string;
  /** Email language for people without an account (MAIL_DEFAULT_LANGUAGE overrides). */
  defaultLanguage: string;
  branding: {
    /** Email header / button color (#rrggbb). */
    primaryColor: string;
    /** https URL of a logo shown at the top of emails. */
    logoUrl: string | null;
    companyName: string | null;
    /** Shown in email footers ("Need help? …"). */
    supportEmail: string | null;
    websiteUrl: string | null;
  };
}

const DEFAULTS: ProjectConfig = {
  name: 'AuthCore',
  slug: 'authcore',
  description: 'Reusable authentication and authorization service',
  defaultLanguage: 'en',
  branding: {
    primaryColor: '#4f46e5',
    logoUrl: null,
    companyName: null,
    supportEmail: null,
    websiteUrl: null,
  },
};

const SCHEMA = Joi.object({
  $schema: Joi.string().optional().strip(),
  name: Joi.string().trim().min(1).max(50).required(),
  slug: Joi.string()
    .pattern(/^[a-z][a-z0-9-]{1,30}[a-z0-9]$/)
    .required()
    .messages({
      'string.pattern.base':
        '"slug" must be lowercase letters, digits and "-" (3–32 characters), e.g. "shop-x"',
    }),
  description: Joi.string().trim().max(300).allow('').default(''),
  defaultLanguage: Joi.string()
    .pattern(/^[a-z]{2,3}(-[A-Z]{2})?$/)
    .default('en'),
  branding: Joi.object({
    primaryColor: Joi.string()
      .pattern(/^#[0-9a-fA-F]{6}$/)
      .default(DEFAULTS.branding.primaryColor),
    logoUrl: Joi.string()
      .uri({ scheme: ['https'] })
      .allow(null)
      .default(null),
    companyName: Joi.string().trim().max(100).allow(null).default(null),
    supportEmail: Joi.string()
      .email({ tlds: { allow: false } })
      .allow(null)
      .default(null),
    websiteUrl: Joi.string()
      .uri({ scheme: ['http', 'https'] })
      .allow(null)
      .default(null),
  }).default(DEFAULTS.branding),
});

function loadProject(): ProjectConfig {
  const file = resolve(
    process.env.PROJECT_CONFIG_PATH ??
      resolve(process.cwd(), 'project.config.json'),
  );
  if (!existsSync(file)) {
    return DEFAULTS;
  }
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(
      `${file} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const { value, error } = SCHEMA.validate(raw, { abortEarly: false }) as {
    value: ProjectConfig;
    error?: Joi.ValidationError;
  };
  if (error) {
    throw new Error(
      `Invalid ${file}: ${error.details.map((d) => d.message).join('; ')}`,
    );
  }
  return value;
}

export const PROJECT: Readonly<ProjectConfig> = Object.freeze(loadProject());

/** slug with "_" instead of "-" (cookie names, metric prefixes). */
export const PROJECT_KEY = PROJECT.slug.replace(/-/g, '_');
