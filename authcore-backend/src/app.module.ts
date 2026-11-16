import {
  type MiddlewareConsumer,
  Module,
  type NestModule,
} from '@nestjs/common';
import { ConfigModule, type ConfigType } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { WinstonModule } from 'nest-winston';

import { AllExceptionsFilter } from '@common/filters/all-exceptions.filter';
import { RequestContextInterceptor } from '@common/interceptors/request-context.interceptor';
import { ResponseInterceptor } from '@common/interceptors/response.interceptor';
import {
  DEFAULT_HANDLER_TIMEOUT_MS,
  TimeoutInterceptor,
} from '@common/interceptors/timeout.interceptor';
import { createWinstonOptions } from '@common/logger/winston-options';
import { SecurityMiddleware } from '@common/middleware/security.middleware';
import { createValidationPipe } from '@common/pipes/validation.pipe';
import {
  appConfig,
  configModuleOptions,
  loggingConfig,
  performanceConfig,
  securityConfig,
} from '@config/configuration';
import { DatabaseModule } from '@database/database.module';
import { AuthModule } from '@modules/auth/auth.module';
import { HealthModule } from '@modules/health/health.module';
import { MailModule } from '@modules/mail/mail.module';
import { SharedModule } from '@shared/shared.module';

import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot(configModuleOptions),
    WinstonModule.forRootAsync({
      inject: [loggingConfig.KEY, appConfig.KEY],
      useFactory: (
        logging: ConfigType<typeof loggingConfig>,
        app: ConfigType<typeof appConfig>,
      ) =>
        createWinstonOptions({
          serviceName: 'authcore-backend',
          environment: app.nodeEnv,
          level: logging.level,
          format: logging.format,
          isFileEnabled: logging.isFileEnabled,
          directory: logging.directory,
          maxFileSize: logging.maxFileSize,
          maxFiles: logging.maxFiles,
        }),
    }),
    ThrottlerModule.forRootAsync({
      inject: [securityConfig.KEY],
      useFactory: (security: ConfigType<typeof securityConfig>) => ({
        throttlers: [
          { ttl: security.throttleTtlMs, limit: security.throttleLimit },
        ],
      }),
    }),
    DatabaseModule,
    SharedModule,
    MailModule,
    HealthModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Rate limiting on every route (per client IP).
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // DTO validation on every route.
    { provide: APP_PIPE, useFactory: createValidationPipe },
    // Interceptor order (outer → inner): request context, timeout, envelope.
    {
      provide: DEFAULT_HANDLER_TIMEOUT_MS,
      inject: [performanceConfig.KEY],
      useFactory: (performance: ConfigType<typeof performanceConfig>) =>
        performance.handlerTimeoutMs,
    },
    { provide: APP_INTERCEPTOR, useClass: RequestContextInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TimeoutInterceptor },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    // Standard error envelope for every exception.
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(SecurityMiddleware).forRoutes('*path');
  }
}
