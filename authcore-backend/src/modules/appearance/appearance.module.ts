import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import {
  MyAppearanceController,
  OrgAppearanceController,
} from './appearance.controller';
import {
  AppearanceSettings,
  AppearanceSettingsSchema,
  UserAppearance,
  UserAppearanceSchema,
} from './schemas/appearance-settings.schema';
import { AppearanceService } from './services/appearance.service';

/** Organization appearance (defaults + locks) and each user's synced appearance. */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AppearanceSettings.name, schema: AppearanceSettingsSchema },
      { name: UserAppearance.name, schema: UserAppearanceSchema },
    ]),
  ],
  controllers: [OrgAppearanceController, MyAppearanceController],
  providers: [AppearanceService],
})
export class AppearanceModule {}
