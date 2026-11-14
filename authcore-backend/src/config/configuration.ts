import { ConfigModuleOptions, registerAs } from '@nestjs/config';

import { Environment } from '@common/enums/environment.enum';

import { envValidationSchema } from './validation';

/*
 * This folder is the only place allowed to read process.env (enforced by ESLint).
 * Everywhere else, inject the typed config, e.g.:
 *   constructor(@Inject(appConfig.KEY) private readonly app: ConfigType<typeof appConfig>) {}
 *
 * Values are read after Joi validation, which fills in defaults, so required
 * keys are guaranteed to exist here.
 */

const env = (key: string): string => process.env[key] ?? '';

const ENVIRONMENTS: readonly string[] = Object.values(Environment);

function isEnvironment(value: string): value is Environment {
  return ENVIRONMENTS.includes(value);
}

/** Narrows a validated NODE_ENV string to the Environment enum. */
function toEnvironment(value: string): Environment {
  return isEnvironment(value) ? value : Environment.Development;
}

export const appConfig = registerAs('app', () => {
  const nodeEnv = toEnvironment(env('NODE_ENV'));
  return {
    nodeEnv,
    isProduction: nodeEnv === Environment.Production,
    port: Number(env('PORT')),
    apiPrefix: env('API_PREFIX'),
    corsOrigins: env('CORS_ORIGIN')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  };
});

export const databaseConfig = registerAs('database', () => ({
  uri: env('MONGODB_URI'),
  maxPoolSize: Number(env('MONGODB_MAX_POOL_SIZE')),
  minPoolSize: Number(env('MONGODB_MIN_POOL_SIZE')),
  serverSelectionTimeoutMS: Number(env('MONGODB_SERVER_SELECTION_TIMEOUT_MS')),
  connectTimeoutMS: Number(env('MONGODB_CONNECT_TIMEOUT_MS')),
  socketTimeoutMS: Number(env('MONGODB_SOCKET_TIMEOUT_MS')),
  retryAttempts: Number(env('MONGODB_RETRY_ATTEMPTS')),
  retryDelayMS: Number(env('MONGODB_RETRY_DELAY_MS')),
  autoIndex: env('MONGODB_AUTO_INDEX') === 'true',
  queryTimeoutMS: Number(env('MONGODB_QUERY_TIMEOUT_MS')),
}));

export const securityConfig = registerAs('security', () => ({
  bodyLimit: env('BODY_LIMIT'),
  throttleTtlMs: Number(env('THROTTLE_TTL_MS')),
  throttleLimit: Number(env('THROTTLE_LIMIT')),
  requestTimeoutMs: Number(env('REQUEST_TIMEOUT_MS')),
  trustProxyHops: Number(env('TRUST_PROXY_HOPS')),
}));

export const lifecycleConfig = registerAs('lifecycle', () => ({
  shutdownTimeoutMs: Number(env('SHUTDOWN_TIMEOUT_MS')),
  drainDelayMs: Number(env('SHUTDOWN_DRAIN_DELAY_MS')),
  healthDbTimeoutMs: Number(env('HEALTH_DB_TIMEOUT_MS')),
}));

export const performanceConfig = registerAs('performance', () => ({
  handlerTimeoutMs: Number(env('HANDLER_TIMEOUT_MS')),
  isCompressionEnabled: env('COMPRESSION_ENABLED') === 'true',
  compressionThresholdBytes: Number(env('COMPRESSION_THRESHOLD_BYTES')),
}));

export const loggingConfig = registerAs('logging', () => ({
  level: env('LOG_LEVEL'),
  format:
    env('LOG_FORMAT') === 'json' ? ('json' as const) : ('pretty' as const),
  isHttpRequestLoggingEnabled: env('LOG_HTTP_REQUESTS') === 'true',
  isFileEnabled: env('LOG_FILE_ENABLED') === 'true',
  directory: env('LOG_DIR'),
  maxFileSize: env('LOG_FILE_MAX_SIZE'),
  maxFiles: env('LOG_FILE_MAX_FILES'),
}));

export const swaggerConfig = registerAs('swagger', () => ({
  enabled: env('SWAGGER_ENABLED') === 'true',
  path: env('SWAGGER_PATH'),
}));

const nodeEnv = process.env.NODE_ENV ?? Environment.Development;

export const configModuleOptions: ConfigModuleOptions = {
  isGlobal: true,
  cache: true,
  // First file wins; real environment variables always override files.
  envFilePath: [`.env.${nodeEnv}`, '.env'],
  load: [
    appConfig,
    databaseConfig,
    securityConfig,
    lifecycleConfig,
    performanceConfig,
    loggingConfig,
    swaggerConfig,
  ],
  validationSchema: envValidationSchema,
  validationOptions: {
    abortEarly: false,
    allowUnknown: true,
  },
};
