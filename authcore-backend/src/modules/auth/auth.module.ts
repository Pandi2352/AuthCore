import { Module } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';

import { authConfig } from '@config/configuration';
import { EmailVerificationModule } from '@modules/email-verification/email-verification.module';
import { SessionsModule } from '@modules/sessions/sessions.module';
import { UsersModule } from '@modules/users/users.module';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RegistrationService } from './registration.service';
import {
  LoginAttempt,
  LoginAttemptSchema,
} from './schemas/login-attempt.schema';
import { AccessTokenService } from './services/access-token.service';
import { AccountEligibilityService } from './services/account-eligibility.service';
import { LoginSecurityService } from './services/login-security.service';
import { RefreshTokenCookieService } from './services/refresh-token-cookie.service';

/** Clock skew tolerated when verifying exp / iat (seconds). */
const JWT_CLOCK_TOLERANCE_SECONDS = 5;

@Module({
  imports: [
    UsersModule,
    EmailVerificationModule,
    SessionsModule,
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
  controllers: [AuthController],
  providers: [
    RegistrationService,
    AuthService,
    AccountEligibilityService,
    AccessTokenService,
    LoginSecurityService,
    RefreshTokenCookieService,
  ],
  exports: [AccessTokenService],
})
export class AuthModule {}
