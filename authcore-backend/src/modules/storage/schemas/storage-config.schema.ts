import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { BaseSchema, baseSchemaOptions } from '@database/schemas/base.schema';

import { STORAGE_NAME_MAX_LENGTH } from '../constants/storage.constants';
import type { StorageProviderId } from '../providers/storage-provider.types';

export interface StorageTestResult {
  isSuccess: boolean;
  /** Provider message on failure (never contains the credentials). */
  message: string;
  durationMs: number;
  testedAt: Date;
}

/**
 * One configured storage (bucket + credentials). Exactly one is active: every upload goes
 * there. Secrets are stored sealed (AES-256-GCM, utils/secret-box.util.ts).
 */
@Schema({ ...baseSchemaOptions, collection: 'storage_configs' })
export class StorageConfig extends BaseSchema {
  @Prop({
    type: String,
    required: true,
    trim: true,
    maxlength: STORAGE_NAME_MAX_LENGTH,
  })
  name!: string;

  @Prop({ type: String, required: true })
  provider!: StorageProviderId;

  /** Non-secret values (bucket, region, endpoint, prefix, public URL …). */
  @Prop({ type: Object, default: {} })
  settings!: Record<string, string | boolean>;

  /** Sealed secret values by field key. */
  @Prop({ type: Object, default: {} })
  secrets!: Record<string, string>;

  @Prop({ type: Boolean, default: false })
  isActive!: boolean;

  @Prop({ type: Boolean, default: false })
  isBuiltIn!: boolean;

  @Prop({ type: Object, default: null })
  lastTest!: StorageTestResult | null;

  @Prop({ required: true, default: 1 })
  version!: number;

  @Prop({ type: String, required: true })
  createdBy!: string;

  @Prop({ type: String, required: true })
  updatedBy!: string;
}

export const StorageConfigSchema = SchemaFactory.createForClass(StorageConfig);
// At most one active storage, enforced by the database.
StorageConfigSchema.index(
  { isActive: 1 },
  { unique: true, partialFilterExpression: { isActive: true } },
);
