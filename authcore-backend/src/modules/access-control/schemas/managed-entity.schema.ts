import { Prop } from '@nestjs/mongoose';

import { BaseSchema } from '@database/schemas/base.schema';

import { RecordStatus } from '../enums/access-control.enum';

/**
 * Fields shared by roles, permissions and groups: status, system protection,
 * soft delete and who changed what. Unique indexes are partial on
 * `isDeleted: false`, so keys and names can be reused after a delete.
 */
export abstract class ManagedEntity extends BaseSchema {
  @Prop({
    type: String,
    required: true,
    enum: Object.values(RecordStatus),
    default: RecordStatus.Active,
    index: true,
  })
  status!: RecordStatus;

  /** Seeded by AuthCore: cannot be edited or deleted. */
  @Prop({ required: true, default: false })
  isSystem!: boolean;

  @Prop({ required: true, default: false, index: true })
  isDeleted!: boolean;

  @Prop({ type: Date, default: null })
  deletedAt!: Date | null;

  @Prop({ type: String, default: null })
  deletedBy!: string | null;

  @Prop({ type: String, required: true })
  createdBy!: string;

  @Prop({ type: String, required: true })
  updatedBy!: string;

  /** Incremented on every update; clients may send it back to detect concurrent edits. */
  @Prop({ required: true, default: 1 })
  version!: number;
}

/** Index options for "unique among non-deleted records". */
export const UNIQUE_ACTIVE = {
  unique: true,
  partialFilterExpression: { isDeleted: false },
} as const;

export const UNIQUE_ACTIVE_CASE_INSENSITIVE = {
  ...UNIQUE_ACTIVE,
  collation: { locale: 'en', strength: 2 },
} as const;
