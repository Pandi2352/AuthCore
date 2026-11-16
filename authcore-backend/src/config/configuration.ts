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
  argon2MemoryKib: Number(env('ARGON2_MEMORY_KIB')),
  argon2TimeCost: Number(env('ARGON2_TIME_COST')),
  argon2Parallelism: Number(env('ARGON2_PARALLELISM')),
}));

export type EmailVerificationMethod = 'none' | 'otp' | 'link';

function toEmailVerificationMethod(value: string): EmailVerificationMethod {
  return value === 'otp' || value === 'link' ? value : 'none';
}

export const registrationConfig = registerAs('registration', () => ({
  appName: env('APP_NAME'),
  emailVerification: toEmailVerificationMethod(
    env('REGISTRATION_EMAIL_VERIFICATION'),
  ),
  isApprovalRequired: env('REGISTRATION_REQUIRE_APPROVAL') === 'true',
  otpLength: Number(env('EMAIL_OTP_LENGTH')),
  otpTtlMinutes: Number(env('EMAIL_OTP_TTL_MINUTES')),
  linkTtlMinutes: Number(env('EMAIL_LINK_TTL_MINUTES')),
  maxAttempts: Number(env('EMAIL_VERIFICATION_MAX_ATTEMPTS')),
  resendCooldownSeconds: Number(
    env('EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS'),
  ),
  verificationUrl: env('EMAIL_VERIFICATION_URL'),
  tokenSecret: env('VERIFICATION_TOKEN_SECRET'),
}));

export type LoginIdentifier = 'email' | 'username';
export type RefreshTokenDelivery = 'cookie' | 'body' | 'both';
export type CookieSameSite = 'strict' | 'lax' | 'none';

function toRefreshTokenDelivery(value: string): RefreshTokenDelivery {
  return value === 'body' || value === 'both' ? value : 'cookie';
}

function toCookieSameSite(value: string): CookieSameSite {
  return value === 'lax' || value === 'none' ? value : 'strict';
}

export const authConfig = registerAs('auth', () => ({
  loginIdentifiers: env('LOGIN_IDENTIFIERS')
    .split(',')
    .filter(
      (value): value is LoginIdentifier =>
        value === 'email' || value === 'username',
    ),
  maxFailedAttempts: Number(env('LOGIN_MAX_FAILED_ATTEMPTS')),
  failedAttemptsWindowMinutes: Number(
    env('LOGIN_FAILED_ATTEMPTS_WINDOW_MINUTES'),
  ),
  lockoutMinutes: Number(env('LOGIN_LOCKOUT_MINUTES')),
  maxSessionsPerUser: Number(env('MAX_SESSIONS_PER_USER')),
  jwt: {
    secret: env('JWT_ACCESS_SECRET'),
    ttlSeconds: Number(env('JWT_ACCESS_TTL_SECONDS')),
    issuer: env('JWT_ISSUER'),
    audience: env('JWT_AUDIENCE'),
  },
  refreshToken: {
    ttlDays: Number(env('REFRESH_TOKEN_TTL_DAYS')),
    rememberMeTtlDays: Number(env('REFRESH_TOKEN_REMEMBER_ME_TTL_DAYS')),
    reuseGraceSeconds: Number(env('REFRESH_TOKEN_REUSE_GRACE_SECONDS')),
    delivery: toRefreshTokenDelivery(env('REFRESH_TOKEN_DELIVERY')),
    cookie: {
      name: env('REFRESH_COOKIE_NAME'),
      sameSite: toCookieSameSite(env('REFRESH_COOKIE_SAMESITE')),
      isSecure: env('REFRESH_COOKIE_SECURE') === 'true',
      domain: env('REFRESH_COOKIE_DOMAIN') || undefined,
    },
  },
}));

export const passwordResetConfig = registerAs('passwordReset', () => ({
  method:
    env('PASSWORD_RESET_METHOD') === 'link'
      ? ('link' as const)
      : ('otp' as const),
  ttlMinutes: Number(env('PASSWORD_RESET_TTL_MINUTES')),
  maxAttempts: Number(env('PASSWORD_RESET_MAX_ATTEMPTS')),
  resendCooldownSeconds: Number(env('PASSWORD_RESET_RESEND_COOLDOWN_SECONDS')),
  authorizationTtlMinutes: Number(env('PASSWORD_RESET_AUTH_TTL_MINUTES')),
  resetUrl: env('PASSWORD_RESET_URL'),
  tokenSecret: env('VERIFICATION_TOKEN_SECRET'),
}));

export const mailConfig = registerAs('mail', () => ({
  transport:
    env('MAIL_TRANSPORT') === 'smtp' ? ('smtp' as const) : ('outbox' as const),
  outboxDirectory: env('MAIL_OUTBOX_DIR'),
  from: env('MAIL_FROM'),
  smtp: {
    host: env('SMTP_HOST'),
    port: Number(env('SMTP_PORT')),
    isSecure: env('SMTP_SECURE') === 'true',
    user: env('SMTP_USER'),
    password: env('SMTP_PASSWORD'),
  },
}));

export const schedulerConfig = registerAs('scheduler', () => ({
  isEnabled: env('SCHEDULER_ENABLED') !== 'false',
  pollSeconds: Number(env('SCHEDULER_POLL_SECONDS')),
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
    registrationConfig,
    authConfig,
    passwordResetConfig,
    mailConfig,
    lifecycleConfig,
    schedulerConfig,
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
