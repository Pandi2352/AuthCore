import { Module } from '@nestjs/common';

import { PasswordPolicyModule } from '@modules/password-policy/password-policy.module';
import { UsersModule } from '@modules/users/users.module';

import { BootstrapAdminService } from './services/bootstrap-admin.service';

/** First-run setup: the initial administrator account (BOOTSTRAP_ADMIN_*). */
@Module({
  imports: [UsersModule, PasswordPolicyModule],
  providers: [BootstrapAdminService],
})
export class BootstrapModule {}
