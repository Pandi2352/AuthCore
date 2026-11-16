import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { BaseSchema, baseSchemaOptions } from '@database/schemas/base.schema';

export enum PasswordResetMethod {
  Otp = 'OTP',
  Link = 'LINK',
}

/**
 * One pending password reset per user (a new request replaces it).
 *
 *   forgot-password      → codeHash set (OTP or link token), expiresAt
 *   verify-reset-token   → codeHash cleared, authorizationHash set (short-lived)
 *   reset-password       → record deleted (single use)
 *
 * Only HMACs are stored. MongoDB removes the record after `expiresAt` (TTL).
 */
@Schema({ ...baseSchemaOptions, collection: 'password_resets' })
export class PasswordReset extends BaseSchema {
  @Prop({ type: String, required: true, unique: true, ref: 'User' })
  userId!: string;

  @Prop({
    type: String,
    required: true,
    enum: Object.values(PasswordResetMethod),
  })
  method!: PasswordResetMethod;

  /** HMAC of the emailed code / link token; null once verified. */
  @Prop({ type: String, default: null, index: true })
  codeHash!: string | null;

  /** Failed code attempts. */
  @Prop({ required: true, default: 0 })
  attempts!: number;

  /** HMAC of the reset token issued after verification. */
  @Prop({ type: String, default: null, index: true })
  authorizationHash!: string | null;

  @Prop({ type: Date, default: null })
  authorizationExpiresAt!: Date | null;

  @Prop({ type: Date, required: true })
  lastSentAt!: Date;

  /** Code / link expiry; after verification, the reset token's expiry. */
  @Prop({ type: Date, required: true, expires: 0 })
  expiresAt!: Date;
}

export const PasswordResetSchema = SchemaFactory.createForClass(PasswordReset);
