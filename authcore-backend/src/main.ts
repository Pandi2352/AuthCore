import { Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import compression from 'compression';
import type { Request, Response } from 'express';
import helmet from 'helmet';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

import { DEFAULT_API_VERSION } from '@common/constants/api.constants';
import { logFilePattern } from '@common/logger/winston-options';
import { accessLogMiddleware } from '@common/middleware/access-log.middleware';
import { bodyParserErrorHandler } from '@common/middleware/body-parser-error.middleware';
import {
  REQUEST_ID_HEADER,
  requestIdMiddleware,
} from '@common/middleware/request-id.middleware';
import { ALLOWED_HTTP_METHODS } from '@common/middleware/security.middleware';
import { shutdownMiddleware } from '@common/middleware/shutdown.middleware';
import { applyApiRouting, setupSwagger } from '@common/swagger/setup-swagger';
import {
  appConfig,
  loggingConfig,
  performanceConfig,
  securityConfig,
  swaggerConfig,
} from '@config/configuration';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // Body parsing is registered below with explicit size limits.
    bodyParser: false,
    // Hold early logs until the Winston logger is ready.
    bufferLogs: true,
    // Reject on startup errors (handled below) instead of process.abort().
    abortOnError: false,
  });
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

  const logger = new Logger('Bootstrap');
  const { port, apiPrefix, corsOrigins, nodeEnv } = app.get<
    ConfigType<typeof appConfig>
  >(appConfig.KEY);
  const security = app.get<ConfigType<typeof securityConfig>>(
    securityConfig.KEY,
  );
  const logging = app.get<ConfigType<typeof loggingConfig>>(loggingConfig.KEY);
  const performance = app.get<ConfigType<typeof performanceConfig>>(
    performanceConfig.KEY,
  );
  const swagger = app.get<ConfigType<typeof swaggerConfig>>(swaggerConfig.KEY);

  // Real client IP behind proxies / load balancers (used by rate limiting).
  app.set('trust proxy', security.trustProxyHops);

  // Request id first, so every later step (and every log line) has it.
  app.use(requestIdMiddleware);
  if (logging.isHttpRequestLoggingEnabled) {
    app.use(accessLogMiddleware);
  }
  // During shutdown, ask keep-alive clients to reconnect elsewhere.
  app.use(shutdownMiddleware);

  // Security headers (CSP, HSTS, noSniff, frameguard, no X-Powered-By, ...).
  app.use(helmet());

  // CORS: explicit allowlist only ("*" is rejected by config validation).
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: [...ALLOWED_HTTP_METHODS],
    allowedHeaders: ['Content-Type', 'Authorization', REQUEST_ID_HEADER],
    exposedHeaders: [REQUEST_ID_HEADER, 'Retry-After'],
    maxAge: 600,
  });

  // gzip above the threshold. Responses marked Cache-Control: no-store
  // (anything carrying tokens or secrets) are never compressed (BREACH).
  if (performance.isCompressionEnabled) {
    app.use(
      compression({
        threshold: performance.compressionThresholdBytes,
        filter: (request: Request, response: Response) => {
          const cacheControl = response.getHeader('Cache-Control');
          if (
            typeof cacheControl === 'string' &&
            cacheControl.includes('no-store')
          ) {
            return false;
          }
          return compression.filter(request, response);
        },
      }),
    );
  }

  // Body size limits. Simple (non-nested) URL-encoded parsing only.
  app.useBodyParser('json', { limit: security.bodyLimit });
  app.useBodyParser('urlencoded', {
    limit: security.bodyLimit,
    extended: false,
  });
  // Safe messages for malformed / oversized bodies (see the handler's docs).
  app.use(bodyParserErrorHandler);

  // All routes: /<apiPrefix>/v<version>/..., e.g. /api/v1/health
  applyApiRouting(app, apiPrefix);

  // Only when SWAGGER_ENABLED=true; config validation forbids it in production.
  if (swagger.enabled) {
    const { uiPath, jsonPath } = setupSwagger(app, {
      path: swagger.path,
      apiVersion: DEFAULT_API_VERSION,
    });
    logger.log(`Swagger UI: ${uiPath} | OpenAPI JSON: ${jsonPath}`);
  }

  // Slow-client protection: limit time to receive headers and the full request.
  const server = app.getHttpServer();
  server.requestTimeout = security.requestTimeoutMs;
  server.headersTimeout = Math.min(20000, security.requestTimeoutMs);

  // Graceful shutdown on SIGTERM / SIGINT (see LifecycleService).
  app.enableShutdownHooks();

  await app.listen(port);
  logger.log(
    `AuthCore API listening on port ${port} (${nodeEnv}), prefix /${apiPrefix}/v${DEFAULT_API_VERSION}, ` +
      `log level ${logging.level}, format ${logging.format}` +
      (logging.isFileEnabled
        ? `, files ${logFilePattern(logging.directory)}`
        : ''),
  );
}
bootstrap().catch((error: unknown) => {
  // Startup failed (invalid config, database unreachable, port in use, ...).
  // bufferLogs holds logs until startup completes; print them now, or the
  // startup logs and this error would never appear.
  Logger.flush();
  const logger = new Logger('Bootstrap');
  const summary =
    error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  // (message, stack): Nest appends the context, so nest-winston gets all three.
  logger.fatal(
    `Startup failed: ${summary}`,
    error instanceof Error ? error.stack : undefined,
  );
  process.exitCode = 1;
  // Let the log flush, then exit even if connections are still open.
  setTimeout(() => process.exit(1), 500).unref();
});
