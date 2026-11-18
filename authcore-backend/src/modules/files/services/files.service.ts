import { createHash } from 'node:crypto';

import {
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  StreamableFile,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { ErrorCode } from '@common/constants/error-codes.constants';
import { AppException } from '@common/exceptions/app.exception';
import type { Paginated } from '@common/interfaces/api-response.interface';
import type { AuthContext } from '@common/interfaces/auth-context.interface';
import { normalizePagination, paginate } from '@common/utils/pagination.util';
import { generateUuid } from '@common/utils/uuid.util';
import { FILE_PERMISSIONS } from '@modules/access-control/constants/access-control.constants';
import { AccessResolverService } from '@modules/access-control/services/access-resolver.service';
import { UserRole } from '@modules/users/enums/user-role.enum';

import {
  FILE_PURPOSES,
  MAX_ORIGINAL_NAME_LENGTH,
  MIME_EXTENSIONS,
  UPLOAD_FIELD_NAME,
} from '../constants/file.constants';
import type { FileListQueryDto, FileResponseDto } from '../dto/file.dto';
import { FilePurpose, FileVisibility, ScanStatus } from '../enums/file.enum';
import {
  STORAGE_DRIVER,
  type StorageDriver,
} from '../interfaces/storage-driver.interface';
import {
  VIRUS_SCANNER,
  type VirusScanner,
} from '../interfaces/virus-scanner.interface';
import { StoredFile } from '../schemas/stored-file.schema';
import { detectMimeType, sanitizeFileName } from '../utils/file-signature.util';
import { ImageProcessingService } from './image-processing.service';

/** What the upload interceptor hands over (multer memory storage). */
export interface IncomingFile {
  originalname: string;
  size: number;
  buffer: Buffer;
}

export interface FileContent {
  file: StoredFile;
  stream: StreamableFile;
}

/**
 * Common file handling for every feature: validates uploads by purpose
 * (content-detected type, size, quota), stores them through the storage
 * driver, keeps metadata in `files`, serves and deletes them.
 */
@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);

  constructor(
    @InjectModel(StoredFile.name) private readonly fileModel: Model<StoredFile>,
    @Inject(STORAGE_DRIVER) private readonly storage: StorageDriver,
    private readonly configService: ConfigService,
    private readonly accessResolver: AccessResolverService,
    private readonly imageProcessing: ImageProcessingService,
    @Inject(VIRUS_SCANNER) private readonly scanner: VirusScanner,
  ) {}

  /**
   * Validates and stores a file for `ownerId`. For single-file purposes
   * (avatar) the owner's previous file of that purpose is deleted afterwards.
   */
  async upload(
    file: IncomingFile | undefined,
    purpose: FilePurpose,
    ownerId: string,
    uploadedBy: string,
  ): Promise<FileResponseDto> {
    if (!file || file.size === 0) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.FileRequired,
        'Choose a file to upload',
        [{ field: UPLOAD_FIELD_NAME, message: 'a non-empty file is required' }],
      );
    }
    const rule = FILE_PURPOSES[purpose];
    const maxBytes = this.configService.getOrThrow<number>(
      rule.sizeLimit === 'avatar'
        ? 'storage.avatarMaxSizeBytes'
        : 'storage.maxFileSizeBytes',
    );
    if (file.size > maxBytes) {
      throw new AppException(
        HttpStatus.PAYLOAD_TOO_LARGE,
        ErrorCode.FileTooLarge,
        `The file is too large (max ${formatBytes(maxBytes)})`,
        [{ field: UPLOAD_FIELD_NAME, message: `max ${formatBytes(maxBytes)}` }],
      );
    }
    const mimeType = detectMimeType(file.buffer);
    if (!mimeType || !rule.mimeTypes.includes(mimeType)) {
      const allowed = rule.mimeTypes
        .map((t) => MIME_EXTENSIONS[t].toUpperCase())
        .join(', ');
      throw new AppException(
        HttpStatus.UNSUPPORTED_MEDIA_TYPE,
        ErrorCode.FileTypeNotAllowed,
        `This file type is not allowed here. Allowed: ${allowed}`,
        [{ field: UPLOAD_FIELD_NAME, message: `allowed: ${allowed}` }],
      );
    }
    const quota = this.configService.getOrThrow<number>(
      'storage.maxFilesPerUser',
    );
    if (
      !rule.isSingle &&
      (await this.fileModel.countDocuments({ ownerId })) >= quota
    ) {
      throw new AppException(
        HttpStatus.CONFLICT,
        ErrorCode.FileLimitReached,
        `File limit reached (${String(quota)} files). Delete some files first.`,
      );
    }

    // Scan what the client sent, then store only the re-encoded image.
    const scanStatus = await this.scan(file.buffer, {
      ownerId,
      uploadedBy,
      purpose,
    });
    const processed = this.imageProcessing.isImage(mimeType)
      ? await this.imageProcessing.process(
          file.buffer,
          mimeType,
          rule.imageMode,
        )
      : { buffer: file.buffer, width: null, height: null };
    const content = processed.buffer;

    const extension = MIME_EXTENSIONS[mimeType];
    const id = generateUuid();
    const now = new Date();
    // Folder per purpose ("BRAND_LOGO" → "brand-logo": keys allow a-z, 0-9 and "-").
    const storageKey = `${purpose.toLowerCase().replace(/_/g, '-')}/${String(now.getUTCFullYear())}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${id}.${extension}`;
    await this.storage.put(storageKey, content);
    let created: StoredFile;
    try {
      created = (
        await this.fileModel.create({
          _id: id,
          ownerId,
          purpose,
          visibility: rule.visibility,
          originalName: sanitizeFileName(
            file.originalname,
            extension,
            MAX_ORIGINAL_NAME_LENGTH,
          ),
          mimeType,
          extension,
          size: content.length,
          originalSize: file.size,
          width: processed.width,
          height: processed.height,
          scanStatus,
          sha256: createHash('sha256').update(content).digest('hex'),
          storageDriver: this.storage.name,
          storageKey,
          uploadedBy,
        })
      ).toObject<StoredFile>({ transform: false });
    } catch (error) {
      await this.storage.delete(storageKey).catch(() => undefined);
      throw error;
    }
    if (rule.isSingle) {
      const previous = await this.fileModel
        .find({ ownerId, purpose, _id: { $ne: id } })
        .lean();
      for (const old of previous) {
        await this.deleteFile(old);
      }
    }
    this.logger.log({
      message: 'File uploaded',
      fileId: id,
      purpose,
      ownerId,
      uploadedBy,
      size: content.length,
      originalSize: file.size,
      mimeType,
      scanStatus,
    });
    return this.toResponse(created);
  }

  async list(
    query: FileListQueryDto,
    auth: AuthContext,
  ): Promise<Paginated<FileResponseDto>> {
    const ownerId = query.ownerId ?? auth.userId;
    if (ownerId !== auth.userId) {
      await this.assertPermission(auth, FILE_PERMISSIONS.Read);
    }
    const { page, limit, skip } = normalizePagination(query.page, query.limit);
    const filter = {
      ownerId,
      ...(query.purpose ? { purpose: query.purpose } : {}),
    };
    const [items, total] = await Promise.all([
      this.fileModel
        .find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.fileModel.countDocuments(filter),
    ]);
    return paginate(
      items.map((f) => this.toResponse(f)),
      page,
      limit,
      total,
    );
  }

  /** Metadata; owner or FILE_READ (404 otherwise, so ids can't be probed). */
  async get(id: string, auth: AuthContext): Promise<FileResponseDto> {
    return this.toResponse(await this.readable(id, auth));
  }

  /** Private download: owner or FILE_READ. */
  async content(id: string, auth: AuthContext): Promise<FileContent> {
    return this.open(await this.readable(id, auth));
  }

  /** Public download: only files whose purpose is public (avatars). */
  async publicContent(id: string): Promise<FileContent> {
    const file = await this.fileModel
      .findOne({ _id: id, visibility: FileVisibility.Public })
      .lean();
    if (!file) {
      throw notFound();
    }
    return this.open(file);
  }

  /** Owner or FILE_DELETE. */
  async remove(id: string, auth: AuthContext): Promise<{ id: string }> {
    const file = await this.fileModel.findById(id).lean();
    if (!file) {
      throw notFound();
    }
    if (file.ownerId !== auth.userId) {
      await this.assertPermission(auth, FILE_PERMISSIONS.Delete, true);
    }
    // Files owned by a module (branding) are removed through that module, so it never
    // points at a missing file.
    if (!FILE_PURPOSES[file.purpose].isDirectUpload) {
      throw new AppException(
        HttpStatus.CONFLICT,
        ErrorCode.Conflict,
        'This file is managed by its own settings page; remove it there',
      );
    }
    await this.deleteFile(file);
    this.logger.log({
      message: 'File deleted',
      fileId: id,
      ownerId: file.ownerId,
      deletedBy: auth.userId,
    });
    return { id };
  }

  /** All files of an owner, newest first (data export: metadata only). */
  async listAllOf(ownerId: string): Promise<FileResponseDto[]> {
    const files = await this.fileModel
      .find({ ownerId })
      .sort({ createdAt: -1 })
      .lean();
    return files.map((f) => this.toResponse(f));
  }

  /** The owner's single file of a purpose (e.g. avatar), or null. */
  async findSingle(
    ownerId: string,
    purpose: FilePurpose,
  ): Promise<FileResponseDto | null> {
    const file = await this.fileModel
      .findOne({ ownerId, purpose })
      .sort({ createdAt: -1 })
      .lean();
    return file ? this.toResponse(file) : null;
  }

  /** Deletes every file of a purpose for the owner; returns how many. */
  async removeAllOf(ownerId: string, purpose?: FilePurpose): Promise<number> {
    const files = await this.fileModel
      .find({ ownerId, ...(purpose ? { purpose } : {}) })
      .lean();
    for (const file of files) {
      await this.deleteFile(file);
    }
    return files.length;
  }

  isHealthy(): Promise<boolean> {
    return this.storage.isHealthy();
  }

  /** null when scanning is disabled. */
  async isScannerHealthy(): Promise<boolean | null> {
    return this.scanner.isEnabled ? this.scanner.ping() : null;
  }

  /**
   * Virus scan. Infected → 422 FILE_INFECTED (nothing stored). Scanner down →
   * 503 FILE_SCAN_UNAVAILABLE, or accepted as SCAN_FAILED when fail-open.
   */
  private async scan(
    data: Buffer,
    context: { ownerId: string; uploadedBy: string; purpose: FilePurpose },
  ): Promise<ScanStatus> {
    if (!this.scanner.isEnabled) {
      return ScanStatus.NotScanned;
    }
    let result;
    try {
      result = await this.scanner.scan(data);
    } catch (error) {
      this.logger.error(
        {
          message: 'Virus scan failed',
          ...context,
          scanner: this.scanner.name,
        },
        error instanceof Error ? error.stack : undefined,
      );
      if (
        this.configService.getOrThrow<boolean>('storage.virusScan.isFailClosed')
      ) {
        throw new AppException(
          HttpStatus.SERVICE_UNAVAILABLE,
          ErrorCode.FileScanUnavailable,
          'Uploads are paused: the virus scanner is not reachable. Try again later.',
        );
      }
      return ScanStatus.ScanFailed;
    }
    if (result.isInfected) {
      this.logger.warn({
        message: 'Infected upload rejected',
        ...context,
        signature: result.signature,
        scanner: this.scanner.name,
      });
      throw new AppException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        ErrorCode.FileInfected,
        'The file contains malware and was rejected',
        [{ field: UPLOAD_FIELD_NAME, message: 'malware detected' }],
      );
    }
    return ScanStatus.Clean;
  }

  publicUrl(id: string): string {
    return `${this.configService.getOrThrow<string>('storage.publicBaseUrl')}/${id}`;
  }

  private async readable(id: string, auth: AuthContext): Promise<StoredFile> {
    const file = await this.fileModel.findById(id).lean();
    if (!file) {
      throw notFound();
    }
    if (
      file.ownerId !== auth.userId &&
      file.visibility !== FileVisibility.Public
    ) {
      await this.assertPermission(auth, FILE_PERMISSIONS.Read, true);
    }
    return file;
  }

  private async open(file: StoredFile): Promise<FileContent> {
    try {
      const stream = await this.storage.read(file.storageKey);
      return {
        file,
        stream: new StreamableFile(stream, {
          type: file.mimeType,
          length: file.size,
        }),
      };
    } catch (error) {
      this.logger.error(
        {
          message: 'Stored file missing',
          fileId: file._id,
          storageKey: file.storageKey,
        },
        error instanceof Error ? error.stack : undefined,
      );
      throw notFound();
    }
  }

  /** Metadata first, then bytes: a failed byte delete leaves an unreachable file, never a broken record. */
  private async deleteFile(file: StoredFile): Promise<void> {
    await this.fileModel.deleteOne({ _id: file._id });
    try {
      await this.storage.delete(file.storageKey);
    } catch (error) {
      this.logger.warn({
        message: 'Could not delete file bytes',
        fileId: file._id,
        storageKey: file.storageKey,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /** ADMIN passes; otherwise the permission is needed. `hide` = answer 404 instead of 403. */
  private async assertPermission(
    auth: AuthContext,
    permission: string,
    hide = false,
  ): Promise<void> {
    if (auth.role === (UserRole.Admin as string)) {
      return;
    }
    const keys = await this.accessResolver.getPermissionKeys(auth.userId);
    if (!keys.has(permission)) {
      throw hide
        ? notFound()
        : new AppException(
            HttpStatus.FORBIDDEN,
            ErrorCode.Forbidden,
            `You need the ${permission} permission`,
          );
    }
  }

  private toResponse(file: StoredFile): FileResponseDto {
    const apiPrefix = this.configService.getOrThrow<string>('app.apiPrefix');
    return {
      id: file._id,
      ownerId: file.ownerId,
      purpose: file.purpose,
      visibility: file.visibility,
      originalName: file.originalName,
      mimeType: file.mimeType,
      size: file.size,
      sha256: file.sha256,
      originalSize: file.originalSize,
      width: file.width,
      height: file.height,
      scanStatus: file.scanStatus,
      url:
        file.visibility === FileVisibility.Public
          ? this.publicUrl(file._id)
          : `/${apiPrefix}/v1/files/${file._id}/content`,
      uploadedBy: file.uploadedBy,
      createdAt: file.createdAt,
    };
  }
}

function notFound(): AppException {
  return new AppException(
    HttpStatus.NOT_FOUND,
    ErrorCode.NotFound,
    'File not found',
  );
}

function formatBytes(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${String(Math.round((bytes / 1024 / 1024) * 10) / 10)} MB`
    : `${String(Math.round(bytes / 1024))} KB`;
}
