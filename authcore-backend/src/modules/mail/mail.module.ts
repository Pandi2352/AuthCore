import { Global, Module } from '@nestjs/common';

import { MailService } from './mail.service';

/** Global: any module can inject MailService. */
@Global()
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
