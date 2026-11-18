import * as Joi from 'joi';

import { Environment } from '@common/enums/environment.enum';

import { PROJECT, PROJECT_KEY } from './project';

const originSchema = Joi.string().uri({ scheme: ['http', 'https'] });

/**
 * CORS_ORIGIN is a comma-separated allowlist. A wildcard is rejected so the
 * API can never be opened to every origin by configuration mistake.
 */
const corsOriginList = Joi.string().custom((value: string, helpers) => {
  const origins = value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (origins.length === 0) {
    return helpers.message({
      custom: '"CORS_ORIGIN" must list at least one origin',
    });
  }

  for (const origin of origins) {
    if (origin === '*') {
      return helpers.message({
        custom: '"CORS_ORIGIN" must not be "*"; list explicit origins',
      });
    }
    if (originSchema.validate(origin).error) {
      return helpers.message({
        custom: `"CORS_ORIGIN" contains an invalid origin: ${origin}`,
      });
    }
  }

  return value;
});

export const envValidationSchema = Joi.object({
  // Optional (have safe defaults)
  NODE_ENV: Joi.string()
    .valid(...Object.values(Environment))
    .default(Environment.Development),
  PORT: Joi.number().port().default(3000),
  // Lowercase path segments without leading/trailing slashes, e.g. "api".
  // The version (v1) is added by URI versioning, so don't include it here.
  API_PREFIX: Joi.string()
    .pattern(/^[a-z0-9-]+(\/[a-z0-9-]+)*$/)
    .default('api'),
  // Swagger is allowed in development and staging only.
  SWAGGER_ENABLED: Joi.boolean()
    .default(false)
    .when('NODE_ENV', {
      is: Environment.Production,
      then: Joi.valid(false).messages({
        'any.only': '"SWAGGER_ENABLED" must be false in production',
      }),
    }),
  SWAGGER_PATH: Joi.string()
    .pattern(/^[a-z0-9-]+(\/[a-z0-9-]+)*$/)
    .default('api/docs'),

  // Security (optional)
  BODY_LIMIT: Joi.string()
    .pattern(/^\d+(b|kb|mb)$/)
    .default('100kb'),
  THROTTLE_TTL_MS: Joi.number().integer().min(1000).default(60000),
  THROTTLE_LIMIT: Joi.number().integer().min(1).default(100),
  REQUEST_TIMEOUT_MS: Joi.number().integer().min(5000).default(30000),
  // Number of reverse proxies in front of the app (0 = none). Needed for the
  // real client IP in rate limiting. Never trust more hops than you have.
  TRUST_PROXY_HOPS: Joi.number().integer().min(0).max(10).default(0),

  // Password hashing: Argon2id (optional). Defaults = OWASP minimum
  // (19 MiB, 2 iterations, 1 lane); lower values are rejected.
  ARGON2_MEMORY_KIB: Joi.number().integer().min(19456).default(19456),
  ARGON2_TIME_COST: Joi.number().integer().min(2).default(2),
  ARGON2_PARALLELISM: Joi.number().integer().min(1).max(16).default(1),

  // Registration flow (optional; defaults = email OTP, no approval)
  APP_NAME: Joi.string().max(50).default(PROJECT.name),
  REGISTRATION_EMAIL_VERIFICATION: Joi.string()
    .valid('none', 'otp', 'link')
    .default('otp'),
  REGISTRATION_REQUIRE_APPROVAL: Joi.boolean().default(false),
  EMAIL_OTP_LENGTH: Joi.number().integer().min(6).max(8).default(6),
  EMAIL_OTP_TTL_MINUTES: Joi.number().integer().min(1).max(60).default(10),
  EMAIL_LINK_TTL_MINUTES: Joi.number().integer().min(5).max(1440).default(60),
  EMAIL_VERIFICATION_MAX_ATTEMPTS: Joi.number()
    .integer()
    .min(3)
    .max(10)
    .default(5),
  EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS: Joi.number()
    .integer()
    .min(30)
    .max(3600)
    .default(60),
  // Frontend page that receives ?token=... and POSTs it to the API.
  EMAIL_VERIFICATION_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .when('REGISTRATION_EMAIL_VERIFICATION', {
      is: 'link',
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),
  // HMAC key for stored OTP / link-token hashes (email verification and
  // password reset). Random, 32+ characters.
  VERIFICATION_TOKEN_SECRET: Joi.string().min(32).required(),

  // Password reset (optional)
  // otp = 6-digit code by email; link = reset link by email
  PASSWORD_RESET_METHOD: Joi.string().valid('otp', 'link').default('otp'),
  PASSWORD_RESET_TTL_MINUTES: Joi.number().integer().min(5).max(60).default(15),
  PASSWORD_RESET_MAX_ATTEMPTS: Joi.number().integer().min(3).max(10).default(5),
  PASSWORD_RESET_RESEND_COOLDOWN_SECONDS: Joi.number()
    .integer()
    .min(30)
    .max(3600)
    .default(60),
  // Validity of the reset token returned after a successful code / link check.
  PASSWORD_RESET_AUTH_TTL_MINUTES: Joi.number()
    .integer()
    .min(1)
    .max(30)
    .default(10),
  // Frontend page for reset links (required when PASSWORD_RESET_METHOD=link).
  PASSWORD_RESET_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .when('PASSWORD_RESET_METHOD', {
      is: 'link',
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),
  // Scheduled jobs (password expiry reminders). Every instance polls; a database
  // lock makes each run happen once. Set false on instances that must not run jobs.
  SCHEDULER_ENABLED: Joi.boolean().default(true),
  // Access control: members of a sub-group also get the roles of its parent groups.
  ACCESS_INHERIT_PARENT_GROUPS: Joi.boolean().default(false),

  // Account self-service: email-change / recovery codes, deletion grace period
  ACCOUNT_CODE_TTL_MINUTES: Joi.number().integer().min(5).max(60).default(15),
  ACCOUNT_CODE_MAX_ATTEMPTS: Joi.number().integer().min(3).max(10).default(5),
  ACCOUNT_CODE_RESEND_COOLDOWN_SECONDS: Joi.number()
    .integer()
    .min(30)
    .max(3600)
    .default(60),
  // Days between "delete my account" and the permanent purge (0 = next purge run)
  ACCOUNT_DELETION_GRACE_DAYS: Joi.number()
    .integer()
    .min(0)
    .max(90)
    .default(14),
  ACCOUNT_PURGE_INTERVAL_MINUTES: Joi.number()
    .integer()
    .min(1)
    .max(1440)
    .default(60),
  // Account activity history (sign-ins, password changes, …) is kept this long
  USER_ACTIVITY_RETENTION_DAYS: Joi.number()
    .integer()
    .min(1)
    .max(3650)
    .default(90),

  // Prometheus metrics at /api/v1/metrics
  METRICS_ENABLED: Joi.boolean().truthy('true').falsy('false').default(true),
  // Scrapers send "Authorization: Bearer <token>". Empty: open in development, disabled in production
  METRICS_TOKEN: Joi.string().allow('').min(16).default(''),

  // First administrator (created at startup if this email doesn't exist; never overwritten)
  BOOTSTRAP_ADMIN_ENABLED: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .default(true),
  BOOTSTRAP_ADMIN_EMAIL: Joi.string()
    .trim()
    .lowercase()
    .email({ tlds: { allow: false } })
    .allow('')
    .default(''),
  // Must satisfy the password policy; required together with the email
  BOOTSTRAP_ADMIN_PASSWORD: Joi.string()
    .allow('')
    .default('')
    .when('BOOTSTRAP_ADMIN_EMAIL', {
      is: Joi.string().min(1),
      then: Joi.string().min(8).required(),
    }),
  BOOTSTRAP_ADMIN_FIRST_NAME: Joi.string()
    .trim()
    .min(1)
    .max(50)
    .default('System'),
  BOOTSTRAP_ADMIN_LAST_NAME: Joi.string()
    .trim()
    .max(50)
    .allow('')
    .default('Admin'),
  // true = the admin must choose a new password at first sign-in (recommended)
  BOOTSTRAP_ADMIN_MUST_CHANGE_PASSWORD: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .default(true),

  // Security notifications
  // Email the user when they sign in from a device (browser + OS) not seen before
  NEW_DEVICE_ALERTS_ENABLED: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .default(true),
  // Email the user when too many failed sign-ins lock their account
  ACCOUNT_LOCKED_EMAIL_ENABLED: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .default(true),
  // A device unused for this long counts as new again
  KNOWN_DEVICE_RETENTION_DAYS: Joi.number()
    .integer()
    .min(1)
    .max(3650)
    .default(180),

  // File uploads (local folder storage; more drivers can be added later)
  STORAGE_DRIVER: Joi.string().valid('local').default('local'),
  // Relative to the working directory (inside the project) or absolute
  STORAGE_LOCAL_DIR: Joi.string().trim().min(1).default('uploads'),
  // Base URL of public files (avatars): <base>/<fileId>
  FILES_PUBLIC_BASE_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .default('http://localhost:3000/api/v1/files/public'),
  // Encrypts storage credentials saved on Settings → File storage. Empty = derived from
  // JWT_ACCESS_SECRET (changing that secret then means re-entering the keys).
  STORAGE_SECRETS_KEY: Joi.string().min(32).allow('').default(''),
  UPLOAD_MAX_FILE_SIZE_MB: Joi.number().min(1).max(100).default(10),
  UPLOAD_AVATAR_MAX_SIZE_MB: Joi.number().min(0.1).max(20).default(2),
  // Orphan cleanup: stored bytes without a record (crashes, failed deletes). 0 = off
  FILES_ORPHAN_CLEANUP_INTERVAL_HOURS: Joi.number()
    .integer()
    .min(0)
    .max(720)
    .default(24),
  // Never touch files younger than this (uploads in progress)
  FILES_ORPHAN_GRACE_MINUTES: Joi.number()
    .integer()
    .min(1)
    .max(10080)
    .default(60),
  UPLOAD_MAX_FILES_PER_USER: Joi.number()
    .integer()
    .min(1)
    .max(100000)
    .default(200),

  // Uploaded images are re-encoded: auto-rotated, metadata (EXIF / GPS) removed, resized
  IMAGE_AVATAR_SIZE: Joi.number().integer().min(64).max(2048).default(512),
  IMAGE_MAX_DIMENSION: Joi.number().integer().min(256).max(16384).default(4096),
  IMAGE_QUALITY: Joi.number().integer().min(40).max(100).default(85),
  // Decompression-bomb guard: larger images are rejected before decoding
  IMAGE_MAX_INPUT_PIXELS: Joi.number()
    .integer()
    .min(1_000_000)
    .max(268_402_689)
    .default(50_000_000),

  // Virus scanning of uploads with ClamAV (clamd over TCP)
  VIRUS_SCAN_ENABLED: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .default(false),
  CLAMAV_HOST: Joi.string().trim().min(1).default('127.0.0.1'),
  CLAMAV_PORT: Joi.number().port().default(3310),
  CLAMAV_TIMEOUT_MS: Joi.number()
    .integer()
    .min(1000)
    .max(120_000)
    .default(15_000),
  // true = reject uploads while the scanner is unreachable; false = accept them unscanned (logged)
  VIRUS_SCAN_FAIL_CLOSED: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .default(true),

  // User invites
  INVITE_ACCEPT_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .default('http://localhost:5173/accept-invite'),
  INVITE_TTL_DAYS: Joi.number().integer().min(1).max(30).default(7),
  INVITE_RESEND_COOLDOWN_SECONDS: Joi.number()
    .integer()
    .min(30)
    .max(3600)
    .default(60),
  SCHEDULER_POLL_SECONDS: Joi.number().integer().min(5).max(300).default(30),

  // Login (optional)
  // Which identifiers can sign in: "email", "username" or "email,username".
  LOGIN_IDENTIFIERS: Joi.string()
    .pattern(/^(email|username)(,(email|username))?$/)
    .default('email,username'),
  // Failures per account + IP address: that IP is locked out of the account (others are not)
  LOGIN_MAX_FAILED_ATTEMPTS: Joi.number().integer().min(3).max(20).default(5),
  // Failures from all IPs together: the whole account locks (distributed attacks)
  LOGIN_MAX_FAILED_ATTEMPTS_PER_ACCOUNT: Joi.number()
    .integer()
    .min(Joi.ref('LOGIN_MAX_FAILED_ATTEMPTS'))
    .max(1000)
    .default(50),
  LOGIN_FAILED_ATTEMPTS_WINDOW_MINUTES: Joi.number()
    .integer()
    .min(1)
    .max(1440)
    .default(15),
  LOGIN_LOCKOUT_MINUTES: Joi.number().integer().min(1).max(1440).default(15),
  MAX_SESSIONS_PER_USER: Joi.number().integer().min(1).max(100).default(10),

  // Access token (JWT, HS256)
  JWT_ACCESS_SECRET: Joi.string()
    .min(32)
    .required()
    .invalid(Joi.ref('VERIFICATION_TOKEN_SECRET'))
    .messages({
      'any.invalid':
        '"JWT_ACCESS_SECRET" must be different from VERIFICATION_TOKEN_SECRET',
    }),
  // Key rotation: put the old JWT_ACCESS_SECRET here (comma-separated) for one access-token
  // lifetime after switching, so tokens issued before the switch keep working until they expire
  JWT_ACCESS_PREVIOUS_SECRETS: Joi.string()
    .allow('')
    .default('')
    .custom((value: string, helpers) =>
      value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .every((s) => s.length >= 32)
        ? value
        : helpers.message({
            custom:
              '"JWT_ACCESS_PREVIOUS_SECRETS" entries must be at least 32 characters',
          }),
    ),
  JWT_ACCESS_TTL_SECONDS: Joi.number().integer().min(60).max(3600).default(900),
  JWT_ISSUER: Joi.string().max(100).default(PROJECT.slug),
  JWT_AUDIENCE: Joi.string().max(100).default(`${PROJECT.slug}-api`),

  // Refresh token / session
  REFRESH_TOKEN_TTL_DAYS: Joi.number().integer().min(1).max(90).default(7),
  REFRESH_TOKEN_REMEMBER_ME_TTL_DAYS: Joi.number()
    .integer()
    .min(1)
    .max(365)
    .default(30),
  // A just-rotated refresh token is still accepted this long (parallel
  // refreshes from several tabs); after that, reuse revokes the session.
  REFRESH_TOKEN_REUSE_GRACE_SECONDS: Joi.number()
    .integer()
    .min(0)
    .max(60)
    .default(10),
  // cookie = HttpOnly cookie (browsers); body = in the JSON response (mobile apps); both
  REFRESH_TOKEN_DELIVERY: Joi.string()
    .valid('cookie', 'body', 'both')
    .default('cookie'),
  REFRESH_COOKIE_NAME: Joi.string()
    .pattern(/^[A-Za-z0-9_-]{1,64}$/)
    .default(`${PROJECT_KEY}_refresh`),
  REFRESH_COOKIE_SAMESITE: Joi.string()
    .valid('strict', 'lax', 'none')
    .default('strict'),
  REFRESH_COOKIE_SECURE: Joi.boolean()
    .default(true)
    .when('NODE_ENV', {
      is: Environment.Production,
      then: Joi.boolean().invalid(false).messages({
        'any.invalid': '"REFRESH_COOKIE_SECURE" must be true in production',
      }),
    })
    .when('REFRESH_COOKIE_SAMESITE', {
      is: 'none',
      then: Joi.boolean().invalid(false).messages({
        'any.invalid':
          '"REFRESH_COOKIE_SECURE" must be true when REFRESH_COOKIE_SAMESITE=none',
      }),
    }),
  REFRESH_COOKIE_DOMAIN: Joi.string().hostname().optional(),

  // Mail (optional in development: emails go to a local outbox folder)
  MAIL_TRANSPORT: Joi.string()
    .valid('outbox', 'smtp')
    .when('NODE_ENV', {
      is: Environment.Development,
      then: Joi.string().default('outbox'),
      otherwise: Joi.string().default('smtp'),
    })
    .when('NODE_ENV', {
      is: Environment.Production,
      then: Joi.invalid('outbox').messages({
        'any.invalid': '"MAIL_TRANSPORT" must be smtp in production',
      }),
    }),
  MAIL_OUTBOX_DIR: Joi.string().default('mail-outbox'),
  // Language of emails to people without an account yet (invites): en, ta, hi (others fall back to en)
  MAIL_DEFAULT_LANGUAGE: Joi.string()
    .trim()
    .pattern(/^[a-z]{2,3}(-[A-Za-z]{2})?$/)
    .default(PROJECT.defaultLanguage),
  MAIL_FROM: Joi.string()
    .max(254)
    .when('MAIL_TRANSPORT', {
      is: 'smtp',
      then: Joi.required(),
      otherwise: Joi.string().default(`${PROJECT.name} <no-reply@localhost>`),
    }),
  SMTP_HOST: Joi.string().hostname().when('MAIL_TRANSPORT', {
    is: 'smtp',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  SMTP_PORT: Joi.number().port().default(587),
  // true = TLS from the start (port 465); false = STARTTLS upgrade (587).
  SMTP_SECURE: Joi.boolean().default(false),
  SMTP_USER: Joi.string().allow('').optional(),
  SMTP_PASSWORD: Joi.string().allow('').optional(),

  // Lifecycle (optional)
  SHUTDOWN_TIMEOUT_MS: Joi.number().integer().min(1000).default(10000),
  // Time between "readiness fails" and "server stops accepting connections",
  // so load balancers stop routing traffic first. 0 in development.
  SHUTDOWN_DRAIN_DELAY_MS: Joi.number()
    .integer()
    .min(0)
    .less(Joi.ref('SHUTDOWN_TIMEOUT_MS'))
    .when('NODE_ENV', {
      is: Environment.Development,
      then: Joi.number().default(0),
      otherwise: Joi.number().default(5000),
    }),
  HEALTH_DB_TIMEOUT_MS: Joi.number().integer().min(100).default(1500),

  // Performance (optional)
  HANDLER_TIMEOUT_MS: Joi.number().integer().min(1000).default(15000),
  COMPRESSION_ENABLED: Joi.boolean().default(true),
  COMPRESSION_THRESHOLD_BYTES: Joi.number().integer().min(0).default(1024),
  MONGODB_QUERY_TIMEOUT_MS: Joi.number().integer().min(100).default(10000),

  // Logging (optional)
  LOG_LEVEL: Joi.string()
    .valid('fatal', 'error', 'warn', 'info', 'verbose', 'debug')
    .when('NODE_ENV', {
      is: Environment.Development,
      then: Joi.string().default('debug'),
      otherwise: Joi.string().default('info'),
    }),
  LOG_FORMAT: Joi.string()
    .valid('json', 'pretty')
    .when('NODE_ENV', {
      is: Environment.Development,
      then: Joi.string().default('pretty'),
      otherwise: Joi.string().default('json'),
    }),
  LOG_HTTP_REQUESTS: Joi.boolean().default(true),
  LOG_FILE_ENABLED: Joi.boolean().default(false),
  LOG_DIR: Joi.string().default('logs'),
  LOG_FILE_MAX_SIZE: Joi.string()
    .pattern(/^\d+[kmg]$/)
    .default('20m'),
  LOG_FILE_MAX_FILES: Joi.string()
    .pattern(/^\d+d?$/)
    .default('14d'),

  // MongoDB tuning (optional)
  MONGODB_MAX_POOL_SIZE: Joi.number().integer().min(1).max(500).default(10),
  MONGODB_MIN_POOL_SIZE: Joi.number()
    .integer()
    .min(0)
    .max(Joi.ref('MONGODB_MAX_POOL_SIZE'))
    .default(0),
  MONGODB_SERVER_SELECTION_TIMEOUT_MS: Joi.number()
    .integer()
    .min(1000)
    .default(5000),
  MONGODB_CONNECT_TIMEOUT_MS: Joi.number().integer().min(1000).default(10000),
  MONGODB_SOCKET_TIMEOUT_MS: Joi.number().integer().min(1000).default(45000),
  MONGODB_RETRY_ATTEMPTS: Joi.number().integer().min(0).max(20).default(5),
  MONGODB_RETRY_DELAY_MS: Joi.number().integer().min(100).default(3000),
  // Index builds on startup: on by default except in production.
  MONGODB_AUTO_INDEX: Joi.boolean().when('NODE_ENV', {
    is: Environment.Production,
    then: Joi.boolean().default(false),
    otherwise: Joi.boolean().default(true),
  }),

  // Required (startup fails without them)
  MONGODB_URI: Joi.string()
    .uri({ scheme: ['mongodb', 'mongodb+srv'] })
    .required(),
  CORS_ORIGIN: corsOriginList.required(),
});
