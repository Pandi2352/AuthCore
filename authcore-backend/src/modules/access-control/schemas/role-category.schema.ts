import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { BaseSchema, baseSchemaOptions } from '@database/schemas/base.schema';

/** A role category added by an admin (the built-in ones live in ROLE_CATEGORIES). */
@Schema({ ...baseSchemaOptions, collection: 'role_categories' })
export class RoleCategory extends BaseSchema {
  /** FINANCE_TEAM */
  @Prop({ type: String, required: true, unique: true })
  value!: string;

  /** Finance team */
  @Prop({ type: String, required: true, trim: true })
  label!: string;

  @Prop({ type: String, required: true })
  createdBy!: string;
}

export const RoleCategorySchema = SchemaFactory.createForClass(RoleCategory);
