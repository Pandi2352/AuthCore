import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { BaseSchema, baseSchemaOptions } from '@database/schemas/base.schema';

import { InviteStatus } from '../enums/invite-status.enum';

/**
 * An emailed invitation. Only an HMAC of the link token is stored. A PENDING
 * invite past `expiresAt` counts as EXPIRED (stored lazily). One pending
 * invite per email (partial unique index).
 */
@Schema({ ...baseSchemaOptions, collection: 'user_invites' })
export class UserInvite extends BaseSchema {
  @Prop({ type: String, required: true, lowercase: true, trim: true })
  email!: string;

  @Prop({ type: String, default: null })
  firstName!: string | null;

  @Prop({ type: String, default: null })
  lastName!: string | null;

  /** Groups the new user joins on acceptance. */
  @Prop({ type: [String], default: [] })
  groupIds!: string[];

  @Prop({ type: String, default: null, maxlength: 500 })
  message!: string | null;

  /** Invitation email language; becomes the new user's preferences.language. */
  @Prop({ type: String, default: null, maxlength: 10 })
  language!: string | null;

  @Prop({ type: String, required: true, index: true })
  tokenHash!: string;

  @Prop({
    type: String,
    required: true,
    enum: Object.values(InviteStatus),
    index: true,
  })
  status!: InviteStatus;

  @Prop({ type: Date, required: true })
  expiresAt!: Date;

  /** Inviting user id. */
  @Prop({ type: String, required: true, index: true })
  invitedBy!: string;

  @Prop({ required: true, default: 0 })
  resendCount!: number;

  @Prop({ type: Date, required: true })
  lastSentAt!: Date;

  @Prop({ type: Date, default: null })
  acceptedAt!: Date | null;

  @Prop({ type: String, default: null })
  acceptedUserId!: string | null;

  @Prop({ type: Date, default: null })
  revokedAt!: Date | null;

  @Prop({ type: String, default: null })
  revokedBy!: string | null;
}

export const UserInviteSchema = SchemaFactory.createForClass(UserInvite);
UserInviteSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { status: InviteStatus.Pending } },
);
UserInviteSchema.index({ createdAt: -1 });
