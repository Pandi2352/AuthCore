import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { BaseSchema, baseSchemaOptions } from '@database/schemas/base.schema';

/**
 * A device (browser + OS + device type) a user has signed in from. A sign-in
 * from a fingerprint not in this list is a "new device". Entries expire after
 * KNOWN_DEVICE_RETENTION_DAYS without use.
 */
@Schema({ ...baseSchemaOptions, collection: 'known_devices' })
export class KnownDevice extends BaseSchema {
  @Prop({ type: String, required: true })
  userId!: string;

  /** SHA-256 of browser name + OS name + device type (versions ignored). */
  @Prop({ type: String, required: true })
  fingerprint!: string;

  @Prop({ type: String, required: true, maxlength: 200 })
  deviceName!: string;

  @Prop({ type: String, required: true, maxlength: 20 })
  deviceType!: string;

  @Prop({ type: String, default: null, maxlength: 100 })
  browser!: string | null;

  @Prop({ type: String, default: null, maxlength: 100 })
  os!: string | null;

  @Prop({ type: String, required: true, maxlength: 64 })
  firstIpAddress!: string;

  @Prop({ type: String, required: true, maxlength: 64 })
  lastIpAddress!: string;

  @Prop({ type: Date, required: true })
  lastSeenAt!: Date;

  @Prop({ required: true, default: 1 })
  signInCount!: number;

  @Prop({ type: Date, required: true, expires: 0 })
  expiresAt!: Date;
}

export const KnownDeviceSchema = SchemaFactory.createForClass(KnownDevice);
KnownDeviceSchema.index({ userId: 1, fingerprint: 1 }, { unique: true });
KnownDeviceSchema.index({ userId: 1, lastSeenAt: -1 });
