import { Prop, type SchemaOptions } from '@nestjs/mongoose';
import { Types } from 'mongoose';

import { generateUuid } from '@common/utils/uuid.util';

/**
 * Removes internal fields from API output and exposes `_id` as `id`.
 * Applied to both toJSON and toObject so responses stay consistent.
 */
function transformOutput(_doc: unknown, ret: Record<string, unknown>) {
  if (typeof ret._id === 'string') {
    ret.id = ret._id;
  } else if (ret._id instanceof Types.ObjectId) {
    ret.id = ret._id.toHexString();
  }
  delete ret._id;
  delete ret.__v;
  return ret;
}

/**
 * Common options for every schema. Use as `@Schema(baseSchemaOptions)`, or
 * `@Schema({ ...baseSchemaOptions, collection: 'users' })` to add more.
 */
export const baseSchemaOptions: SchemaOptions = {
  // createdAt / updatedAt, stored as UTC dates
  timestamps: true,
  // Fields not defined in the schema are rejected on save
  strict: 'throw',
  // Keep __v for document versioning; it is hidden from API output
  versionKey: '__v',
  // No automatic `id` getter; transformOutput adds a plain `id` field
  id: false,
  toJSON: { virtuals: true, transform: transformOutput },
  toObject: { virtuals: true, transform: transformOutput },
};

/**
 * Base fields shared by every document. Contains no business fields.
 * Extend it in each schema class: `class User extends BaseSchema { ... }`.
 *
 * `_id` is a UUID v7 string (not an ObjectId), generated on create.
 */
export abstract class BaseSchema {
  @Prop({ type: String, default: () => generateUuid() })
  _id!: string;

  createdAt!: Date;
  updatedAt!: Date;
  __v?: number;
}
