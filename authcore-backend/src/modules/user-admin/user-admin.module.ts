import { Module } from '@nestjs/common';

import { AccessControlModule } from '@modules/access-control/access-control.module';
import { AccountModule } from '@modules/account/account.module';
import { AuthModule } from '@modules/auth/auth.module';
import { PasswordPolicyModule } from '@modules/password-policy/password-policy.module';
import { SessionsModule } from '@modules/sessions/sessions.module';
import { UsersModule } from '@modules/users/users.module';

import { UserAdminService } from './services/user-admin.service';
import { UserAdminController } from './user-admin.controller';

/** User administration (/admin/users). */
@Module({
  imports: [
    UsersModule,
    SessionsModule,
    AuthModule,
    AccessControlModule,
    PasswordPolicyModule,
    AccountModule,
  ],
  controllers: [UserAdminController],
  providers: [UserAdminService],
})
export class UserAdminModule {}
