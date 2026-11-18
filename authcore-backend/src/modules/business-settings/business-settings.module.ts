import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { BusinessSettingsController } from './business-settings.controller';
import {
  BusinessSettings,
  BusinessSettingsSchema,
} from './schemas/business-settings.schema';
import { BusinessSettingsService } from './services/business-settings.service';

/**
 * Business settings: site name, description, logos (expanded / collapsed
 * sidebar, sign-in pages) and favicon. Images go through the global
 * FilesModule (validated, scanned, re-encoded, public).
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BusinessSettings.name, schema: BusinessSettingsSchema },
    ]),
  ],
  controllers: [BusinessSettingsController],
  providers: [BusinessSettingsService],
  exports: [BusinessSettingsService],
})
export class BusinessSettingsModule {}
