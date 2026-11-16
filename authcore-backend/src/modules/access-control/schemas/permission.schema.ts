import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { baseSchemaOptions } from '@database/schemas/base.schema';

import {
  ManagedEntity,
  UNIQUE_ACTIVE,
  UNIQUE_ACTIVE_CASE_INSENSITIVE,
} from './managed-entity.schema';

/** One metadata entry: what the permission is about and which action it allows. */
export interface PermissionMetadata {
  key: string;
  value: string;
  action: string;
}

@Schema({ ...baseSchemaOptions, collection: 'permissions' })
export class Permission extends ManagedEntity {
  /** Uppercase identifier, e.g. USER_CREATE. Unique. */
  @Prop({ type: String, required: true })
  permissionKey!: string;

  /** Unique (case-insensitive). */
  @Prop({ type: String, required: true, trim: true })
  permissionName!: string;

  @Prop({ type: String, default: '' })
  description!: string;

  @Prop({
    type: [{ _id: false, key: String, value: String, action: String }],
    default: [],
  })
  metadata!: PermissionMetadata[];
}

export const PermissionSchema = SchemaFactory.createForClass(Permission);
PermissionSchema.index({ permissionKey: 1 }, UNIQUE_ACTIVE);
PermissionSchema.index({ permissionName: 1 }, UNIQUE_ACTIVE_CASE_INSENSITIVE);
PermissionSchema.index({ 'metadata.key': 1, 'metadata.value': 1 });
PermissionSchema.index({ 'metadata.action': 1 });
PermissionSchema.index({ isDeleted: 1, updatedAt: -1 });
