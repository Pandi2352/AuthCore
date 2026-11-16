import * as Joi from 'joi';

import { Environment } from '@common/enums/environment.enum';

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
  APP_NAME: Joi.string().max(50).default('AuthCore'),
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
  // HMAC key for stored OTP / link-token hashes. Random, 32+ characters.
  VERIFICATION_TOKEN_SECRET: Joi.string()
    .min(32)
    .when('REGISTRATION_EMAIL_VERIFICATION', {
      is: 'none',
      then: Joi.optional(),
      otherwise: Joi.required(),
    }),

  // Login (optional)
  // Which identifiers can sign in: "email", "username" or "email,username".
  LOGIN_IDENTIFIERS: Joi.string()
    .pattern(/^(email|username)(,(email|username))?$/)
    .default('email,username'),
  LOGIN_MAX_FAILED_ATTEMPTS: Joi.number().integer().min(3).max(20).default(5),
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
  JWT_ACCESS_TTL_SECONDS: Joi.number().integer().min(60).max(3600).default(900),
  JWT_ISSUER: Joi.string().max(100).default('authcore'),
  JWT_AUDIENCE: Joi.string().max(100).default('authcore-api'),

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
    .default('authcore_refresh'),
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
  MAIL_FROM: Joi.string()
    .max(254)
    .when('MAIL_TRANSPORT', {
      is: 'smtp',
      then: Joi.required(),
      otherwise: Joi.string().default('AuthCore <no-reply@localhost>'),
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
