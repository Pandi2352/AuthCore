import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { BaseSchema, baseSchemaOptions } from '@database/schemas/base.schema';

import { NotificationStatus } from '../enums/scheduler.enum';

/**
 * One record per (user, password, reminder): the unique index prevents
 * duplicate reminder emails; FAILED ones are retried on later runs.
 */
@Schema({ ...baseSchemaOptions, collection: 'password_expiry_notifications' })
export class PasswordExpiryNotification extends BaseSchema {
  @Prop({ type: String, required: true, ref: 'User' })
  userId!: string;

  /** Identifies the password the reminder is about (changes with every password change). */
  @Prop({ type: Date, required: true })
  passwordChangedAt!: Date;

  /** The reminder threshold (e.g. 14, 7, 3 days). */
  @Prop({ required: true })
  daysBeforeExpiry!: number;

  @Prop({
    type: String,
    required: true,
    enum: Object.values(NotificationStatus),
  })
  status!: NotificationStatus;

  @Prop({ required: true, default: 0 })
  attempts!: number;

  @Prop({ type: Date, default: null })
  sentAt!: Date | null;

  /** Removed by MongoDB after this date (TTL). */
  @Prop({ type: Date, required: true, expires: 0 })
  expiresAt!: Date;
}

export const PasswordExpiryNotificationSchema = SchemaFactory.createForClass(
  PasswordExpiryNotification,
);
PasswordExpiryNotificationSchema.index(
  { userId: 1, passwordChangedAt: 1, daysBeforeExpiry: 1 },
  { unique: true },
);
