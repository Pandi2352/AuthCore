import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { BaseSchema, baseSchemaOptions } from '@database/schemas/base.schema';

import { VerificationMethod } from '../enums/verification-method.enum';

/**
 * One pending email verification per user. Only an HMAC of the code / token
 * is stored. Expired records are removed by the TTL index on `expiresAt`.
 */
@Schema({ ...baseSchemaOptions, collection: 'email_verifications' })
export class EmailVerification extends BaseSchema {
  /** One active verification per user: issuing a new one replaces it. */
  @Prop({ type: String, required: true, unique: true, ref: 'User' })
  userId!: string;

  @Prop({
    type: String,
    required: true,
    enum: Object.values(VerificationMethod),
  })
  method!: VerificationMethod;

  /** HMAC-SHA256 of the code / token. Indexed for link-token lookups. */
  @Prop({ required: true, index: true })
  tokenHash!: string;

  /** MongoDB deletes the record shortly after this time. */
  @Prop({ type: Date, required: true, expires: 0 })
  expiresAt!: Date;

  /** Failed code attempts (OTP). */
  @Prop({ required: true, default: 0 })
  attempts!: number;

  /** For the resend cooldown. */
  @Prop({ type: Date, required: true })
  lastSentAt!: Date;
}

export const EmailVerificationSchema =
  SchemaFactory.createForClass(EmailVerification);
