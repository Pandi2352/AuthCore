import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { BaseSchema, baseSchemaOptions } from '@database/schemas/base.schema';

/**
 * Failed sign-in counter per account ("user:<id>") or, for identifiers that
 * don't belong to an account, per hashed identifier. Removed by the TTL index
 * once the window or lock has passed.
 */
@Schema({ ...baseSchemaOptions, collection: 'login_attempts' })
export class LoginAttempt extends BaseSchema {
  @Prop({ type: String, required: true, unique: true, maxlength: 100 })
  key!: string;

  @Prop({ required: true, default: 0 })
  failedCount!: number;

  @Prop({ type: Date, default: null })
  windowStartedAt!: Date | null;

  @Prop({ type: Date, default: null })
  lockedUntil!: Date | null;

  @Prop({ type: Date, required: true, expires: 0 })
  expiresAt!: Date;
}

export const LoginAttemptSchema = SchemaFactory.createForClass(LoginAttempt);
