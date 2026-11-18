import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { AccessControlModule } from '@modules/access-control/access-control.module';
import { AccountModule } from '@modules/account/account.module';
import { AuthModule } from '@modules/auth/auth.module';
import { PasswordPolicyModule } from '@modules/password-policy/password-policy.module';
import { SessionsModule } from '@modules/sessions/sessions.module';
import { UserSchemaModule } from '@modules/user-schema/user-schema.module';
import { UsersModule } from '@modules/users/users.module';

import { UserReport, UserReportSchema } from './schemas/user-report.schema';
import { UserAdminService } from './services/user-admin.service';
import { UserReportsService } from './services/user-reports.service';
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
    UserSchemaModule,
    MongooseModule.forFeature([
      { name: UserReport.name, schema: UserReportSchema },
    ]),
  ],
  controllers: [UserAdminController],
  providers: [UserAdminService, UserReportsService],
})
export class UserAdminModule {}
