import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { BaseSchema, baseSchemaOptions } from '@database/schemas/base.schema';

/** The organization's look: defaults for everyone + options users may not change. */
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

  /** "mode", "preset" or appearance keys users cannot change. */
  @Prop({ type: [String], default: [] })
  locked!: string[];

  @Prop({ required: true, default: 1 })
  version!: number;

  @Prop({ type: String, required: true })
  createdBy!: string;

  @Prop({ type: String, required: true })
  updatedBy!: string;
}

export const AppearanceSettingsSchema =
  SchemaFactory.createForClass(AppearanceSettings);

/** A user's own look, synced across their devices. */
@Schema({ ...baseSchemaOptions, collection: 'user_appearances' })
export class UserAppearance extends BaseSchema {
  @Prop({ type: String, required: true, unique: true })
  userId!: string;

  /** false = the user keeps the look per browser only (nothing synced). */
  @Prop({ type: Boolean, default: true })
  syncEnabled!: boolean;

  @Prop({ type: String, default: null })
  mode!: string | null;

  @Prop({ type: String, default: null })
  preset!: string | null;

  @Prop({ type: Object, default: {} })
  appearance!: Record<string, string>;
}

export const UserAppearanceSchema =
  SchemaFactory.createForClass(UserAppearance);
