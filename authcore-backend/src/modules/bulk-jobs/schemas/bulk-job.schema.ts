import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { BaseSchema, baseSchemaOptions } from '@database/schemas/base.schema';

/**
 * PROCESSING: rows are running · DONE: every row has a result · INVALID_TEMPLATE: the file
 * was rejected before any row ran (`message` says why) · FAILED: stopped part-way.
 */
export type BulkJobStatus =
  'PROCESSING' | 'DONE' | 'INVALID_TEMPLATE' | 'FAILED';
export type BulkRowStatus = 'SUCCESS' | 'SKIPPED' | 'ERROR';

export interface BulkRowResult {
  /** Line in the uploaded file (2 = first data row). */
  rowNumber: number;
  /** The row's key value (e.g. the email). */
  key: string;
  status: BulkRowStatus;
  message: string;
  /** The row as uploaded, secret columns (passwords) removed. */
  values: Record<string, string>;
}

/** One uploaded file run by a bulk job (any kind: USER_CREATE, USER_UPDATE …). */
@Schema({ ...baseSchemaOptions, collection: 'bulk_jobs' })
export class BulkJob extends BaseSchema {
  @Prop({ type: String, required: true, index: true })
  kind!: string;

  @Prop({ type: String, required: true })
  fileName!: string;

  @Prop({ type: String, required: true, index: true })
  uploadedBy!: string;

  @Prop({ type: String, default: null })
  uploadedByEmail!: string | null;

  @Prop({ type: String, required: true })
  status!: BulkJobStatus;

  /** Why the file was rejected / the job stopped. */
  @Prop({ type: String, default: null })
  message!: string | null;

  /** Column names as uploaded (secret ones left out): the result file repeats them. */
  @Prop({ type: [String], default: [] })
  columns!: string[];

  @Prop({ type: Number, default: 0 })
  totalCount!: number;

  @Prop({ type: Number, default: 0 })
  successCount!: number;

  @Prop({ type: Number, default: 0 })
  skippedCount!: number;

  @Prop({ type: Number, default: 0 })
  errorCount!: number;

  @Prop({ type: Date, required: true })
  startedAt!: Date;

  @Prop({ type: Date, default: null })
  finishedAt!: Date | null;

  @Prop({ type: [Object], default: [] })
  results!: BulkRowResult[];
}

export const BulkJobSchema = SchemaFactory.createForClass(BulkJob);
BulkJobSchema.index({ kind: 1, createdAt: -1 });
