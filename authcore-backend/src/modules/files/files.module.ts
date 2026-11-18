import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { AccessControlModule } from '@modules/access-control/access-control.module';
import { UsersModule } from '@modules/users/users.module';

import { FilesController } from './files.controller';
import { FileUploadInterceptor } from './interceptors/file-upload.interceptor';
import { VIRUS_SCANNER } from './interfaces/virus-scanner.interface';
import { StoredFile, StoredFileSchema } from './schemas/stored-file.schema';
import { AvatarService } from './services/avatar.service';
import { ClamavScannerService } from './services/clamav-scanner.service';
import { FileOrphanCleanupService } from './services/file-orphan-cleanup.service';
import { FilesService } from './services/files.service';
import { ImageProcessingService } from './services/image-processing.service';
import { UploadsController } from './uploads.controller';

/**
 * Common file uploads for every module: inject FilesService (upload / read /
 * delete by purpose) and use FileUploadInterceptor on a multipart route.
 * Bytes go to the active storage (StorageModule: Settings → File storage);
 * POST /uploads is the general upload endpoint.
 */
@Global()
@Module({
  imports: [
    UsersModule,
    AccessControlModule,
    MongooseModule.forFeature([
      { name: StoredFile.name, schema: StoredFileSchema },
    ]),
  ],
  controllers: [FilesController, UploadsController],
  providers: [
    ClamavScannerService,
    { provide: VIRUS_SCANNER, useExisting: ClamavScannerService },
    ImageProcessingService,
    FilesService,
    AvatarService,
    FileUploadInterceptor,
    FileOrphanCleanupService,
  ],
  exports: [FilesService, AvatarService, FileUploadInterceptor],
})
export class FilesModule {}
