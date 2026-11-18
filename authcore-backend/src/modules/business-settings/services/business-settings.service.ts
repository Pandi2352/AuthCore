import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { ErrorCode } from '@common/constants/error-codes.constants';
import { AppException } from '@common/exceptions/app.exception';
import type { AuthContext } from '@common/interfaces/auth-context.interface';
import { PROJECT } from '@config/project';
import type { FileResponseDto } from '@modules/files/dto/file.dto';
import {
  FilesService,
  type IncomingFile,
} from '@modules/files/services/files.service';

import {
  BRAND_ASSET_FIELDS,
  BRAND_ASSET_SLOTS,
  BRAND_ASSETS,
  type BrandAssetField,
  type BrandAssetSlot,
  BRANDING_FILE_OWNER,
  GLOBAL_SETTINGS_KEY,
  SETTINGS_CACHE_TTL_MS,
} from '../constants/business-settings.constants';
import type {
  BrandAssetDto,
  BusinessSettingsDto,
  PublicBusinessSettingsDto,
  UpdateBusinessSettingsDto,
} from '../dto/business-settings.dto';
import {
  BusinessSettings,
  type StoredBrandAsset,
} from '../schemas/business-settings.schema';

type SettingsChanges = Partial<
  Pick<BusinessSettings, 'siteName' | 'siteDescription' | BrandAssetField>
>;

/** Image writes retry this often when another save lands in between. */
const ASSET_WRITE_ATTEMPTS = 3;

const versionConflict = () =>
  new AppException(
    HttpStatus.CONFLICT,
    ErrorCode.VersionConflict,
    'Someone else changed the business settings. Reload and try again.',
  );

/**
 * Business settings (site name, description, logos, favicon): one document,
 * project defaults until the first save. Reads are cached for
 * SETTINGS_CACHE_TTL_MS (other instances pick changes up within that time);
 * every write is versioned (optimistic concurrency) and clears the cache.
 * Images are stored by the files module (public, one file per slot: a new
 * upload replaces and deletes the previous one).
 */
@Injectable()
export class BusinessSettingsService {
  private readonly logger = new Logger(BusinessSettingsService.name);
  private cache: { value: BusinessSettings | null; loadedAt: number } | null =
    null;

  constructor(
    @InjectModel(BusinessSettings.name)
    private readonly settingsModel: Model<BusinessSettings>,
    private readonly filesService: FilesService,
  ) {}

  /** Public branding for every page (cached). */
  async getPublic(): Promise<PublicBusinessSettingsDto> {
    const stored = await this.load();
    return {
      siteName: stored?.siteName ?? PROJECT.name,
      siteDescription: stored?.siteDescription ?? PROJECT.description,
      assets: {
        logo: stored?.logo?.url ?? null,
        logoMark: stored?.logoMark?.url ?? null,
        authLogo: stored?.authLogo?.url ?? null,
        favicon: stored?.favicon?.url ?? null,
      },
      version: stored?.version ?? 0,
      updatedAt: stored?.updatedAt ?? null,
    };
  }

  /** Admin view with file details (not cached: always current). */
  async get(): Promise<BusinessSettingsDto> {
    const stored = await this.settingsModel
      .findOne({ key: GLOBAL_SETTINGS_KEY })
      .lean();
    return this.toAdmin(stored);
  }

  async update(
    dto: UpdateBusinessSettingsDto,
    actor: AuthContext,
  ): Promise<BusinessSettingsDto> {
    const changes: SettingsChanges = {};
    if (dto.siteName !== undefined) {
      changes.siteName = dto.siteName;
    }
    if (dto.siteDescription !== undefined) {
      changes.siteDescription = dto.siteDescription;
    }
    const saved = await this.write(changes, actor, dto.version);
    this.logger.log({
      message: 'Business settings updated',
      fields: Object.keys(changes),
      version: saved.version,
      updatedBy: actor.userId,
    });
    return this.toAdmin(saved);
  }

  /** Upload (or replace) one image. */
  async setAsset(
    slot: BrandAssetSlot,
    file: IncomingFile | undefined,
    actor: AuthContext,
  ): Promise<BusinessSettingsDto> {
    const uploaded = await this.filesService.upload(
      file,
      BRAND_ASSETS[slot],
      BRANDING_FILE_OWNER,
      actor.userId,
    );
    const asset: StoredBrandAsset = { fileId: uploaded.id, url: uploaded.url };
    const saved = await this.writeWithRetry(
      { [BRAND_ASSET_FIELDS[slot]]: asset },
      actor,
    );
    this.logger.log({
      message: 'Brand image updated',
      slot,
      fileId: uploaded.id,
      version: saved.version,
      updatedBy: actor.userId,
    });
    return this.toAdmin(saved);
  }

  /** Remove one image: the built-in default is used again. */
  async removeAsset(
    slot: BrandAssetSlot,
    actor: AuthContext,
  ): Promise<BusinessSettingsDto> {
    const removedCount = await this.filesService.removeAllOf(
      BRANDING_FILE_OWNER,
      BRAND_ASSETS[slot],
    );
    const saved = await this.writeWithRetry(
      { [BRAND_ASSET_FIELDS[slot]]: null },
      actor,
    );
    this.logger.log({
      message: 'Brand image removed',
      slot,
      removedCount,
      version: saved.version,
      updatedBy: actor.userId,
    });
    return this.toAdmin(saved);
  }

  // ---------------------------------------------------------------- internals

  private async load(): Promise<BusinessSettings | null> {
    if (
      this.cache &&
      Date.now() - this.cache.loadedAt < SETTINGS_CACHE_TTL_MS
    ) {
      return this.cache.value;
    }
    const value = await this.settingsModel
      .findOne({ key: GLOBAL_SETTINGS_KEY })
      .lean();
    this.cache = { value, loadedAt: Date.now() };
    return value;
  }

  /**
   * Versioned write: creates the document from the project defaults on the
   * first save; otherwise updates only if nobody saved in between.
   */
  private async write(
    changes: SettingsChanges,
    actor: AuthContext,
    expectedVersion?: number,
  ): Promise<BusinessSettings> {
    const current = await this.settingsModel
      .findOne({ key: GLOBAL_SETTINGS_KEY })
      .lean();
    const currentVersion = current?.version ?? 0;
    if (expectedVersion !== undefined && expectedVersion !== currentVersion) {
      throw versionConflict();
    }
    let saved: BusinessSettings | null;
    if (!current) {
      try {
        saved = (
          await this.settingsModel.create({
            key: GLOBAL_SETTINGS_KEY,
            siteName: PROJECT.name,
            siteDescription: PROJECT.description,
            ...changes,
            version: 1,
            createdBy: actor.userId,
            updatedBy: actor.userId,
          })
        ).toObject<BusinessSettings>({ transform: false });
      } catch (error) {
        // A parallel first save created it a moment earlier (unique key).
        if (isDuplicateKey(error)) {
          throw versionConflict();
        }
        throw error;
      }
    } else {
      saved = await this.settingsModel
        .findOneAndUpdate(
          { key: GLOBAL_SETTINGS_KEY, version: currentVersion },
          {
            $set: {
              ...changes,
              version: currentVersion + 1,
              updatedBy: actor.userId,
            },
          },
          { new: true, runValidators: true },
        )
        .lean();
    }
    if (!saved) {
      throw versionConflict();
    }
    this.cache = null;
    return saved;
  }

  /** Image changes can't be "reloaded and retried" by the user: retry here. */
  private async writeWithRetry(
    changes: SettingsChanges,
    actor: AuthContext,
  ): Promise<BusinessSettings> {
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.write(changes, actor);
      } catch (error) {
        const isConflict =
          error instanceof AppException &&
          error.code === ErrorCode.VersionConflict;
        if (!isConflict || attempt >= ASSET_WRITE_ATTEMPTS) {
          throw error;
        }
      }
    }
  }

  private async toAdmin(
    stored: BusinessSettings | null,
  ): Promise<BusinessSettingsDto> {
    const files = await Promise.all(
      BRAND_ASSET_SLOTS.map((slot) =>
        stored?.[BRAND_ASSET_FIELDS[slot]]
          ? this.filesService.findSingle(
              BRANDING_FILE_OWNER,
              BRAND_ASSETS[slot],
            )
          : Promise.resolve(null),
      ),
    );
    const [logo, logoMark, authLogo, favicon] = files.map((file, index) => {
      const slot = BRAND_ASSET_SLOTS[index] as BrandAssetSlot;
      return toAssetDto(stored?.[BRAND_ASSET_FIELDS[slot]] ?? null, file);
    });
    return {
      siteName: stored?.siteName ?? PROJECT.name,
      siteDescription: stored?.siteDescription ?? PROJECT.description,
      assets: {
        logo: logo ?? null,
        logoMark: logoMark ?? null,
        authLogo: authLogo ?? null,
        favicon: favicon ?? null,
      },
      isDefault: stored === null,
      version: stored?.version ?? 0,
      updatedAt: stored?.updatedAt ?? null,
      updatedBy: stored?.updatedBy ?? null,
    };
  }
}

const DUPLICATE_KEY_CODE = 11000;

function isDuplicateKey(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === DUPLICATE_KEY_CODE
  );
}

function toAssetDto(
  asset: StoredBrandAsset | null,
  file: FileResponseDto | null,
): BrandAssetDto | null {
  // The record and the file must agree; a stale pointer is reported as "not set".
  if (!asset || file?.id !== asset.fileId) {
    return null;
  }
  return {
    fileId: file.id,
    url: file.url,
    originalName: file.originalName,
    mimeType: file.mimeType,
    size: file.size,
    width: file.width,
    height: file.height,
    uploadedAt: file.createdAt,
  };
}
