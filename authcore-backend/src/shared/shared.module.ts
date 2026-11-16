import { Global, Module } from '@nestjs/common';

import { LifecycleService } from './lifecycle.service';
import { PasswordService } from './password.service';

/** App-wide services used by every module. */
@Global()
@Module({
  providers: [LifecycleService, PasswordService],
  exports: [LifecycleService, PasswordService],
})
export class SharedModule {}
