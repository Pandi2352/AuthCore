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
  LOCKABLE_KEYS,
  OPTION_VALUE,
} from '../constants/appearance.constants';
import type {
  MyAppearanceDto,
  OrgAppearanceAdminDto,
  OrgAppearanceDto,
  ThemeValuesDto,
  UpdateMyAppearanceDto,
  UpdateOrgAppearanceDto,
} from '../dto/appearance.dto';
import {
  AppearanceSettings,
  UserAppearance,
} from '../schemas/appearance-settings.schema';

const KNOWN_KEYS = new Set<string>(APPEARANCE_KEYS);

const versionConflict = () =>
  new AppException(
    HttpStatus.CONFLICT,
    ErrorCode.VersionConflict,
    'Someone else changed the organization appearance. Reload and try again.',
  );

/** Appearance map → only known keys with short token / #rrggbb values (400 otherwise). */
function cleanAppearance(
  input: Record<string, unknown> | undefined,
  field: string,
) {
  const out: Record<string, string> = {};
  const errors: Array<{ field: string; message: string }> = [];
  for (const [key, value] of Object.entries(input ?? {})) {
    if (!KNOWN_KEYS.has(key)) {
      errors.push({ field: `${field}.${key}`, message: 'unknown option' });
    } else if (typeof value !== 'string' || !OPTION_VALUE.test(value)) {
      errors.push({ field: `${field}.${key}`, message: 'invalid value' });
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
 * Appearance: the organization's look (admin; defaults + locked options, public to every
 * page) and each user's own look synced across their devices.
 */
@Injectable()
export class AppearanceService {
  private readonly logger = new Logger(AppearanceService.name);
  private cache: { value: AppearanceSettings | null; loadedAt: number } | null =
    null;

  constructor(
    @InjectModel(AppearanceSettings.name)
    private readonly orgModel: Model<AppearanceSettings>,
    @InjectModel(UserAppearance.name)
    private readonly userModel: Model<UserAppearance>,
  ) {}

  // ---------------------------------------------------------------- organization

  async getPublic(): Promise<OrgAppearanceDto> {
    return this.toOrgDto(await this.loadOrg());
  }

  async getAdmin(): Promise<OrgAppearanceAdminDto> {
    const stored = await this.orgModel
      .findOne({ key: GLOBAL_APPEARANCE_KEY })
      .lean();
    return Object.assign(this.toOrgDto(stored), {
      updatedBy: stored?.updatedBy ?? null,
      lockableKeys: LOCKABLE_KEYS,
    });
  }

  /** Publish the organization's look (replaces the previous one). */
  async updateOrg(
    dto: UpdateOrgAppearanceDto,
    actor: AuthContext,
  ): Promise<OrgAppearanceAdminDto> {
    const appearance = cleanAppearance(dto.appearance, 'appearance');
    const values = {
      mode: dto.mode ?? null,
      preset: dto.preset ?? null,
      appearance,
      locked: [...new Set(dto.locked)],
    };
    const current = await this.orgModel
      .findOne({ key: GLOBAL_APPEARANCE_KEY })
      .lean();
    const currentVersion = current?.version ?? 0;
    if (dto.version !== undefined && dto.version !== currentVersion) {
      throw versionConflict();
    }
    if (!current) {
      try {
        await this.orgModel.create({
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
      const updated = await this.orgModel.findOneAndUpdate(
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
    this.logger.log({
      message: 'Organization appearance updated',
      locked: values.locked,
      by: actor.userId,
    });
    return this.getAdmin();
  }

  /** Remove the organization's look: everyone follows the built-in defaults again. */
  async resetOrg(actor: AuthContext): Promise<OrgAppearanceAdminDto> {
    await this.orgModel.deleteOne({ key: GLOBAL_APPEARANCE_KEY });
    this.cache = null;
    this.logger.log({
      message: 'Organization appearance removed',
      by: actor.userId,
    });
    return this.getAdmin();
  }

  // ---------------------------------------------------------------- per user

  async getMine(userId: string): Promise<MyAppearanceDto> {
    const stored = await this.userModel.findOne({ userId }).lean();
    return this.toMyDto(stored);
  }

  async updateMine(
    userId: string,
    dto: UpdateMyAppearanceDto,
  ): Promise<MyAppearanceDto> {
    const theme: ThemeValuesDto | null = dto.theme
      ? {
          mode: dto.theme.mode ?? null,
          preset: dto.theme.preset ?? null,
          appearance: cleanAppearance(dto.theme.appearance, 'theme.appearance'),
        }
      : null;
    const saved = await this.userModel
      .findOneAndUpdate(
        { userId },
        {
          $set: {
            syncEnabled: dto.syncEnabled,
            // Sync off or no theme: nothing personal is kept on the server.
            mode: dto.syncEnabled ? (theme?.mode ?? null) : null,
            preset: dto.syncEnabled ? (theme?.preset ?? null) : null,
            appearance: dto.syncEnabled ? (theme?.appearance ?? {}) : {},
          },
          $setOnInsert: { userId },
        },
        { upsert: true, new: true },
      )
      .lean();
    return this.toMyDto(saved);
  }

  // ---------------------------------------------------------------- internals

  private async loadOrg(): Promise<AppearanceSettings | null> {
    if (
      this.cache &&
      Date.now() - this.cache.loadedAt < APPEARANCE_CACHE_TTL_MS
    ) {
      return this.cache.value;
    }
    const value = await this.orgModel
      .findOne({ key: GLOBAL_APPEARANCE_KEY })
      .lean();
    this.cache = { value, loadedAt: Date.now() };
    return value;
  }

  private toOrgDto(stored: AppearanceSettings | null): OrgAppearanceDto {
    return {
      mode: stored?.mode ?? null,
      preset: stored?.preset ?? null,
      appearance: stored?.appearance ?? {},
      locked: stored?.locked ?? [],
      version: stored?.version ?? 0,
      updatedAt: stored?.updatedAt ?? null,
    };
  }

  private toMyDto(stored: UserAppearance | null): MyAppearanceDto {
    const hasTheme =
      stored !== null &&
      (stored.mode !== null ||
        stored.preset !== null ||
        Object.keys(stored.appearance).length > 0);
    return {
      syncEnabled: stored?.syncEnabled ?? true,
      theme: hasTheme
        ? {
            mode: stored.mode,
            preset: stored.preset,
            appearance: stored.appearance,
          }
        : null,
      updatedAt: stored?.updatedAt ?? null,
    };
  }
}
