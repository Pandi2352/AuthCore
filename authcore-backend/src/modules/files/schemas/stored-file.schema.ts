import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { BaseSchema, baseSchemaOptions } from '@database/schemas/base.schema';

import { FilePurpose, FileVisibility, ScanStatus } from '../enums/file.enum';

/** Metadata of an uploaded file; the bytes are in the storage driver under `storageKey`. */
@Schema({ ...baseSchemaOptions, collection: 'files' })
export class StoredFile extends BaseSchema {
  /** User the file belongs to (deleted with them). */
  @Prop({ type: String, required: true, index: true })
  ownerId!: string;

  @Prop({ type: String, required: true, enum: Object.values(FilePurpose) })
  purpose!: FilePurpose;

  @Prop({ type: String, required: true, enum: Object.values(FileVisibility) })
  visibility!: FileVisibility;

  /** Sanitized name the client sent (display / download name only). */
  @Prop({ type: String, required: true })
  originalName!: string;

  /** Detected from the content, never from the client. */
  @Prop({ type: String, required: true })
  mimeType!: string;

  @Prop({ type: String, required: true })
  extension!: string;

  @Prop({ type: Number, required: true })
  size!: number;

  @Prop({ type: String, required: true })
  sha256!: string;

  /** Size as uploaded (images are re-encoded, so `size` can differ). */
  @Prop({ type: Number, required: true })
  originalSize!: number;

  /** Images only (after processing). */
  @Prop({ type: Number, default: null })
  width!: number | null;

  @Prop({ type: Number, default: null })
  height!: number | null;

  @Prop({ type: String, required: true, enum: Object.values(ScanStatus) })
  scanStatus!: ScanStatus;

  @Prop({ type: String, required: true })
  storageDriver!: string;

  @Prop({ type: String, required: true, unique: true })
  storageKey!: string;

  /**
   * Storage config the bytes were written to (Settings → File storage). null = files from
   * before storage settings existed: the built-in local folder.
   */
  @Prop({ type: String, default: null, index: true })
  storageConfigId!: string | null;

  /** Who uploaded it (the owner, or an admin uploading for them). */
  @Prop({ type: String, required: true })
  uploadedBy!: string;
}

export const StoredFileSchema = SchemaFactory.createForClass(StoredFile);
StoredFileSchema.index({ ownerId: 1, purpose: 1, createdAt: -1 });
