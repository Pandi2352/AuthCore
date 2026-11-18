import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { ErrorCode } from '@common/constants/error-codes.constants';
import { AppException } from '@common/exceptions/app.exception';
import type { AuthContext } from '@common/interfaces/auth-context.interface';

import {
  APPEARANCE_CACHE_TTL_MS,
  APPEARANCE_KEYS,
  GLOBAL_APPEARANCE_KEY,
  OPTION_VALUE,
} from '../constants/appearance.constants';
import type {
  AppearanceAdminDto,
  AppearanceDto,
  UpdateAppearanceDto,
} from '../dto/appearance.dto';
import { AppearanceSettings } from '../schemas/appearance-settings.schema';

const KNOWN_KEYS = new Set<string>(APPEARANCE_KEYS);

const versionConflict = () =>
  new AppException(
    HttpStatus.CONFLICT,
    ErrorCode.VersionConflict,
    'Someone else changed the appearance. Reload and try again.',
  );

/** Appearance map → only known keys with short token / #rrggbb values (400 otherwise). */
function cleanAppearance(
  input: Record<string, unknown>,
): Record<string, string> {
  const out: Record<string, string> = {};
  const errors: Array<{ field: string; message: string }> = [];
  for (const [key, value] of Object.entries(input)) {
    if (!KNOWN_KEYS.has(key)) {
      errors.push({ field: `appearance.${key}`, message: 'unknown option' });
    } else if (typeof value !== 'string' || !OPTION_VALUE.test(value)) {
      errors.push({ field: `appearance.${key}`, message: 'invalid value' });
    } else {
      out[key] = value;
    }
  }
  if (errors.length) {
    throw new AppException(
      HttpStatus.BAD_REQUEST,
      ErrorCode.ValidationFailed,
      'Check the appearance options',
      errors,
    );
  }
  return out;
}

/**
 * The application's look: one document, set by the super admin on Settings → Appearance,
 * read by every page (public). Cached per instance; writes clear the cache at once.
 */
@Injectable()
export class AppearanceService {
  private readonly logger = new Logger(AppearanceService.name);
  private cache: { value: AppearanceSettings | null; loadedAt: number } | null =
    null;

  constructor(
    @InjectModel(AppearanceSettings.name)
    private readonly model: Model<AppearanceSettings>,
  ) {}

  async getPublic(): Promise<AppearanceDto> {
    return this.toDto(await this.load());
  }

  async getAdmin(): Promise<AppearanceAdminDto> {
    const stored = await this.model
      .findOne({ key: GLOBAL_APPEARANCE_KEY })
      .lean();
    return Object.assign(this.toDto(stored), {
      updatedBy: stored?.updatedBy ?? null,
    });
  }

  async update(
    dto: UpdateAppearanceDto,
    actor: AuthContext,
  ): Promise<AppearanceAdminDto> {
    const values = {
      mode: dto.mode,
      preset: dto.preset,
      appearance: cleanAppearance(dto.appearance),
    };
    const current = await this.model
      .findOne({ key: GLOBAL_APPEARANCE_KEY })
      .lean();
    const currentVersion = current?.version ?? 0;
    if (dto.version !== undefined && dto.version !== currentVersion) {
      throw versionConflict();
    }
    if (!current) {
      try {
        await this.model.create({
          key: GLOBAL_APPEARANCE_KEY,
          ...values,
          version: 1,
          createdBy: actor.userId,
          updatedBy: actor.userId,
        });
      } catch (error) {
        if ((error as { code?: unknown }).code === 11000) {
          throw versionConflict();
        }
        throw error;
      }
    } else {
      const updated = await this.model.findOneAndUpdate(
        { key: GLOBAL_APPEARANCE_KEY, version: currentVersion },
        {
          $set: {
            ...values,
            version: currentVersion + 1,
            updatedBy: actor.userId,
          },
        },
      );
      if (!updated) {
        throw versionConflict();
      }
    }
    this.cache = null;
    this.logger.log({ message: 'Appearance updated', by: actor.userId });
    return this.getAdmin();
  }

  private async load(): Promise<AppearanceSettings | null> {
    if (
      this.cache &&
      Date.now() - this.cache.loadedAt < APPEARANCE_CACHE_TTL_MS
    ) {
      return this.cache.value;
    }
    const value = await this.model
      .findOne({ key: GLOBAL_APPEARANCE_KEY })
      .lean();
    this.cache = { value, loadedAt: Date.now() };
    return value;
  }

  private toDto(stored: AppearanceSettings | null): AppearanceDto {
    return {
      mode: stored?.mode ?? null,
      preset: stored?.preset ?? null,
      appearance: stored?.appearance ?? {},
      version: stored?.version ?? 0,
      updatedAt: stored?.updatedAt ?? null,
    };
  }
}
