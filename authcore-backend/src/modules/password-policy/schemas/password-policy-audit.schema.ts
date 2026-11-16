import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { BaseSchema, baseSchemaOptions } from '@database/schemas/base.schema';

import { PolicyAuditAction } from '../enums/scheduler.enum';

/**
 * Who changed password settings, when and what. Holds settings only: never
 * passwords, hashes or tokens.
 */
@Schema({ ...baseSchemaOptions, collection: 'password_policy_audit_logs' })
export class PasswordPolicyAudit extends BaseSchema {
  /** "policy" or "scheduler:<job>". */
  @Prop({ type: String, required: true, index: true })
  target!: string;

  @Prop({
    type: String,
    required: true,
    enum: Object.values(PolicyAuditAction),
  })
  action!: PolicyAuditAction;

  /** User id of the admin. */
  @Prop({ type: String, required: true, index: true })
  changedBy!: string;

  @Prop({ type: [String], default: [] })
  changedFields!: string[];

  @Prop({ type: Object, default: null })
  oldValues!: Record<string, unknown> | null;

  @Prop({ type: Object, required: true })
  newValues!: Record<string, unknown>;

  @Prop({ type: Number, default: null })
  version!: number | null;

  @Prop({ type: String, default: null })
  ipAddress!: string | null;

  @Prop({ type: String, default: null, maxlength: 512 })
  userAgent!: string | null;
}

export const PasswordPolicyAuditSchema =
  SchemaFactory.createForClass(PasswordPolicyAudit);
PasswordPolicyAuditSchema.index({ createdAt: -1 });
