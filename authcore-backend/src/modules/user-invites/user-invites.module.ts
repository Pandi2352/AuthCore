import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { AccessControlModule } from '@modules/access-control/access-control.module';
import { PasswordPolicyModule } from '@modules/password-policy/password-policy.module';
import { UsersModule } from '@modules/users/users.module';

import { UserInvite, UserInviteSchema } from './schemas/user-invite.schema';
import { UserInvitesService } from './services/user-invites.service';
import { UserInvitesController } from './user-invites.controller';

/** Email invitations: send / resend / revoke, public info and acceptance. */
@Module({
  imports: [
    UsersModule,
    AccessControlModule,
    PasswordPolicyModule,
    MongooseModule.forFeature([
      { name: UserInvite.name, schema: UserInviteSchema },
    ]),
  ],
  controllers: [UserInvitesController],
  providers: [UserInvitesService],
})
export class UserInvitesModule {}
