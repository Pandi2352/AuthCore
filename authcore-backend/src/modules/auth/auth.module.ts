import { Module } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';

import { authConfig } from '@config/configuration';
import { EmailVerificationModule } from '@modules/email-verification/email-verification.module';
import { PasswordResetModule } from '@modules/password-reset/password-reset.module';
import { SessionsModule } from '@modules/sessions/sessions.module';
import { UsersModule } from '@modules/users/users.module';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PasswordController } from './password.controller';
import { RegistrationService } from './registration.service';
import {
  LoginAttempt,
  LoginAttemptSchema,
} from './schemas/login-attempt.schema';
import { AccessTokenService } from './services/access-token.service';
import { AccountEligibilityService } from './services/account-eligibility.service';
import { LoginSecurityService } from './services/login-security.service';
import { PasswordManagementService } from './services/password-management.service';
import { PasswordPolicyService } from './services/password-policy.service';
import { RefreshTokenCookieService } from './services/refresh-token-cookie.service';
import { SessionManagementService } from './services/session-management.service';
import { SessionManagementController } from './session-management.controller';

/** Clock skew tolerated when verifying exp / iat (seconds). */
const JWT_CLOCK_TOLERANCE_SECONDS = 5;

@Module({
  imports: [
    UsersModule,
    EmailVerificationModule,
    SessionsModule,
    PasswordResetModule,
    MongooseModule.forFeature([
      { name: LoginAttempt.name, schema: LoginAttemptSchema },
    ]),
    JwtModule.registerAsync({
      inject: [authConfig.KEY],
      useFactory: (auth: ConfigType<typeof authConfig>) => ({
        secret: auth.jwt.secret,
        // The algorithm is fixed for both signing and verifying.
        signOptions: {
          algorithm: 'HS256',
          expiresIn: auth.jwt.ttlSeconds,
          issuer: auth.jwt.issuer,
          audience: auth.jwt.audience,
        },
        verifyOptions: {
          algorithms: ['HS256'],
          issuer: auth.jwt.issuer,
          audience: auth.jwt.audience,
          clockTolerance: JWT_CLOCK_TOLERANCE_SECONDS,
        },
      }),
    }),
  ],
  controllers: [
    AuthController,
    PasswordController,
    SessionManagementController,
  ],
  providers: [
    RegistrationService,
    AuthService,
    AccountEligibilityService,
    AccessTokenService,
    LoginSecurityService,
    RefreshTokenCookieService,
    SessionManagementService,
    PasswordPolicyService,
    PasswordManagementService,
    // Every route requires an access token unless marked @Public().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
  exports: [AccessTokenService],
})
export class AuthModule {}
