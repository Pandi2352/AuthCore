import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import {
  UserActivity,
  UserActivitySchema,
} from './schemas/user-activity.schema';
import { UserActivityService } from './user-activity.service';

/** Global: any module can record account activity. */
@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UserActivity.name, schema: UserActivitySchema },
    ]),
  ],
  providers: [UserActivityService],
  exports: [UserActivityService],
})
export class UserActivityModule {}
