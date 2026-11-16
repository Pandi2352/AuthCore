import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { UsersModule } from '@modules/users/users.module';

import { PasswordPolicyController } from './password-policy.controller';
import {
  PasswordExpiryNotification,
  PasswordExpiryNotificationSchema,
} from './schemas/password-expiry-notification.schema';
import {
  PasswordPolicy,
  PasswordPolicySchema,
} from './schemas/password-policy.schema';
import {
  PasswordPolicyAudit,
  PasswordPolicyAuditSchema,
} from './schemas/password-policy-audit.schema';
import {
  SchedulerConfig,
  SchedulerConfigSchema,
} from './schemas/scheduler-config.schema';
import { CompromisedPasswordService } from './services/compromised-password.service';
import { PasswordExpiryNotificationService } from './services/password-expiry-notification.service';
import { PasswordPolicyService } from './services/password-policy.service';
import { PasswordSchedulerService } from './services/password-scheduler.service';
import { PasswordValidationService } from './services/password-validation.service';
import { PolicyAuditService } from './services/policy-audit.service';

/**
 * Password policy: configuration (admin), enforcement (PasswordValidationService,
 * used by register / reset / change), expiry, and the expiry-reminder scheduler.
 */
@Module({
  imports: [
    UsersModule,
    MongooseModule.forFeature([
      { name: PasswordPolicy.name, schema: PasswordPolicySchema },
      { name: PasswordPolicyAudit.name, schema: PasswordPolicyAuditSchema },
      { name: SchedulerConfig.name, schema: SchedulerConfigSchema },
      {
        name: PasswordExpiryNotification.name,
        schema: PasswordExpiryNotificationSchema,
      },
    ]),
  ],
  controllers: [PasswordPolicyController],
  providers: [
    PasswordPolicyService,
    PasswordValidationService,
    CompromisedPasswordService,
    PolicyAuditService,
    PasswordExpiryNotificationService,
    PasswordSchedulerService,
  ],
  exports: [PasswordValidationService],
})
export class PasswordPolicyModule {}
