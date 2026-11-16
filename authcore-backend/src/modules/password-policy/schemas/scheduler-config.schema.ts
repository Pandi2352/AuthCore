import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { BaseSchema, baseSchemaOptions } from '@database/schemas/base.schema';

import {
  SchedulerExecutionStatus,
  SchedulerFrequency,
  SchedulerJob,
} from '../enums/scheduler.enum';

/**
 * One document per scheduled job: its schedule (editable without a restart)
 * and execution state. `lockedUntil` / `lockedBy` make sure only one
 * instance runs a job at a time.
 */
@Schema({ ...baseSchemaOptions, collection: 'password_scheduler_configs' })
export class SchedulerConfig extends BaseSchema {
  @Prop({
    type: String,
    required: true,
    unique: true,
    enum: Object.values(SchedulerJob),
  })
  job!: SchedulerJob;

  @Prop({ required: true, default: false })
  enabled!: boolean;

  @Prop({
    type: String,
    required: true,
    enum: Object.values(SchedulerFrequency),
  })
  frequency!: SchedulerFrequency;

  /** HH:mm (24h) in `timezone`; for HOURLY only the minutes are used. */
  @Prop({ type: String, required: true })
  executionTime!: string;

  /** IANA zone, e.g. Asia/Kolkata. */
  @Prop({ type: String, required: true })
  timezone!: string;

  /** WEEKLY: 1 = Monday … 7 = Sunday. */
  @Prop({ type: Number, default: 1 })
  dayOfWeek!: number;

  /** MONTHLY: 1–28. */
  @Prop({ type: Number, default: 1 })
  dayOfMonth!: number;

  @Prop({ type: Date, default: null, index: true })
  nextExecutionAt!: Date | null;

  @Prop({ type: Date, default: null })
  lastExecutedAt!: Date | null;

  @Prop({
    type: String,
    required: true,
    enum: Object.values(SchedulerExecutionStatus),
    default: SchedulerExecutionStatus.Never,
  })
  lastExecutionStatus!: SchedulerExecutionStatus;

  /** Counts from the last run (no personal data). */
  @Prop({ type: Object, default: null })
  lastExecutionSummary!: Record<string, number | string> | null;

  @Prop({ type: Date, default: null })
  lockedUntil!: Date | null;

  @Prop({ type: String, default: null })
  lockedBy!: string | null;

  @Prop({ type: String, required: true })
  updatedBy!: string;
}

export const SchedulerConfigSchema =
  SchemaFactory.createForClass(SchedulerConfig);
