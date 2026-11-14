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
