import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';

import { ErrorCode } from '@common/constants/error-codes.constants';
import { AppException } from '@common/exceptions/app.exception';
import { ValidationException } from '@common/exceptions/validation.exception';
import type { AuthContext } from '@common/interfaces/auth-context.interface';
import type { ClientInfo } from '@common/interfaces/client-info.interface';
import { authConfig } from '@config/configuration';
import { PasswordValidationService } from '@modules/password-policy/services/password-validation.service';
import type { CreatedSession } from '@modules/sessions/interfaces/session.interface';
import { SessionsService } from '@modules/sessions/sessions.service';
import { UserResponseDto } from '@modules/users/dto/user-response.dto';
import type { LoginLookup } from '@modules/users/interfaces/user-credentials.interface';
import { UsersService } from '@modules/users/users.service';
import { PasswordService } from '@shared/password.service';

import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { LogoutAllResponseDto } from './dto/logout-all-response.dto';
import { AccessTokenService } from './services/access-token.service';
import { AccountEligibilityService } from './services/account-eligibility.service';
import { LoginSecurityService } from './services/login-security.service';
import {
  RefreshTokenCookieService,
  type RefreshTokenDetails,
} from './services/refresh-token-cookie.service';

export interface RefreshResult {
  body: LoginResponseDto;
  /** New refresh token to deliver; null within the grace period (no rotation). */
  rotation: RefreshTokenDetails | null;
}

function invalidRefreshToken(): AppException {
  return new AppException(
    HttpStatus.UNAUTHORIZED,
    ErrorCode.AuthInvalidRefreshToken,
    'Your session has expired. Please sign in again.',
  );
}

export interface LoginResult {
  body: LoginResponseDto;
  /** For the controller to set the refresh-token cookie. */
  session: CreatedSession;
}

const INVALID_CREDENTIALS_MESSAGE = 'Invalid credentials';

/**
 * Sign-in with email or username + password.
 *
 *  1. Resolve the identifier (allowed by LOGIN_IDENTIFIERS)
 *  2. Find the user (deleted users count as not found)
 *  3. Refuse while locked (too many failures) → 429
 *  4. Verify the password (dummy verify if no user: same timing) → 401
 *  5. Clear failures, then check the account can sign in → 403 with a reason
 *  6. Create the session + refresh token, issue the access token
 *
 * Status-specific errors are only returned after a correct password, so they
 * can't be used to probe accounts.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly passwordService: PasswordService,
    private readonly sessionsService: SessionsService,
    private readonly accessTokenService: AccessTokenService,
    private readonly loginSecurityService: LoginSecurityService,
    private readonly refreshTokenCookieService: RefreshTokenCookieService,
    private readonly accountEligibilityService: AccountEligibilityService,
    private readonly passwordValidationService: PasswordValidationService,
    @Inject(authConfig.KEY)
    private readonly auth: ConfigType<typeof authConfig>,
  ) {}

  /** Password expiry under the current policy, for the sign-in / refresh response. */
  private async passwordStatus(user: UserResponseDto): Promise<{
    passwordExpiresAt: Date | null;
    isPasswordChangeRequired: boolean;
  }> {
    const status = await this.passwordValidationService.getExpiryStatus(
      user.passwordChangedAt,
    );
    return {
      passwordExpiresAt: status.expiresAt,
      isPasswordChangeRequired:
        status.isChangeRequired || user.mustChangePassword,
    };
  }

  async login(dto: LoginDto, client: ClientInfo): Promise<LoginResult> {
    const lookup = this.resolveLookup(dto);
    const method = 'email' in lookup ? 'email' : 'username';
    const credentials = await this.usersService.findCredentials(lookup);
    const userId = credentials?.user.id ?? null;
    const attemptKey = this.loginSecurityService.keyFor(
      userId,
      JSON.stringify(lookup),
    );

    await this.assertNotLocked(attemptKey, userId, client);

    const isPasswordValid = credentials
      ? await this.passwordService.verify(
          credentials.passwordHash,
          dto.password,
        )
      : await this.passwordService.verifyDummy(dto.password);
    if (!credentials || !isPasswordValid) {
      throw await this.recordFailedLogin(attemptKey, userId, method, client);
    }

    await this.loginSecurityService.clear(attemptKey);
    const { user, passwordHash } = credentials;
    this.assertCanSignIn(user);
    await this.upgradePasswordHashIfNeeded(user.id, passwordHash, dto.password);

    const session = await this.sessionsService.create({
      userId: user.id,
      isPersistent: dto.rememberMe ?? false,
      client,
    });
    const { accessToken, expiresIn } = await this.accessTokenService.issue(
      user.id,
      session.sessionId,
    );
    await this.usersService.recordLogin(user.id);

    this.logger.log({
      message: 'Login succeeded',
      userId: user.id,
      sessionId: session.sessionId,
      method,
      isPersistent: session.isPersistent,
      ipAddress: client.ipAddress,
    });
    if (session.revokedSessionIds.length > 0) {
      this.logger.log({
        message: 'Oldest sessions signed out (session limit)',
        userId: user.id,
        revokedSessionIds: session.revokedSessionIds,
      });
    }

    const body: LoginResponseDto = {
      user,
      accessToken,
      tokenType: 'Bearer',
      expiresIn,
      ...(await this.passwordStatus(user)),
    };
    if (this.refreshTokenCookieService.isBodyDelivery) {
      body.refreshToken = session.refreshToken;
      body.refreshTokenExpiresAt = session.expiresAt;
    }
    return { body, session };
  }

  // ---------------------------------------------------------------------------
  // Logout
  // ---------------------------------------------------------------------------

  /**
   * Signs out the current device: revokes the caller's session. Its access
   * tokens are rejected from the next request on (the guard checks the
   * session), and its refresh token stops working.
   */
  async logout(auth: AuthContext, client: ClientInfo): Promise<void> {
    await this.sessionsService.revoke(auth.sessionId, 'logout');
    this.logger.log({
      message: 'Logout',
      userId: auth.userId,
      sessionId: auth.sessionId,
      ipAddress: client.ipAddress,
    });
  }

  /**
   * Signs out every device of the user, or every device except this one
   * (`keepCurrentSession`).
   */
  async logoutAll(
    auth: AuthContext,
    shouldKeepCurrentSession: boolean,
    client: ClientInfo,
  ): Promise<LogoutAllResponseDto> {
    const revokedSessionCount = await this.sessionsService.revokeAllForUser(
      auth.userId,
      shouldKeepCurrentSession ? 'logout_others' : 'logout_all',
      shouldKeepCurrentSession ? auth.sessionId : undefined,
    );
    this.logger.log({
      message: shouldKeepCurrentSession
        ? 'Logout from all other devices'
        : 'Logout from all devices',
      userId: auth.userId,
      sessionId: auth.sessionId,
      revokedSessionCount,
      ipAddress: client.ipAddress,
    });
    return {
      revokedSessionCount,
      isCurrentSessionKept: shouldKeepCurrentSession,
    };
  }

  /**
   * The signed-in user (GET /auth/me). The guard has already checked the
   * token, session and account, so a missing user here means it was just
   * deleted.
   */
  async getCurrentUser(auth: AuthContext): Promise<UserResponseDto> {
    const user = await this.usersService.findById(auth.userId);
    if (!user) {
      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        ErrorCode.AuthSessionRevoked,
        'This session has ended. Please sign in again.',
      );
    }
    return user;
  }

  /** Exactly one identifier, and only one that LOGIN_IDENTIFIERS allows. */
  private resolveLookup(dto: LoginDto): LoginLookup {
    if (dto.email !== undefined && dto.username !== undefined) {
      throw new ValidationException([
        { field: 'email', message: 'use either email or username, not both' },
      ]);
    }
    const allowed = this.auth.loginIdentifiers;
    if (dto.username !== undefined) {
      if (!allowed.includes('username')) {
        throw new ValidationException([
          {
            field: 'username',
            message: 'sign-in with username is not enabled',
          },
        ]);
      }
      return { username: dto.username };
    }
    if (dto.email === undefined || !allowed.includes('email')) {
      throw new ValidationException([
        {
          field: 'email',
          message: allowed.includes('email')
            ? 'email or username is required'
            : 'sign-in with email is not enabled; use username',
        },
      ]);
    }
    return { email: dto.email };
  }

  private async assertNotLocked(
    attemptKey: string,
    userId: string | null,
    client: ClientInfo,
  ): Promise<void> {
    const lockedUntil =
      await this.loginSecurityService.getActiveLock(attemptKey);
    if (lockedUntil) {
      this.logger.warn({
        message: 'Login refused: locked after too many failed attempts',
        userId,
        lockedUntil,
        ipAddress: client.ipAddress,
      });
      throw this.loginSecurityService.lockedException(lockedUntil);
    }
  }

  /** Counts the failure and returns the error to throw (generic 401). */
  private async recordFailedLogin(
    attemptKey: string,
    userId: string | null,
    method: string,
    client: ClientInfo,
  ): Promise<AppException> {
    const { lockedUntil } =
      await this.loginSecurityService.recordFailure(attemptKey);
    this.logger.warn({
      message: 'Login failed: invalid credentials',
      userId,
      isKnownUser: userId !== null,
      method,
      ipAddress: client.ipAddress,
    });
    if (lockedUntil) {
      this.logger.warn({
        message: 'Login locked after too many failed attempts',
        userId,
        lockedUntil,
        ipAddress: client.ipAddress,
      });
    }
    return new AppException(
      HttpStatus.UNAUTHORIZED,
      ErrorCode.AuthInvalidCredentials,
      INVALID_CREDENTIALS_MESSAGE,
    );
  }

  /**
   * Only ACTIVE accounts can sign in (plus a verified email when email
   * verification is on). The error tells the client what the user can do,
   * without other account details.
   */
  private assertCanSignIn(user: UserResponseDto): void {
    const refusal = this.accountEligibilityService.getRefusal(user);
    if (refusal) {
      this.logger.log({
        message: 'Login refused: account cannot sign in',
        userId: user.id,
        status: user.status,
        code: refusal.code,
      });
      throw new AppException(
        HttpStatus.FORBIDDEN,
        refusal.code,
        refusal.message,
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Refresh
  // ---------------------------------------------------------------------------

  /**
   * Exchanges a refresh token for a new access token (and, normally, a new
   * refresh token: rotation). See SessionsService.useRefreshToken for the
   * rotation / grace / reuse rules. The account must still be allowed to
   * sign in; otherwise the session is revoked.
   */
  async refresh(
    refreshToken: string,
    client: ClientInfo,
  ): Promise<RefreshResult> {
    const result = await this.sessionsService.useRefreshToken(
      refreshToken,
      client,
    );

    if (result.kind === 'invalid') {
      throw invalidRefreshToken();
    }
    if (result.kind === 'reused') {
      this.logger.warn({
        message: 'Refresh token reuse detected: token family revoked',
        userId: result.userId,
        sessionId: result.sessionId,
        tokenFamilyId: result.tokenFamilyId,
        ipAddress: client.ipAddress,
      });
      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        ErrorCode.AuthRefreshTokenReused,
        'For your security this session has been signed out. Please sign in again.',
      );
    }

    const { session } = result;
    const user = await this.usersService.findById(session.userId);
    if (!user) {
      await this.sessionsService.revoke(session.sessionId, 'user_deleted');
      throw invalidRefreshToken();
    }
    const refusal = this.accountEligibilityService.getRefusal(user);
    if (refusal) {
      await this.sessionsService.revoke(session.sessionId, 'account_status');
      this.logger.log({
        message: 'Refresh refused: account cannot sign in; session revoked',
        userId: user.id,
        sessionId: session.sessionId,
        status: user.status,
        code: refusal.code,
      });
      throw new AppException(
        HttpStatus.FORBIDDEN,
        refusal.code,
        refusal.message,
      );
    }

    const { accessToken, expiresIn } = await this.accessTokenService.issue(
      user.id,
      session.sessionId,
    );
    this.logger.debug({
      message:
        result.kind === 'rotated'
          ? 'Session refreshed (token rotated)'
          : 'Session refreshed within grace period (no rotation)',
      userId: user.id,
      sessionId: session.sessionId,
      rotationCount: session.rotationCount,
    });

    const body: LoginResponseDto = {
      user,
      accessToken,
      tokenType: 'Bearer',
      expiresIn,
      ...(await this.passwordStatus(user)),
    };
    if (result.kind !== 'rotated') {
      return { body, rotation: null };
    }
    const rotation: RefreshTokenDetails = {
      refreshToken: result.refreshToken,
      // The session keeps its original expiry: refreshing never extends it.
      expiresAt: session.expiresAt,
      isPersistent: session.isPersistent,
    };
    if (this.refreshTokenCookieService.isBodyDelivery) {
      body.refreshToken = rotation.refreshToken;
      body.refreshTokenExpiresAt = rotation.expiresAt;
    }
    return { body, rotation };
  }

  /** Re-hash with the current Argon2 settings if the stored hash is weaker. */
  private async upgradePasswordHashIfNeeded(
    userId: string,
    passwordHash: string,
    password: string,
  ): Promise<void> {
    if (!this.passwordService.needsRehash(passwordHash)) {
      return;
    }
    await this.usersService.updatePasswordHash(
      userId,
      await this.passwordService.hash(password),
    );
    this.logger.log({ message: 'Password hash upgraded', userId });
  }
}
