import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { BaseSchema, baseSchemaOptions } from '@database/schemas/base.schema';

import {
  AttributeDataType,
  AttributeGroupType,
  AttributeKind,
  AttributeMutability,
  AttributeReturned,
} from '../enums/user-schema.enum';

export interface AttributeOption {
  value: string;
  label: string;
}

/**
 * One custom user variable (definition). Values live on the user document in
 * `attributes.<name>` (groups: `attributes.<group>.<child>`); core variables
 * (email, given_name, …) map to built-in user fields instead.
 */
@Schema({ ...baseSchemaOptions, collection: 'user_attributes' })
export class UserAttribute extends BaseSchema {
  @Prop({ type: String, required: true })
  name!: string;

  @Prop({ type: String, required: true })
  label!: string;

  @Prop({ type: String, default: '' })
  description!: string;

  @Prop({ type: String, required: true, enum: Object.values(AttributeKind) })
  kind!: AttributeKind;

  /** FIELD only. */
  @Prop({
    type: String,
    default: null,
    enum: [...Object.values(AttributeDataType), null],
  })
  dataType!: AttributeDataType | null;

  /** GROUP only. */
  @Prop({
    type: String,
    default: null,
    enum: [...Object.values(AttributeGroupType), null],
  })
  groupType!: AttributeGroupType | null;

  /** Parent GROUP id; null at the top level. */
  @Prop({ type: String, default: null, index: true })
  parentId!: string | null;

  @Prop({ type: [{ _id: false, value: String, label: String }], default: [] })
  options!: AttributeOption[];

  @Prop({ type: Number, default: null })
  minLength!: number | null;

  @Prop({ type: Number, default: null })
  maxLength!: number | null;

  @Prop({ type: Number, default: null })
  min!: number | null;

  @Prop({ type: Number, default: null })
  max!: number | null;

  @Prop({ type: [String], default: [] })
  scopes!: string[];

  @Prop({ type: [String], default: [] })
  locales!: string[];

  @Prop({ required: true, default: true })
  isEnabled!: boolean;

  @Prop({ required: true, default: false })
  isRequired!: boolean;

  /** Admins only: hidden from the user and not editable by them. */
  @Prop({ required: true, default: false })
  isInternal!: boolean;

  /** Can be used to sign in (as the `username` identifier). Implies unique. */
  @Prop({ required: true, default: false })
  isUsername!: boolean;

  /** Stored hashed, never returned. */
  @Prop({ required: true, default: false })
  isPassword!: boolean;

  @Prop({ required: true, default: false })
  isUnique!: boolean;

  /** The value must equal `matchWith` in the same request (e.g. confirm fields). */
  @Prop({ required: true, default: false })
  isMatchEnabled!: boolean;

  @Prop({ type: String, default: null })
  matchWith!: string | null;

  /** Added to the access token (claim `attrs`). */
  @Prop({ required: true, default: false })
  includeInToken!: boolean;

  /** Admins can filter the user list by it. */
  @Prop({ required: true, default: false })
  includeInSearchFilter!: boolean;

  @Prop({
    type: String,
    required: true,
    enum: Object.values(AttributeMutability),
    default: AttributeMutability.ReadWrite,
  })
  mutability!: AttributeMutability;

  @Prop({
    type: String,
    required: true,
    enum: Object.values(AttributeReturned),
    default: AttributeReturned.Default,
  })
  returned!: AttributeReturned;

  @Prop({ required: true, default: 0 })
  displayOrder!: number;

  /** Seeded OpenID Connect claim: name, type and structure are fixed. */
  @Prop({ required: true, default: false })
  isSystem!: boolean;

  /** Built-in user field the variable maps to (system variables only). */
  @Prop({ type: String, default: null })
  coreField!: string | null;

  @Prop({ type: String, required: true })
  createdBy!: string;

  @Prop({ type: String, required: true })
  updatedBy!: string;

  @Prop({ required: true, default: 1 })
  version!: number;
}

export const UserAttributeSchema = SchemaFactory.createForClass(UserAttribute);
UserAttributeSchema.index({ parentId: 1, name: 1 }, { unique: true });
UserAttributeSchema.index({ displayOrder: 1, name: 1 });
