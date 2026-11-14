import { SchemaOptions } from '@nestjs/mongoose';
import { Types } from 'mongoose';

/**
 * Removes internal fields from API output and exposes `_id` as a string `id`.
 * Applied to both toJSON and toObject so responses stay consistent.
 */
function transformOutput(_doc: unknown, ret: Record<string, unknown>) {
  if (ret._id instanceof Types.ObjectId) {
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
 */
export abstract class BaseSchema {
  _id!: Types.ObjectId;
  createdAt!: Date;
  updatedAt!: Date;
  __v?: number;
}
