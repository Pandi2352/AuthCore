import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { BaseSchema, baseSchemaOptions } from '@database/schemas/base.schema';

import type { PasswordPolicyRules } from '../interfaces/password-policy-rules.interface';

/**
 * A password policy. Admins keep several; exactly one is active (enforced by a
 * unique partial index) and applies to every password set. `key` is "global"
 * for the policy from before multiple policies existed, the id otherwise.
 * Rule groups are validated by the DTOs and stored as sub-documents.
 */
@Schema({ ...baseSchemaOptions, collection: 'password_policies' })
export class PasswordPolicy extends BaseSchema {
  @Prop({ type: String, required: true, unique: true })
  key!: string;

  @Prop({ type: Boolean, default: false })
  isActive!: boolean;

  @Prop({ type: String, required: true, trim: true, maxlength: 100 })
  policyName!: string;

  @Prop({ type: Object, required: true })
  characterLength!: PasswordPolicyRules['characterLength'];

  @Prop({ type: Object, required: true })
  complexity!: PasswordPolicyRules['complexity'];

  @Prop({ type: Object, required: true })
  passwordHistory!: PasswordPolicyRules['passwordHistory'];

  @Prop({ type: Object, required: true })
  additionalRules!: PasswordPolicyRules['additionalRules'];

  @Prop({ type: Object, required: true })
  passwordValidity!: PasswordPolicyRules['passwordValidity'];

  /** Incremented on every update. */
  @Prop({ required: true, default: 1 })
  version!: number;

  @Prop({ type: String, required: true })
  createdBy!: string;

  @Prop({ type: String, required: true })
  updatedBy!: string;
}

export const PasswordPolicySchema =
  SchemaFactory.createForClass(PasswordPolicy);
// At most one active policy, enforced by the database.
PasswordPolicySchema.index(
  { isActive: 1 },
  { unique: true, partialFilterExpression: { isActive: true } },
);
