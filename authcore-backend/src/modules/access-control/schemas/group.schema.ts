import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { baseSchemaOptions } from '@database/schemas/base.schema';

import {
  ManagedEntity,
  UNIQUE_ACTIVE,
  UNIQUE_ACTIVE_CASE_INSENSITIVE,
} from './managed-entity.schema';

/**
 * Hierarchical group. `ancestorIds` (root first) is a materialized path: it
 * finds a whole subtree with one indexed query and makes cycle checks cheap.
 */
@Schema({ ...baseSchemaOptions, collection: 'groups' })
export class Group extends ManagedEntity {
  /** Business code, uppercase, e.g. GRP-DEV. Unique. */
  @Prop({ type: String, required: true })
  groupId!: string;

  /** Unique among siblings (same parent), case-insensitive. */
  @Prop({ type: String, required: true, trim: true })
  groupName!: string;

  @Prop({ type: String, required: true, index: true })
  category!: string;

  /** Parent group `id`; null for a main (root) group. */
  @Prop({ type: String, default: null, index: true })
  parentGroupId!: string | null;

  @Prop({ type: [String], default: [], index: true })
  ancestorIds!: string[];

  /** 0 for main groups, parent level + 1 for sub-groups. */
  @Prop({ required: true, default: 0 })
  level!: number;

  @Prop({ type: String, default: '' })
  description!: string;

  /** Lowercase, unique per group. */
  @Prop({ type: [String], default: [], index: true })
  tags!: string[];
}

export const GroupSchema = SchemaFactory.createForClass(Group);
GroupSchema.index({ groupId: 1 }, UNIQUE_ACTIVE);
GroupSchema.index(
  { parentGroupId: 1, groupName: 1 },
  UNIQUE_ACTIVE_CASE_INSENSITIVE,
);
GroupSchema.index({ isDeleted: 1, updatedAt: -1 });
