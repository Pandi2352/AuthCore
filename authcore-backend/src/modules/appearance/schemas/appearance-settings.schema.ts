import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { BaseSchema, baseSchemaOptions } from '@database/schemas/base.schema';

/** The application's look, set by the super admin and applied to every user. */
@Schema({ ...baseSchemaOptions, collection: 'appearance_settings' })
export class AppearanceSettings extends BaseSchema {
  @Prop({ type: String, required: true, unique: true })
  key!: string;

  @Prop({ type: String, default: null })
  mode!: string | null;

  @Prop({ type: String, default: null })
  preset!: string | null;

  @Prop({ type: Object, default: {} })
  appearance!: Record<string, string>;

  @Prop({ required: true, default: 1 })
  version!: number;

  @Prop({ type: String, required: true })
  createdBy!: string;

  @Prop({ type: String, required: true })
  updatedBy!: string;
}

export const AppearanceSettingsSchema =
  SchemaFactory.createForClass(AppearanceSettings);
