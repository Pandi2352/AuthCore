import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { BaseSchema, baseSchemaOptions } from '@database/schemas/base.schema';

import { ActivityEvent, VerificationType } from '../enums/user-activity.enum';

/**
 * One account event (sign-in, failed sign-in, password change, …) with the
 * device it came from. Removed automatically after the retention period.
 * Never holds passwords, codes or tokens.
 */
@Schema({ ...baseSchemaOptions, collection: 'user_activities' })
export class UserActivity extends BaseSchema {
  @Prop({ type: String, required: true })
  userId!: string;

  @Prop({ type: String, required: true, enum: Object.values(ActivityEvent) })
  event!: ActivityEvent;

  @Prop({ type: String, required: true, enum: Object.values(VerificationType) })
  verificationType!: VerificationType;

  @Prop({ required: true, default: true })
  isSuccess!: boolean;

  @Prop({ type: String, default: null })
  ipAddress!: string | null;

  @Prop({ type: String, default: null })
  deviceType!: string | null;

  @Prop({ type: String, default: null })
  browser!: string | null;

  @Prop({ type: String, default: null })
  os!: string | null;

  @Prop({ type: String, default: null })
  deviceName!: string | null;

  @Prop({ type: String, default: null })
  sessionId!: string | null;

  /** Admin who caused the event (admin actions), else null. */
  @Prop({ type: String, default: null })
  actorId!: string | null;

  /** Small, non-sensitive context (e.g. { reason: 'wrong_password' }). */
  @Prop({ type: Object, default: null })
  details!: Record<string, unknown> | null;

  @Prop({ type: Date, required: true, expires: 0 })
  expiresAt!: Date;
}

export const UserActivitySchema = SchemaFactory.createForClass(UserActivity);
UserActivitySchema.index({ userId: 1, createdAt: -1 });
// Admin search / login history across users.
UserActivitySchema.index({ createdAt: -1 });
UserActivitySchema.index({ event: 1, createdAt: -1 });
UserActivitySchema.index({ ipAddress: 1, createdAt: -1 });
