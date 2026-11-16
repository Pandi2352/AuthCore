import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { BaseSchema, baseSchemaOptions } from '@database/schemas/base.schema';

import { MappingType } from '../enums/access-control.enum';

/**
 * One link of User → Group → Role → Permission:
 *   GROUP_USER       groupId + userId
 *   GROUP_ROLE       groupId + roleId
 *   ROLE_PERMISSION  roleId + permissionId
 * A partial unique index per type prevents duplicate assignments. Removing an
 * assignment deletes the document (the audit log keeps the history).
 */
@Schema({ ...baseSchemaOptions, collection: 'access_mappings' })
export class AccessMapping extends BaseSchema {
  @Prop({ type: String, required: true, enum: Object.values(MappingType) })
  type!: MappingType;

  @Prop({ type: String, default: null })
  groupId!: string | null;

  @Prop({ type: String, default: null })
  userId!: string | null;

  @Prop({ type: String, default: null })
  roleId!: string | null;

  @Prop({ type: String, default: null })
  permissionId!: string | null;

  @Prop({ type: String, required: true })
  assignedBy!: string;
}

export const AccessMappingSchema = SchemaFactory.createForClass(AccessMapping);
AccessMappingSchema.index(
  { groupId: 1, userId: 1 },
  { unique: true, partialFilterExpression: { type: MappingType.GroupUser } },
);
AccessMappingSchema.index(
  { groupId: 1, roleId: 1 },
  { unique: true, partialFilterExpression: { type: MappingType.GroupRole } },
);
AccessMappingSchema.index(
  { roleId: 1, permissionId: 1 },
  {
    unique: true,
    partialFilterExpression: { type: MappingType.RolePermission },
  },
);
// Reverse lookups (groups of a user, groups of a role, roles of a permission).
AccessMappingSchema.index({ type: 1, userId: 1 });
AccessMappingSchema.index({ type: 1, roleId: 1 });
AccessMappingSchema.index({ type: 1, permissionId: 1 });
AccessMappingSchema.index({ createdAt: -1 });
