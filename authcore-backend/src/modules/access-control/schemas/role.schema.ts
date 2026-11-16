import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { baseSchemaOptions } from '@database/schemas/base.schema';

import {
  ManagedEntity,
  UNIQUE_ACTIVE,
  UNIQUE_ACTIVE_CASE_INSENSITIVE,
} from './managed-entity.schema';

@Schema({ ...baseSchemaOptions, collection: 'roles' })
export class Role extends ManagedEntity {
  /** Uppercase identifier, e.g. ORG_ADMIN. Unique. */
  @Prop({ type: String, required: true })
  roleKey!: string;

  /** Unique within its category (case-insensitive). */
  @Prop({ type: String, required: true, trim: true })
  roleName!: string;

  @Prop({ type: String, required: true, index: true })
  category!: string;

  @Prop({ type: String, default: '' })
  description!: string;
}

export const RoleSchema = SchemaFactory.createForClass(Role);
RoleSchema.index({ roleKey: 1 }, UNIQUE_ACTIVE);
RoleSchema.index({ category: 1, roleName: 1 }, UNIQUE_ACTIVE_CASE_INSENSITIVE);
RoleSchema.index({ isDeleted: 1, updatedAt: -1 });
