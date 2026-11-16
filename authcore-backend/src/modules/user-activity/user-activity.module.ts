import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { UsersModule } from '@modules/users/users.module';

import { AdminActivityController } from './admin-activity.controller';
import {
  UserActivity,
  UserActivitySchema,
} from './schemas/user-activity.schema';
import { ActivitySearchService } from './services/activity-search.service';
import { UserActivityService } from './user-activity.service';

/** Global: any module can record account activity. Admins search it at /admin/activity. */
@Global()
@Module({
  imports: [
    UsersModule,
    MongooseModule.forFeature([
      { name: UserActivity.name, schema: UserActivitySchema },
    ]),
  ],
  controllers: [AdminActivityController],
  providers: [UserActivityService, ActivitySearchService],
  exports: [UserActivityService],
})
export class UserActivityModule {}
