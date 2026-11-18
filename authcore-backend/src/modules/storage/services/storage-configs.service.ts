import { statfs } from 'node:fs/promises';

import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { ErrorCode } from '@common/constants/error-codes.constants';
import { AppException } from '@common/exceptions/app.exception';
import type { AuthContext } from '@common/interfaces/auth-context.interface';
import { StoredFile } from '@modules/files/schemas/stored-file.schema';

import {
  LOCAL_STORAGE_CONFIG_ID,
  STORAGE_SETTING_MAX_LENGTH,
} from '../constants/storage.constants';
import { LocalStorageDriver } from '../drivers/local.driver';
import { S3StorageDriver } from '../drivers/s3.driver';
import type {
  CreateStorageConfigDto,
  StorageConfigDto,
  StorageProviderDto,
  StorageTestResultDto,
  StorageUsageDto,
  TestStorageConfigDto,
  UpdateStorageConfigDto,
} from '../dto/storage-config.dto';
import type {
  StorageProviderDefinition,
  StorageProviderId,
  StorageValues,
} from '../providers';
import {
  StorageConfig,
  type StorageTestResult,
} from '../schemas/storage-config.schema';
import { maskSecret } from '../utils/secret-box.util';

interface Stored {
  count: number;
  bytes: number;
}
import { StorageManagerService } from './storage-manager.service';

interface FieldError {
  field: string;
  message: string;
}

const notFound = () =>
  new AppException(
    HttpStatus.NOT_FOUND,
    ErrorCode.NotFound,
    'Storage not found',
  );

/** Provider messages can be long XML / stack text: keep the first useful line. */
function cleanMessage(error: unknown): string {
  // Network failures (refused, DNS, timeout) carry a code but often no message.
  const nested = (error as { errors?: unknown[] } | null)?.errors?.[0];
  const code =
    (error as { code?: unknown } | null)?.code ??
    (nested as { code?: unknown } | undefined)?.code;
  if (typeof code === 'string' && /^E[A-Z]+$/.test(code)) {
    return `Cannot reach the storage endpoint (${code}). Check the endpoint / region.`;
  }
  const raw =
    error instanceof Error
      ? `${error.name === 'Error' ? '' : `${error.name}: `}${error.message}`
      : String(error);
  return raw.split('\n')[0]?.slice(0, 300) || 'Unknown error';
}

/**
 * Storage settings: CRUD of storage configs, connection tests, the active storage.
 * Values are validated against the provider definition (providers/*.provider.ts); secrets
 * are sealed before they reach the database and never returned.
 */
@Injectable()
export class StorageConfigsService {
  private readonly logger = new Logger(StorageConfigsService.name);

  constructor(
    @InjectModel(StorageConfig.name)
    private readonly configModel: Model<StorageConfig>,
    @InjectModel(StoredFile.name)
    private readonly fileModel: Model<StoredFile>,
    private readonly manager: StorageManagerService,
  ) {}

  providers(): StorageProviderDto[] {
    return this.manager.allDefinitions().map((d) => ({
      id: d.id,
      label: d.label,
      description: d.description,
      ...(d.docsUrl ? { docsUrl: d.docsUrl } : {}),
      isBuiltIn: d.isBuiltIn === true,
      // `normalize` is server-only (a function): not sent.
      fields: d.fields.map(({ normalize: _normalize, ...f }) => f),
    }));
  }

  async list(): Promise<StorageConfigDto[]> {
    const configs = await this.configModel
      .find()
      .sort({ isBuiltIn: -1, createdAt: 1 })
      .lean();
    const usage = await this.storedByConfig();
    return Promise.all(configs.map((c) => this.toDto(c, usage.get(c._id))));
  }

  async get(id: string): Promise<StorageConfigDto> {
    const config = await this.configModel.findById(id).lean();
    if (!config) {
      throw notFound();
    }
    const usage = await this.storedByConfig();
    return this.toDto(config, usage.get(id));
  }

  async create(
    dto: CreateStorageConfigDto,
    actor: AuthContext,
  ): Promise<StorageConfigDto> {
    const definition = this.cloudDefinition(dto.provider);
    const settings = this.cleanSettings(definition, dto.settings);
    const secrets = this.cleanSecrets(definition, dto.secrets, null);
    const created = await this.configModel.create({
      name: dto.name,
      provider: dto.provider,
      settings,
      secrets: this.sealAll(secrets),
      isActive: false,
      isBuiltIn: false,
      lastTest: null,
      version: 1,
      createdBy: actor.userId,
      updatedBy: actor.userId,
    });
    this.logger.log({
      message: 'Storage added',
      storageId: created._id,
      provider: dto.provider,
      by: actor.userId,
    });
    return this.toDto(
      created.toObject<StorageConfig>({ transform: false }),
      undefined,
    );
  }

  async update(
    id: string,
    dto: UpdateStorageConfigDto,
    actor: AuthContext,
  ): Promise<StorageConfigDto> {
    const current = await this.configModel.findById(id).lean();
    if (!current) {
      throw notFound();
    }
    if (current.isBuiltIn) {
      throw new AppException(
        HttpStatus.CONFLICT,
        ErrorCode.Conflict,
        'The local folder is configured on the server (STORAGE_LOCAL_DIR), not here',
      );
    }
    if (dto.version !== undefined && dto.version !== current.version) {
      throw new AppException(
        HttpStatus.CONFLICT,
        ErrorCode.VersionConflict,
        'Someone else changed this storage. Reload and try again.',
      );
    }
    const definition = this.cloudDefinition(current.provider);
    const $set: Partial<StorageConfig> = { updatedBy: actor.userId };
    if (dto.name !== undefined) {
      $set.name = dto.name;
    }
    if (dto.settings !== undefined) {
      $set.settings = this.cleanSettings(definition, dto.settings);
    }
    if (dto.secrets !== undefined) {
      const changed = this.cleanSecrets(
        definition,
        dto.secrets,
        current.secrets,
      );
      $set.secrets = { ...current.secrets, ...this.sealAll(changed) };
    }
    // Different values = the last test no longer says anything about them.
    if ($set.settings !== undefined || $set.secrets !== undefined) {
      $set.lastTest = null;
    }
    const updated = await this.configModel
      .findOneAndUpdate(
        { _id: id, version: current.version },
        { $set: { ...$set, version: current.version + 1 } },
        { new: true },
      )
      .lean();
    if (!updated) {
      throw new AppException(
        HttpStatus.CONFLICT,
        ErrorCode.VersionConflict,
        'Someone else changed this storage. Reload and try again.',
      );
    }
    this.manager.invalidate();
    this.logger.log({
      message: 'Storage updated',
      storageId: id,
      by: actor.userId,
    });
    return this.get(id);
  }

  async remove(id: string, actor: AuthContext): Promise<{ id: string }> {
    const config = await this.configModel.findById(id).lean();
    if (!config) {
      throw notFound();
    }
    if (config.isBuiltIn) {
      throw new AppException(
        HttpStatus.CONFLICT,
        ErrorCode.Conflict,
        'The local folder is built in and cannot be deleted',
      );
    }
    if (config.isActive) {
      throw new AppException(
        HttpStatus.CONFLICT,
        ErrorCode.Conflict,
        'This storage is active. Activate another one first.',
      );
    }
    const fileCount = await this.fileModel.countDocuments({
      storageConfigId: id,
    });
    if (fileCount > 0) {
      throw new AppException(
        HttpStatus.CONFLICT,
        ErrorCode.Conflict,
        `${String(fileCount)} file(s) are stored here; deleting it would break them`,
      );
    }
    await this.configModel.deleteOne({ _id: id });
    this.manager.invalidate();
    this.logger.log({
      message: 'Storage deleted',
      storageId: id,
      by: actor.userId,
    });
    return { id };
  }

  /** Test unsaved values from the form (secrets left empty fall back to the saved ones). */
  async testValues(dto: TestStorageConfigDto): Promise<StorageTestResultDto> {
    const definition = this.cloudDefinition(dto.provider);
    const settings = this.cleanSettings(definition, dto.settings);
    let saved: Record<string, string> | null = null;
    if (dto.id) {
      const config = await this.configModel.findById(dto.id).lean();
      if (!config) {
        throw notFound();
      }
      saved = config.secrets;
    }
    const secrets = this.cleanSecrets(definition, dto.secrets, saved);
    const values: StorageValues = { settings, secrets: { ...secrets } };
    if (saved) {
      for (const [key, sealed] of Object.entries(saved)) {
        if (values.secrets[key] === undefined) {
          values.secrets[key] = this.manager.open(sealed) ?? '';
        }
      }
    }
    return this.probe(dto.provider, values);
  }

  /** Test a saved storage and remember the result. */
  async test(id: string): Promise<StorageTestResultDto> {
    const config = await this.configModel.findById(id).lean();
    if (!config) {
      throw notFound();
    }
    let result: StorageTestResult;
    try {
      result = await this.probe(config.provider, this.manager.valuesOf(config));
    } catch (error) {
      result = {
        isSuccess: false,
        message: cleanMessage(error),
        durationMs: 0,
        testedAt: new Date(),
      };
    }
    await this.configModel.updateOne(
      { _id: id },
      { $set: { lastTest: result } },
    );
    return result;
  }

  /** Test, then make it the storage for new uploads. */
  async activate(id: string, actor: AuthContext): Promise<StorageConfigDto> {
    const config = await this.configModel.findById(id).lean();
    if (!config) {
      throw notFound();
    }
    if (!config.isActive) {
      const result = await this.test(id);
      if (!result.isSuccess) {
        throw new AppException(
          HttpStatus.BAD_REQUEST,
          ErrorCode.StorageConnectionFailed,
          `Not activated: the connection test failed — ${result.message}`,
        );
      }
      // Partial unique index: at most one active. Switch off the others, then this one on.
      await this.configModel.updateMany(
        { isActive: true, _id: { $ne: id } },
        { $set: { isActive: false, updatedBy: actor.userId } },
      );
      await this.configModel.updateOne(
        { _id: id },
        {
          $set: { isActive: true, updatedBy: actor.userId },
          $inc: { version: 1 },
        },
      );
      this.manager.invalidate();
      this.logger.log({
        message: 'Active storage changed',
        storageId: id,
        provider: config.provider,
        by: actor.userId,
      });
    }
    return this.get(id);
  }

  // ---------------------------------------------------------------- internals

  private async probe(
    provider: StorageProviderId,
    values: StorageValues,
  ): Promise<StorageTestResult> {
    const started = Date.now();
    const { driver } = this.manager.resolve('test', provider, values);
    try {
      if (driver instanceof S3StorageDriver) {
        await driver.probe();
      } else if (driver instanceof LocalStorageDriver) {
        if (!(await driver.isHealthy())) {
          throw new Error(`Folder ${driver.directory} is not writable`);
        }
      }
      return {
        isSuccess: true,
        message: 'Connected: wrote, read and deleted a test file',
        durationMs: Date.now() - started,
        testedAt: new Date(),
      };
    } catch (error) {
      return {
        isSuccess: false,
        message: cleanMessage(error),
        durationMs: Date.now() - started,
        testedAt: new Date(),
      };
    } finally {
      if (driver instanceof S3StorageDriver) {
        driver.destroy();
      }
    }
  }

  private cloudDefinition(
    provider: StorageProviderId,
  ): StorageProviderDefinition {
    const definition = this.manager.definition(provider);
    if (!definition || definition.isBuiltIn) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.ValidationFailed,
        'Unknown storage provider',
        [{ field: 'provider', message: 'not a configurable provider' }],
      );
    }
    return definition;
  }

  /** Only the provider's non-secret fields; required / pattern / type checked. */
  private cleanSettings(
    definition: StorageProviderDefinition,
    input: Record<string, unknown>,
  ): Record<string, string | boolean> {
    const errors: FieldError[] = [];
    const out: Record<string, string | boolean> = {};
    const known = new Set(definition.fields.map((f) => f.key));
    for (const key of Object.keys(input)) {
      const field = definition.fields.find((f) => f.key === key);
      if (!known.has(key) || field?.secret) {
        errors.push({ field: `settings.${key}`, message: 'unknown field' });
      }
    }
    for (const field of definition.fields.filter((f) => !f.secret)) {
      const value = input[field.key];
      if (field.type === 'boolean') {
        if (value !== undefined && typeof value !== 'boolean') {
          errors.push({
            field: `settings.${field.key}`,
            message: 'must be true or false',
          });
        }
        out[field.key] = value === true;
        continue;
      }
      if (value !== undefined && typeof value !== 'string') {
        errors.push({
          field: `settings.${field.key}`,
          message: 'must be text',
        });
        continue;
      }
      const text = (value ?? '').trim();
      if (!text) {
        if (field.required) {
          errors.push({
            field: `settings.${field.key}`,
            message: `${field.label} is required`,
          });
        }
        continue;
      }
      if (text.length > STORAGE_SETTING_MAX_LENGTH) {
        errors.push({ field: `settings.${field.key}`, message: 'too long' });
      } else if (field.pattern && !new RegExp(field.pattern).test(text)) {
        errors.push({
          field: `settings.${field.key}`,
          message: field.formatHint ?? `${field.label} has an invalid format`,
        });
      } else {
        // e.g. a pasted endpoint stored as its region.
        out[field.key] = field.normalize ? field.normalize(text) : text;
      }
    }
    if (errors.length) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.ValidationFailed,
        'Check the storage settings',
        errors,
      );
    }
    return out;
  }

  /**
   * Secret fields that were entered. `saved` = existing sealed secrets (edit): a missing or
   * empty value keeps the saved one; without them every required secret is needed.
   */
  private cleanSecrets(
    definition: StorageProviderDefinition,
    input: Record<string, unknown>,
    saved: Record<string, string> | null,
  ): Record<string, string> {
    const errors: FieldError[] = [];
    const out: Record<string, string> = {};
    const secretFields = definition.fields.filter((f) => f.secret);
    for (const key of Object.keys(input)) {
      if (!secretFields.some((f) => f.key === key)) {
        errors.push({ field: `secrets.${key}`, message: 'unknown secret' });
      }
    }
    for (const field of secretFields) {
      const value = input[field.key];
      const text = typeof value === 'string' ? value.trim() : '';
      if (text) {
        if (text.length > STORAGE_SETTING_MAX_LENGTH) {
          errors.push({ field: `secrets.${field.key}`, message: 'too long' });
        } else if (field.pattern && !new RegExp(field.pattern).test(text)) {
          errors.push({
            field: `secrets.${field.key}`,
            message: field.formatHint ?? `${field.label} has an invalid format`,
          });
        } else {
          out[field.key] = text;
        }
      } else if (field.required && !saved?.[field.key]) {
        errors.push({
          field: `secrets.${field.key}`,
          message: `${field.label} is required`,
        });
      }
    }
    if (errors.length) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.ValidationFailed,
        'Check the storage credentials',
        errors,
      );
    }
    return out;
  }

  private sealAll(secrets: Record<string, string>): Record<string, string> {
    return Object.fromEntries(
      Object.entries(secrets).map(([key, value]) => [
        key,
        this.manager.seal(value),
      ]),
    );
  }

  /** Files and bytes per storage, from the file records. */
  private async storedByConfig(): Promise<Map<string, Stored>> {
    const rows = await this.fileModel.aggregate<{
      _id: string | null;
      count: number;
      bytes: number;
    }>([
      {
        $group: {
          _id: '$storageConfigId',
          count: { $sum: 1 },
          bytes: { $sum: '$size' },
        },
      },
    ]);
    const stored = new Map<string, Stored>();
    for (const row of rows) {
      // Files from before storage settings (no id) are in the local folder.
      const id = row._id ?? LOCAL_STORAGE_CONFIG_ID;
      const current = stored.get(id) ?? { count: 0, bytes: 0 };
      stored.set(id, {
        count: current.count + row.count,
        bytes: current.bytes + row.bytes,
      });
    }
    return stored;
  }

  /**
   * Used / capacity: the local folder reports its disk; buckets have no capacity API, so
   * the optional "Storage limit (GB)" setting is used.
   */
  private async usageOf(
    config: StorageConfig,
    definition: StorageProviderDefinition | undefined,
    stored: Stored,
  ): Promise<StorageUsageDto> {
    const usage: StorageUsageDto = {
      fileCount: stored.count,
      usedBytes: stored.bytes,
      capacityBytes: null,
      freeBytes: null,
      capacitySource: null,
    };
    const driverConfig = definition?.toDriverConfig({
      settings: config.settings,
      secrets: {},
    });
    if (driverConfig?.kind === 'local') {
      try {
        const local = new LocalStorageDriver(driverConfig.directory);
        await local.isHealthy(); // creates the folder if missing
        const disk = await statfs(local.directory);
        usage.capacityBytes = disk.blocks * disk.bsize;
        usage.freeBytes = disk.bavail * disk.bsize;
        usage.capacitySource = 'disk';
      } catch {
        // Unknown disk: show the used part only.
      }
      return usage;
    }
    const quotaGb = Number(config.settings.quotaGb);
    if (Number.isFinite(quotaGb) && quotaGb > 0) {
      usage.capacityBytes = Math.round(quotaGb * 1024 ** 3);
      usage.freeBytes = Math.max(0, usage.capacityBytes - stored.bytes);
      usage.capacitySource = 'limit';
    }
    return usage;
  }

  private async toDto(
    config: StorageConfig,
    stored: Stored | undefined,
  ): Promise<StorageConfigDto> {
    const definition = this.manager.definition(config.provider);
    const secrets: StorageConfigDto['secrets'] = {};
    for (const field of definition?.fields.filter((f) => f.secret) ?? []) {
      const sealed = config.secrets[field.key];
      const plain = sealed ? this.manager.open(sealed) : null;
      secrets[field.key] = {
        isSet: Boolean(sealed),
        hint: plain ? maskSecret(plain) : null,
      };
    }
    let publicUrlExample: string | null = null;
    if (definition) {
      try {
        const values = { settings: config.settings, secrets: {} };
        const driverConfig = definition.toDriverConfig(values);
        const prefix =
          driverConfig.kind === 's3' && driverConfig.prefix
            ? `${driverConfig.prefix}/`
            : '';
        publicUrlExample = definition.publicUrl(
          values,
          `${prefix}upload/2026/01/example.png`,
        );
      } catch {
        publicUrlExample = null;
      }
    }
    return {
      id: config._id,
      name: config.name,
      provider: config.provider,
      providerLabel: definition?.label ?? config.provider,
      settings: config.settings,
      secrets,
      isActive: config.isActive,
      isBuiltIn: config.isBuiltIn,
      lastTest: config.lastTest,
      fileCount: stored?.count ?? 0,
      usage: await this.usageOf(
        config,
        definition,
        stored ?? { count: 0, bytes: 0 },
      ),
      publicUrlExample,
      version: config.version,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  }
}
