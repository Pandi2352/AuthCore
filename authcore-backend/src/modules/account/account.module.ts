import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { AccessControlModule } from '@modules/access-control/access-control.module';
import { AuthModule } from '@modules/auth/auth.module';
import { LoginAlertsModule } from '@modules/login-alerts/login-alerts.module';
import { SessionsModule } from '@modules/sessions/sessions.module';
import { UserSchemaModule } from '@modules/user-schema/user-schema.module';
import { UsersModule } from '@modules/users/users.module';

import { AccountController } from './controllers/account.controller';
import { AccountRecoveryController } from './controllers/account-recovery.controller';
import { AccountCode, AccountCodeSchema } from './schemas/account-code.schema';
import { AccountService } from './services/account.service';
import { AccountCodeService } from './services/account-code.service';
import { AccountPurgeService } from './services/account-purge.service';
import { DataExportService } from './services/data-export.service';
import { UserDataCleanupService } from './services/user-data-cleanup.service';

/**
 * Self-service account management (/users/me), account recovery, and the
 * permanent deletion of accounts (scheduled purge + cleanup used by admins).
 */
@Module({
  imports: [
    UsersModule,
    SessionsModule,
    AuthModule,
    UserSchemaModule,
    AccessControlModule,
    LoginAlertsModule,
    MongooseModule.forFeature([
      { name: AccountCode.name, schema: AccountCodeSchema },
    ]),
  ],
  controllers: [AccountController, AccountRecoveryController],
  providers: [
    AccountService,
    AccountCodeService,
    UserDataCleanupService,
    AccountPurgeService,
    DataExportService,
  ],
  exports: [UserDataCleanupService, AccountPurgeService],
})
export class AccountModule {}
