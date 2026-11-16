import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { BaseSchema, baseSchemaOptions } from '@database/schemas/base.schema';

import { AuditAction, AuditEntity } from '../enums/access-control.enum';

/** History of access-control changes: who, what, before / after, from where. */
@Schema({ ...baseSchemaOptions, collection: 'access_control_audit_logs' })
export class AccessAudit extends BaseSchema {
  @Prop({ type: String, required: true, enum: Object.values(AuditEntity) })
  entityType!: AuditEntity;

  @Prop({ type: String, required: true })
  entityId!: string;

  @Prop({ type: String, required: true, enum: Object.values(AuditAction) })
  action!: AuditAction;

  /** User id, or "system" for seeded data. */
  @Prop({ type: String, required: true, index: true })
  changedBy!: string;

  @Prop({ type: Object, default: null })
  before!: Record<string, unknown> | null;

  @Prop({ type: Object, default: null })
  after!: Record<string, unknown> | null;

  @Prop({ type: String, default: null })
  ipAddress!: string | null;

  @Prop({ type: String, default: null, maxlength: 512 })
  userAgent!: string | null;
}

export const AccessAuditSchema = SchemaFactory.createForClass(AccessAudit);
AccessAuditSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
AccessAuditSchema.index({ createdAt: -1 });
