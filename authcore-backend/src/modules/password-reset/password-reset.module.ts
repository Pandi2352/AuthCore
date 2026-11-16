import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { PasswordResetService } from './password-reset.service';
import {
  PasswordReset,
  PasswordResetSchema,
} from './schemas/password-reset.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PasswordReset.name, schema: PasswordResetSchema },
    ]),
  ],
  providers: [PasswordResetService],
  exports: [PasswordResetService],
})
export class PasswordResetModule {}
