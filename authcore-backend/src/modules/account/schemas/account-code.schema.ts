import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { BaseSchema, baseSchemaOptions } from '@database/schemas/base.schema';

import { AccountCodePurpose } from '../enums/account-code-purpose.enum';

/**
 * One pending emailed code per (user, purpose); a new request replaces it.
 * Only an HMAC of the code is stored; MongoDB removes it after `expiresAt`.
 */
@Schema({ ...baseSchemaOptions, collection: 'account_codes' })
export class AccountCode extends BaseSchema {
  @Prop({ type: String, required: true, ref: 'User' })
  userId!: string;

  @Prop({
    type: String,
    required: true,
    enum: Object.values(AccountCodePurpose),
  })
  purpose!: AccountCodePurpose;

  @Prop({ type: String, required: true })
  codeHash!: string;

  @Prop({ required: true, default: 0 })
  attempts!: number;

  /** EMAIL_CHANGE: the address being confirmed. */
  @Prop({ type: String, default: null })
  newEmail!: string | null;

  @Prop({ type: Date, required: true })
  lastSentAt!: Date;

  @Prop({ type: Date, required: true, expires: 0 })
  expiresAt!: Date;
}

export const AccountCodeSchema = SchemaFactory.createForClass(AccountCode);
AccountCodeSchema.index({ userId: 1, purpose: 1 }, { unique: true });
