import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import {
  ACTIVE_STORAGE_CACHE_TTL_MS,
  LOCAL_STORAGE_CONFIG_ID,
  STORAGE_SECRETS_CONTEXT,
} from '../constants/storage.constants';
import { LocalStorageDriver } from '../drivers/local.driver';
import { S3StorageDriver } from '../drivers/s3.driver';
import type { StorageDriver } from '../drivers/storage-driver.interface';
import {
  type StorageProviderDefinition,
  type StorageProviderId,
  storageProviders,
  type StorageValues,
} from '../providers';
import { StorageConfig } from '../schemas/storage-config.schema';
import { deriveKey, openSecret, sealSecret } from '../utils/secret-box.util';

/** A storage ready to use: its driver plus how to build public URLs. */
export interface ResolvedStorage {
  configId: string;
  provider: StorageProviderId;
  driver: StorageDriver;
  /** Direct public URL of a key, or null (then serve it through the API). */
  publicUrl(key: string): string | null;
}

/**
 * Which storage is active and the driver for any configured storage. Drivers are cached per
 * config version (an edit builds a new one); the active id is re-read every
 * ACTIVE_STORAGE_CACHE_TTL_MS so other instances pick a switch up. Without a usable active
 * storage, the built-in local folder is used.
 */
@Injectable()
export class StorageManagerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StorageManagerService.name);
  private readonly definitions: Record<
    StorageProviderId,
    StorageProviderDefinition
  >;
  private readonly secretsKey: Buffer;
  private readonly drivers = new Map<
    string,
    { version: number; resolved: ResolvedStorage }
  >();
  private activeCache: { id: string; loadedAt: number } | null = null;

  constructor(
    @InjectModel(StorageConfig.name)
    private readonly configModel: Model<StorageConfig>,
    configService: ConfigService,
  ) {
    this.definitions = storageProviders(
      configService.getOrThrow<string>('storage.localDir'),
    );
    const material =
      configService.get<string>('storage.secretsKey') ||
      configService.getOrThrow<string>('auth.jwt.secret');
    if (!configService.get<string>('storage.secretsKey')) {
      this.logger.warn(
        'STORAGE_SECRETS_KEY is not set: storage credentials are encrypted with a key derived from JWT_ACCESS_SECRET. Set STORAGE_SECRETS_KEY so rotating the JWT secret does not lock them.',
      );
    }
    this.secretsKey = deriveKey(material, STORAGE_SECRETS_CONTEXT);
  }

  /** The built-in local storage exists, and something is active. */
  async onModuleInit(): Promise<void> {
    await this.configModel.updateOne(
      { _id: LOCAL_STORAGE_CONFIG_ID },
      {
        $setOnInsert: {
          _id: LOCAL_STORAGE_CONFIG_ID,
          name: 'Local folder',
          provider: 'LOCAL',
          settings: {},
          secrets: {},
          isBuiltIn: true,
          isActive: false,
          lastTest: null,
          version: 1,
          createdBy: 'system',
          updatedBy: 'system',
        },
      },
      { upsert: true },
    );
    if (!(await this.configModel.exists({ isActive: true }))) {
      await this.configModel.updateOne(
        { _id: LOCAL_STORAGE_CONFIG_ID },
        { $set: { isActive: true } },
      );
    }
  }

  onModuleDestroy(): void {
    for (const { resolved } of this.drivers.values()) {
      if (resolved.driver instanceof S3StorageDriver) {
        resolved.driver.destroy();
      }
    }
  }

  definition(
    provider: StorageProviderId,
  ): StorageProviderDefinition | undefined {
    // Stored values may name a provider this build no longer has.
    return Object.hasOwn(this.definitions, provider)
      ? this.definitions[provider]
      : undefined;
  }

  allDefinitions(): StorageProviderDefinition[] {
    return Object.values(this.definitions);
  }

  /** Where new uploads go. */
  async active(): Promise<ResolvedStorage> {
    const now = Date.now();
    if (
      !this.activeCache ||
      now - this.activeCache.loadedAt > ACTIVE_STORAGE_CACHE_TTL_MS
    ) {
      const active = await this.configModel
        .findOne({ isActive: true }, { _id: 1 })
        .lean();
      this.activeCache = {
        id: active?._id ?? LOCAL_STORAGE_CONFIG_ID,
        loadedAt: now,
      };
    }
    return this.forConfig(this.activeCache.id);
  }

  /**
   * The storage a file was written to (null = files from before storage settings existed,
   * which are in the local folder).
   */
  async forConfig(
    configId: string | null | undefined,
  ): Promise<ResolvedStorage> {
    const id = configId ?? LOCAL_STORAGE_CONFIG_ID;
    const config = await this.configModel.findById(id).lean();
    if (!config) {
      if (id !== LOCAL_STORAGE_CONFIG_ID) {
        this.logger.error({
          message: 'Storage config missing, using local folder',
          configId: id,
        });
      }
      return this.local();
    }
    const cached = this.drivers.get(id);
    if (cached && cached.version === config.version) {
      return cached.resolved;
    }
    const resolved = this.resolve(id, config.provider, this.valuesOf(config));
    if (cached?.resolved.driver instanceof S3StorageDriver) {
      cached.resolved.driver.destroy();
    }
    this.drivers.set(id, { version: config.version, resolved });
    return resolved;
  }

  /** Every configured storage (orphan cleanup). */
  async all(): Promise<ResolvedStorage[]> {
    const configs = await this.configModel.find({}, { _id: 1 }).lean();
    const resolved: ResolvedStorage[] = [];
    for (const { _id } of configs) {
      try {
        resolved.push(await this.forConfig(_id));
      } catch (error) {
        this.logger.warn({
          message: 'Storage skipped (credentials unreadable)',
          configId: _id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return resolved;
  }

  /** A driver for values that are not saved (connection test from the form). */
  resolve(
    configId: string,
    provider: StorageProviderId,
    values: StorageValues,
  ): ResolvedStorage {
    const definition = this.definitions[provider];
    const driverConfig = definition.toDriverConfig(values);
    const driver: StorageDriver =
      driverConfig.kind === 'local'
        ? new LocalStorageDriver(driverConfig.directory)
        : new S3StorageDriver(driverConfig);
    return {
      configId,
      provider,
      driver,
      publicUrl: (key) => definition.publicUrl(values, driver.objectKey(key)),
    };
  }

  /** Decrypted values of a saved config (memory only). Throws when a secret can't be read. */
  valuesOf(config: Pick<StorageConfig, 'settings' | 'secrets'>): StorageValues {
    const secrets: Record<string, string> = {};
    for (const [key, sealed] of Object.entries(config.secrets)) {
      const plain = openSecret(sealed, this.secretsKey);
      if (plain === null) {
        throw new Error(
          `Stored credential "${key}" cannot be decrypted (STORAGE_SECRETS_KEY / JWT secret changed?). Re-enter it.`,
        );
      }
      secrets[key] = plain;
    }
    return { settings: { ...config.settings }, secrets };
  }

  seal(plain: string): string {
    return sealSecret(plain, this.secretsKey);
  }

  open(sealed: string): string | null {
    return openSecret(sealed, this.secretsKey);
  }

  /** After a save / switch on this instance: use the new values at once. */
  invalidate(): void {
    this.activeCache = null;
  }

  private local(): ResolvedStorage {
    return this.resolve(LOCAL_STORAGE_CONFIG_ID, 'LOCAL', {
      settings: {},
      secrets: {},
    });
  }
}
