import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { BaseSchema, baseSchemaOptions } from '@database/schemas/base.schema';

import {
  SITE_DESCRIPTION_MAX_LENGTH,
  SITE_NAME_MAX_LENGTH,
} from '../constants/business-settings.constants';

/** A stored branding image: the file in the files module and its public URL. */
export interface StoredBrandAsset {
  fileId: string;
  url: string;
}

/**
 * Business settings: one document (key "global"). Until it exists the
 * project defaults (project.config.json) are used.
 */
@Schema({ ...baseSchemaOptions, collection: 'business_settings' })
export class BusinessSettings extends BaseSchema {
  @Prop({ type: String, required: true, unique: true })
  key!: string;

  @Prop({
    type: String,
    required: true,
    trim: true,
    maxlength: SITE_NAME_MAX_LENGTH,
  })
  siteName!: string;

  @Prop({
    type: String,
    default: '',
    trim: true,
    maxlength: SITE_DESCRIPTION_MAX_LENGTH,
  })
  siteDescription!: string;

  @Prop({ type: Object, default: null })
  logo!: StoredBrandAsset | null;

  @Prop({ type: Object, default: null })
  logoMark!: StoredBrandAsset | null;

  @Prop({ type: Object, default: null })
  authLogo!: StoredBrandAsset | null;

  @Prop({ type: Object, default: null })
  favicon!: StoredBrandAsset | null;

  /** Incremented on every change (optimistic concurrency, cache busting). */
  @Prop({ required: true, default: 1 })
  version!: number;

  @Prop({ type: String, required: true })
  createdBy!: string;

  @Prop({ type: String, required: true })
  updatedBy!: string;
}

export const BusinessSettingsSchema =
  SchemaFactory.createForClass(BusinessSettings);
