import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import {
  StoredFile,
  StoredFileSchema,
} from '@modules/files/schemas/stored-file.schema';

import {
  StorageConfig,
  StorageConfigSchema,
} from './schemas/storage-config.schema';
import { StorageConfigsService } from './services/storage-configs.service';
import { StorageManagerService } from './services/storage-manager.service';
import { StorageSettingsController } from './storage-settings.controller';

/**
 * File storage: provider definitions (providers/), drivers (drivers/), the configured
 * storages and which one is active. Global: FilesService writes through
 * StorageManagerService, so every upload in the app goes to the active storage.
 */
@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: StorageConfig.name, schema: StorageConfigSchema },
      { name: StoredFile.name, schema: StoredFileSchema },
    ]),
  ],
  controllers: [StorageSettingsController],
  providers: [StorageManagerService, StorageConfigsService],
  exports: [StorageManagerService],
})
export class StorageModule {}
