import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { AccessControlModule } from '@modules/access-control/access-control.module';
import { UsersModule } from '@modules/users/users.module';

import { FilesController } from './files.controller';
import { FileUploadInterceptor } from './interceptors/file-upload.interceptor';
import { STORAGE_DRIVER } from './interfaces/storage-driver.interface';
import { VIRUS_SCANNER } from './interfaces/virus-scanner.interface';
import { StoredFile, StoredFileSchema } from './schemas/stored-file.schema';
import { AvatarService } from './services/avatar.service';
import { ClamavScannerService } from './services/clamav-scanner.service';
import { FilesService } from './services/files.service';
import { ImageProcessingService } from './services/image-processing.service';
import { LocalStorageService } from './services/local-storage.service';

/**
 * Common file uploads for every module: inject FilesService (upload / read /
 * delete by purpose) and use FileUploadInterceptor on a multipart route.
 * STORAGE_DRIVER=local stores the bytes in STORAGE_LOCAL_DIR.
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
  controllers: [FilesController],
  providers: [
    LocalStorageService,
    { provide: STORAGE_DRIVER, useExisting: LocalStorageService },
    ClamavScannerService,
    { provide: VIRUS_SCANNER, useExisting: ClamavScannerService },
    ImageProcessingService,
    FilesService,
    AvatarService,
    FileUploadInterceptor,
  ],
  exports: [FilesService, AvatarService, FileUploadInterceptor],
})
export class FilesModule {}
