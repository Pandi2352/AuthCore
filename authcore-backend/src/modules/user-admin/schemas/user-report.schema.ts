import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { BaseSchema, baseSchemaOptions } from '@database/schemas/base.schema';

export type UserReportStatus = 'PENDING' | 'READY' | 'FAILED';

/** A generated user search report (CSV); the file itself lives in `files` (purpose REPORT). */
@Schema({ ...baseSchemaOptions, collection: 'user_reports' })
export class UserReport extends BaseSchema {
  @Prop({ type: String, required: true, index: true })
  requestedBy!: string;

  @Prop({ type: String, required: true, default: 'PENDING' })
  status!: UserReportStatus;

  @Prop({ type: String, required: true, default: 'CSV' })
  format!: 'CSV';

  @Prop({ type: String, required: true })
  fileName!: string;

  @Prop({ type: Object, default: {} })
  filters!: Record<string, unknown>;

  @Prop({ type: Number, default: null })
  rowCount!: number | null;

  @Prop({ type: Number, default: null })
  fileSize!: number | null;

  @Prop({ type: String, default: null })
  fileId!: string | null;

  @Prop({ type: Boolean, default: false })
  isTruncated!: boolean;

  @Prop({ type: String, default: null })
  error!: string | null;

  @Prop({ type: Date, default: null })
  completedAt!: Date | null;

  /** Removed (with its file) after this date. */
  @Prop({ type: Date, required: true, index: true })
  expiresAt!: Date;
}

export const UserReportSchema = SchemaFactory.createForClass(UserReport);
UserReportSchema.index({ requestedBy: 1, createdAt: -1 });
