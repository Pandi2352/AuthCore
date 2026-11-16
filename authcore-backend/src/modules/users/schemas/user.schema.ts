import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

import { BaseSchema, baseSchemaOptions } from '@database/schemas/base.schema';

import { UserRole } from '../enums/user-role.enum';
import { UserStatus } from '../enums/user-status.enum';

@Schema({ ...baseSchemaOptions, collection: 'users' })
export class User extends BaseSchema {
  /** Login identity. Stored lowercase; unique. */
  @Prop({
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    maxlength: 254,
  })
  email!: string;

  /** Optional login identity. Stored lowercase; unique when set. */
  @Prop({ type: String, lowercase: true, trim: true, maxlength: 30 })
  username?: string;

  @Prop({ required: true, trim: true, maxlength: 50 })
  firstName!: string;

  @Prop({ type: String, trim: true, maxlength: 50 })
  lastName?: string;

  /** Argon2id hash. Never selected unless asked for with .select('+passwordHash'). */
  @Prop({ required: true, select: false })
  passwordHash!: string;

  @Prop({
    type: String,
    required: true,
    enum: Object.values(UserStatus),
    default: UserStatus.PendingVerification,
    index: true,
  })
  status!: UserStatus;

  @Prop({
    type: String,
    required: true,
    enum: Object.values(UserRole),
    default: UserRole.User,
    index: true,
  })
  role!: UserRole;

  @Prop({ required: true, default: false })
  isEmailVerified!: boolean;

  @Prop({ type: Date, default: null })
  emailVerifiedAt!: Date | null;

  /** Hashes of previous passwords (most recent last), to prevent reuse. Never selected by default. */
  @Prop({ type: [String], default: [], select: false })
  passwordHistory!: string[];

  /** Set on registration and every password change; used to invalidate old tokens. */
  @Prop({ type: Date, required: true })
  passwordChangedAt!: Date;

  /** When an administrator approved or rejected the registration. */
  @Prop({ type: Date, default: null })
  reviewedAt!: Date | null;

  /** Who reviewed it (admin user id; "cli" for the command-line script). */
  @Prop({ type: String, default: null, maxlength: 100 })
  reviewedBy!: string | null;

  /** Optional reason given when rejecting; may be emailed to the user. */
  @Prop({ type: String, default: null, maxlength: 500 })
  rejectionReason!: string | null;

  @Prop({ type: Date, default: null })
  lastLoginAt!: Date | null;

  /** Soft delete. A deleted user is treated as not existing (e.g. can't sign in). */
  @Prop({ type: Date, default: null, index: true })
  deletedAt!: Date | null;
}

export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);

// Username is optional: unique only among users who have one.
UserSchema.index(
  { username: 1 },
  { unique: true, partialFilterExpression: { username: { $type: 'string' } } },
);
