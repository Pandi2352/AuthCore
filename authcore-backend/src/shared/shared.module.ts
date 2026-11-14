import { Global, Module } from '@nestjs/common';

import { LifecycleService } from './lifecycle.service';

/** App-wide services used by every module. */
@Global()
@Module({
  providers: [LifecycleService],
  exports: [LifecycleService],
})
export class SharedModule {}
