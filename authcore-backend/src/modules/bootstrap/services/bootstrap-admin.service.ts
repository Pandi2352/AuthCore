import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';

import { appConfig, bootstrapAdminConfig } from '@config/configuration';
import { PasswordValidationService } from '@modules/password-policy/services/password-validation.service';
import { UserRole } from '@modules/users/enums/user-role.enum';
import { UserSource } from '@modules/users/enums/user-source.enum';
import { UserStatus } from '@modules/users/enums/user-status.enum';
import { UsersService } from '@modules/users/users.service';
import { PasswordService } from '@shared/password.service';

/** The sample password from .env.example: never accepted in production. */
const SAMPLE_PASSWORD = 'Test@123';

export type BootstrapOutcome =
  'created' | 'exists' | 'disabled' | 'not-configured' | 'rejected';

/**
 * Creates the first administrator from BOOTSTRAP_ADMIN_* at startup, so a
 * fresh installation has someone who can sign in and manage everything.
 * Idempotent and safe on every restart / instance:
 * - an existing account with that email (any state) is never changed: the
 *   password in the env file is not re-applied after the first run;
 * - the password must pass the password policy; in production the sample
 *   value from .env.example is refused;
 * - the account is ACTIVE, email-verified, role ADMIN, source SYSTEM, and by
 *   default must change its password at first sign-in.
 */
@Injectable()
export class BootstrapAdminService implements OnApplicationBootstrap {
  private readonly logger = new Logger(BootstrapAdminService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly passwordService: PasswordService,
    private readonly passwordValidationService: PasswordValidationService,
    @Inject(bootstrapAdminConfig.KEY)
    private readonly config: ConfigType<typeof bootstrapAdminConfig>,
    @Inject(appConfig.KEY)
    private readonly app: ConfigType<typeof appConfig>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.ensureAdmin();
    } catch (error) {
      // Never stop the API from starting because of this.
      this.logger.error(
        { message: 'Bootstrap admin could not be created' },
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  async ensureAdmin(): Promise<BootstrapOutcome> {
    const { isEnabled, email, password } = this.config;
    if (!isEnabled) {
      return 'disabled';
    }
    if (email === '' || password === '') {
      this.logger.log(
        'Bootstrap admin not configured (BOOTSTRAP_ADMIN_EMAIL / BOOTSTRAP_ADMIN_PASSWORD empty)',
      );
      return 'not-configured';
    }
    if (await this.usersService.isEmailTaken(email)) {
      return 'exists';
    }
    if (this.app.isProduction && password === SAMPLE_PASSWORD) {
      this.logger.error(
        'Bootstrap admin NOT created: BOOTSTRAP_ADMIN_PASSWORD is the sample value; set a strong, unique password',
      );
      return 'rejected';
    }
    const violations = await this.passwordValidationService.validate(password, {
      email,
      firstName: this.config.firstName,
      lastName: this.config.lastName,
    });
    if (violations.length > 0) {
      this.logger.error({
        message:
          'Bootstrap admin NOT created: BOOTSTRAP_ADMIN_PASSWORD does not meet the password policy',
        rules: violations.map((v) => v.rule),
      });
      return 'rejected';
    }

    let userId: string;
    try {
      const user = await this.usersService.create({
        email,
        firstName: this.config.firstName,
        ...(this.config.lastName ? { lastName: this.config.lastName } : {}),
        passwordHash: await this.passwordService.hash(password),
        status: UserStatus.Active,
        isEmailVerified: true,
        mustChangePassword: this.config.isPasswordChangeRequired,
        source: UserSource.System,
        createdBy: 'system',
      });
      userId = user.id;
    } catch (error) {
      // Another instance created it at the same moment.
      if ((error as { code?: unknown }).code === 11000) {
        return 'exists';
      }
      throw error;
    }
    await this.usersService.setRoleById(userId, UserRole.Admin);
    // Ids only: no email or password in logs.
    this.logger.warn({
      message: this.config.isPasswordChangeRequired
        ? 'Bootstrap admin created: sign in with BOOTSTRAP_ADMIN_EMAIL / BOOTSTRAP_ADMIN_PASSWORD and choose a new password'
        : 'Bootstrap admin created: change its password (BOOTSTRAP_ADMIN_MUST_CHANGE_PASSWORD=false)',
      userId,
    });
    return 'created';
  }
}
