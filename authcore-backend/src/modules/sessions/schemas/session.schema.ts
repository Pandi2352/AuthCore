import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { BaseSchema, baseSchemaOptions } from '@database/schemas/base.schema';

/**
 * One signed-in device. `_id` is the session id (`sid` in access tokens).
 * Only a SHA-256 hash of the refresh token is stored. MongoDB deletes the
 * record shortly after `expiresAt` (TTL index).
 */
@Schema({ ...baseSchemaOptions, collection: 'sessions' })
export class Session extends BaseSchema {
  @Prop({ type: String, required: true, index: true, ref: 'User' })
  userId!: string;

  /** Stays the same across refresh-token rotations of this login. */
  @Prop({ type: String, required: true, index: true })
  tokenFamilyId!: string;

  /** SHA-256 of the current refresh token. */
  @Prop({ type: String, required: true, unique: true })
  refreshTokenHash!: string;

  /** "Remember me": longer lifetime and a persistent cookie. */
  @Prop({ required: true, default: false })
  isPersistent!: boolean;

  @Prop({ type: String, required: true, maxlength: 64 })
  ipAddress!: string;

  @Prop({ type: String, default: '', maxlength: 512 })
  userAgent!: string;

  @Prop({ type: String, required: true, maxlength: 20 })
  deviceType!: string;

  @Prop({ type: String, default: null, maxlength: 100 })
  browser!: string | null;

  @Prop({ type: String, default: null, maxlength: 100 })
  os!: string | null;

  @Prop({ type: String, required: true, maxlength: 200 })
  deviceName!: string;

  @Prop({ type: Date, required: true })
  lastUsedAt!: Date;

  @Prop({ type: Date, required: true, expires: 0 })
  expiresAt!: Date;

  @Prop({ type: Date, default: null })
  revokedAt!: Date | null;

  /** e.g. "logout", "session_limit", "token_reuse", "password_changed". */
  @Prop({ type: String, default: null, maxlength: 50 })
  revokedReason!: string | null;
}

export const SessionSchema = SchemaFactory.createForClass(Session);

// Active sessions of a user, oldest first (session limit, session list).
SessionSchema.index({ userId: 1, revokedAt: 1, lastUsedAt: 1 });
