import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { AppearanceController } from './appearance.controller';
import {
  AppearanceSettings,
  AppearanceSettingsSchema,
} from './schemas/appearance-settings.schema';
import { AppearanceService } from './services/appearance.service';

/** The application's look, set by the super admin and applied to every user. */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AppearanceSettings.name, schema: AppearanceSettingsSchema },
    ]),
  ],
  controllers: [AppearanceController],
  providers: [AppearanceService],
})
export class AppearanceModule {}
