import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { BaseSchema, baseSchemaOptions } from '@database/schemas/base.schema';

/** A group category added by an admin (the built-in ones live in GROUP_CATEGORIES). */
@Schema({ ...baseSchemaOptions, collection: 'group_categories' })
export class GroupCategory extends BaseSchema {
  /** FIELD_TEAMS */
  @Prop({ type: String, required: true, unique: true })
  value!: string;

  /** Field teams */
  @Prop({ type: String, required: true, trim: true })
  label!: string;

  @Prop({ type: String, required: true })
  createdBy!: string;
}

export const GroupCategorySchema = SchemaFactory.createForClass(GroupCategory);
