import { randomInt } from 'node:crypto';

import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import type { DropdownOptionDto } from '@common/dto/dropdown.dto';
import type { ExistsResponseDto } from '@common/dto/exists.dto';
import { ValidationException } from '@common/exceptions/validation.exception';
import type { Paginated } from '@common/interfaces/api-response.interface';
import { normalizePagination, paginate } from '@common/utils/pagination.util';
import {
  buildDateRange,
  buildSort,
  containsPattern,
} from '@common/utils/query.util';
import { generateUuid } from '@common/utils/uuid.util';
import { accessControlConfig } from '@config/configuration';
import {
  assertUnique,
  CASE_INSENSITIVE,
  findConflicts,
  type UniqueRule,
} from '@database/utils/unique-check.util';

import {
  GROUP_CATEGORIES,
  GROUP_ID_PREFIX,
  MAX_GROUP_DEPTH,
  PERMISSION_ACTION_VALUES,
} from '../constants/access-control.constants';
import {
  type CreateGroupDto,
  GROUP_SORT_FIELDS,
  type GroupChildrenQueryDto,
  type GroupDropdownQueryDto,
  type GroupExistsQueryDto,
  type GroupListItemDto,
  type GroupListQueryDto,
  type GroupRefDto,
  type GroupResponseDto,
  type GroupTreeNodeDto,
  type GroupTreeQueryDto,
  type PermissionMatrixDto,
  type UpdateGroupDto,
} from '../dto/group.dto';
import type { DeletedResponseDto } from '../dto/role.dto';
import {
  AuditAction,
  AuditEntity,
  MappingType,
  RecordStatus,
  TagMatchMode,
} from '../enums/access-control.enum';
import type { Actor } from '../interfaces/actor.interface';
import { AccessMapping } from '../schemas/access-mapping.schema';
import { Group } from '../schemas/group.schema';
import { Permission } from '../schemas/permission.schema';
import { Role } from '../schemas/role.schema';
import { AccessErrors, changedValues } from '../utils/access-errors.util';
import { AccessAuditService } from './access-audit.service';
import { AccessResolverService } from './access-resolver.service';

const ENTITY = 'Group';
const GENERATED_ID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_SUBTREE_RESULTS = 1000;

@Injectable()
export class GroupsService {
  private readonly logger = new Logger(GroupsService.name);

  constructor(
    @InjectModel(Group.name) private readonly groupModel: Model<Group>,
    @InjectModel(AccessMapping.name)
    private readonly mappingModel: Model<AccessMapping>,
    @InjectModel(Role.name) private readonly roleModel: Model<Role>,
    @InjectModel(Permission.name)
    private readonly permissionModel: Model<Permission>,
    private readonly auditService: AccessAuditService,
    private readonly resolver: AccessResolverService,
    @Inject(accessControlConfig.KEY)
    private readonly config: ConfigType<typeof accessControlConfig>,
  ) {}

  async create(dto: CreateGroupDto, actor: Actor): Promise<GroupResponseDto> {
    const parent = dto.parentGroupId
      ? await this.findParent(dto.parentGroupId)
      : null;
    if (parent && parent.level + 1 > MAX_GROUP_DEPTH) {
      throw AccessErrors.hierarchy(
        `Groups can be nested at most ${String(MAX_GROUP_DEPTH)} levels deep`,
      );
    }
    const groupId = dto.groupId ?? (await this.generateGroupId());
    const parentGroupId = parent?._id ?? null;
    await this.assertUniqueFields(groupId, dto.groupName, parentGroupId);

    const group = await this.groupModel.create({
      _id: generateUuid(),
      groupId,
      groupName: dto.groupName,
      category: dto.category,
      parentGroupId,
      ancestorIds: parent ? [...parent.ancestorIds, parent._id] : [],
      level: parent ? parent.level + 1 : 0,
      description: dto.description ?? '',
      tags: dto.tags ?? [],
      status: dto.status ?? RecordStatus.Active,
      isDefault: dto.isDefault ?? false,
      createdBy: actor.auth.userId,
      updatedBy: actor.auth.userId,
    });
    await this.auditService.record(actor, [
      {
        entityType: AuditEntity.Group,
        entityId: group._id,
        action: AuditAction.Create,
        after: auditView(group),
      },
    ]);
    this.logger.log({
      message: 'Group created',
      groupId: group._id,
      code: group.groupId,
      userId: actor.auth.userId,
    });
    return this.get(group._id);
  }

  async list(query: GroupListQueryDto): Promise<Paginated<GroupListItemDto>> {
    const { page, limit, skip } = normalizePagination(query.page, query.limit);
    const createdAt = buildDateRange(
      'created',
      query.createdFrom,
      query.createdTo,
    );
    const updatedAt = buildDateRange(
      'updated',
      query.updatedFrom,
      query.updatedTo,
    );
    const search = query.search ? containsPattern(query.search) : null;
    const tags = query.tags ?? [];
    const filter = {
      isDeleted: false,
      ...(search
        ? {
            $or: [
              { groupName: search },
              { groupId: search },
              { description: search },
              { tags: search },
            ],
          }
        : {}),
      ...(tags.length
        ? {
            tags:
              query.tagMode === TagMatchMode.All
                ? { $all: tags }
                : { $in: tags },
          }
        : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(query.parentGroupId ? { parentGroupId: query.parentGroupId } : {}),
      ...(query.level === 'ROOT' ? { parentGroupId: null } : {}),
      ...(query.level === 'CHILD' && !query.parentGroupId
        ? { parentGroupId: { $ne: null } }
        : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.isDefault !== undefined ? { isDefault: query.isDefault } : {}),
      ...(createdAt ? { createdAt } : {}),
      ...(updatedAt ? { updatedAt } : {}),
    };
    const [groups, total] = await Promise.all([
      this.groupModel
        .find(filter)
        .collation(CASE_INSENSITIVE)
        .sort(
          buildSort(
            query.sortBy,
            query.sortOrder,
            GROUP_SORT_FIELDS,
            'updatedAt',
          ),
        )
        .skip(skip)
        .limit(limit)
        .lean(),
      this.groupModel.countDocuments(filter),
    ]);
    return paginate(await this.withParentNames(groups), page, limit, total);
  }

  /**
   * Active groups for selects. With `excludeId` (choosing a new parent while
   * editing) the group itself and all its sub-groups are left out.
   */
  async dropdown(query: GroupDropdownQueryDto): Promise<DropdownOptionDto[]> {
    const search = query.search ? containsPattern(query.search) : null;
    const groups = await this.groupModel
      .find(
        {
          isDeleted: false,
          status: RecordStatus.Active,
          ...(query.category ? { category: query.category } : {}),
          ...(query.parentGroupId
            ? { parentGroupId: query.parentGroupId }
            : {}),
          ...(query.rootOnly ? { parentGroupId: null } : {}),
          ...(query.excludeId
            ? {
                _id: { $ne: query.excludeId },
                ancestorIds: { $ne: query.excludeId },
              }
            : {}),
          ...(query.excludeId ? { level: { $lt: MAX_GROUP_DEPTH } } : {}),
          ...(search
            ? { $or: [{ groupName: search }, { groupId: search }] }
            : {}),
        },
        {
          groupName: 1,
          groupId: 1,
          parentGroupId: 1,
          category: 1,
          level: 1,
          ancestorIds: 1,
        },
      )
      .collation(CASE_INSENSITIVE)
      .sort({ groupName: 1 })
      .lean();
    const names = query.withPath
      ? await this.namesOf(groups.flatMap((g) => g.ancestorIds))
      : new Map<string, string>();
    return groups.map((g) => ({
      id: g._id,
      label: g.groupName,
      key: g.groupId,
      parentId: g.parentGroupId,
      category: g.category,
      level: g.level,
      ...(query.withPath
        ? {
            path: [
              ...g.ancestorIds.map((a) => names.get(a) ?? '?'),
              g.groupName,
            ].join(' / '),
          }
        : {}),
    }));
  }

  /**
   * The hierarchy as nested nodes (main groups at the top, sub-groups in
   * `children`, sorted by name). Filters: category, a sub-tree (`rootId`),
   * depth, status; optional member / role counts.
   */
  async tree(query: GroupTreeQueryDto): Promise<GroupTreeNodeDto[]> {
    const root = query.rootId ? await this.findOrThrow(query.rootId) : null;
    const baseLevel = root?.level ?? 0;
    const groups = await this.groupModel
      .find({
        isDeleted: false,
        ...(root
          ? { $or: [{ _id: root._id }, { ancestorIds: root._id }] }
          : {}),
        ...(query.category ? { category: query.category } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.maxDepth !== undefined
          ? { level: { $lte: baseLevel + query.maxDepth } }
          : {}),
      })
      .collation(CASE_INSENSITIVE)
      .sort({ level: 1, groupName: 1 })
      .lean();

    const counts = query.withCounts
      ? await this.mappingCounts(groups.map((g) => g._id))
      : null;
    const nodes = new Map<string, GroupTreeNodeDto>();
    const roots: GroupTreeNodeDto[] = [];
    for (const g of groups) {
      const node: GroupTreeNodeDto = {
        id: g._id,
        groupId: g.groupId,
        groupName: g.groupName,
        category: g.category,
        parentGroupId: g.parentGroupId,
        level: g.level,
        status: g.status,
        tags: g.tags,
        ...(counts
          ? {
              memberCount: counts.get(`${g._id}|${MappingType.GroupUser}`) ?? 0,
              roleCount: counts.get(`${g._id}|${MappingType.GroupRole}`) ?? 0,
            }
          : {}),
        children: [],
      };
      nodes.set(g._id, node);
      const parent = g.parentGroupId ? nodes.get(g.parentGroupId) : undefined;
      if (parent && g._id !== root?._id) {
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    }
    return roots;
  }

  /** Details by business group ID (e.g. GRP-DEV), optionally within a category. */
  async getByCode(
    groupCode: string,
    category?: string,
  ): Promise<GroupResponseDto> {
    const group = await this.groupModel
      .findOne(
        {
          groupId: groupCode.trim().toUpperCase(),
          isDeleted: false,
          ...(category ? { category } : {}),
        },
        { _id: 1 },
      )
      .lean();
    if (!group) {
      throw AccessErrors.notFound(
        category ? `Group in category ${category}` : ENTITY,
      );
    }
    return this.get(group._id);
  }

  /**
   * What a group grants: its active roles (plus parent groups' roles when
   * inheritance is on) as columns, their active permissions as rows, and a
   * module × action grid built from the permissions' metadata.
   */
  async permissionMatrix(
    id: string,
    category?: string,
  ): Promise<PermissionMatrixDto> {
    const group = await this.findOrThrow(id);
    if (category && group.category !== category) {
      throw AccessErrors.notFound(`Group in category ${category}`);
    }
    const ancestors = this.config.inheritParentGroups
      ? await this.groupModel
          .find({
            _id: { $in: group.ancestorIds },
            isDeleted: false,
            status: RecordStatus.Active,
          })
          .lean()
      : [];
    const groupIds = [group._id, ...ancestors.map((a) => a._id)];
    const roleLinks = await this.mappingModel
      .find({ type: MappingType.GroupRole, groupId: { $in: groupIds } })
      .lean();
    const roles = await this.roleModel
      .find({
        _id: { $in: roleLinks.map((l) => l.roleId ?? '') },
        isDeleted: false,
        status: RecordStatus.Active,
      })
      .collation(CASE_INSENSITIVE)
      .sort({ roleName: 1 })
      .lean();
    const viaGroup = new Map<string, string>();
    for (const link of roleLinks) {
      const roleId = link.roleId ?? '';
      // Prefer the group's own assignment over an inherited one.
      if (!viaGroup.has(roleId) || link.groupId === group._id) {
        viaGroup.set(roleId, link.groupId ?? '');
      }
    }
    const permissionLinks = await this.mappingModel
      .find({
        type: MappingType.RolePermission,
        roleId: { $in: roles.map((r) => r._id) },
      })
      .lean();
    const grantedBy = new Map<string, string[]>();
    for (const link of permissionLinks) {
      const list = grantedBy.get(link.permissionId ?? '') ?? [];
      list.push(link.roleId ?? '');
      grantedBy.set(link.permissionId ?? '', list);
    }
    const permissions = await this.permissionModel
      .find({
        _id: { $in: [...grantedBy.keys()] },
        isDeleted: false,
        status: RecordStatus.Active,
      })
      .sort({ permissionKey: 1 })
      .lean();

    const grid = new Map<string, Record<string, boolean>>();
    const matrixPermissions = permissions.map((p) => {
      const modules = p.metadata
        .filter((m) => m.key === 'module')
        .map((m) => m.value);
      const actions = [...new Set(p.metadata.map((m) => m.action))];
      for (const module of modules.length ? modules : ['general']) {
        const row =
          grid.get(module) ??
          Object.fromEntries(PERMISSION_ACTION_VALUES.map((a) => [a, false]));
        for (const action of actions) {
          row[action] = true;
        }
        grid.set(module, row);
      }
      return {
        id: p._id,
        permissionKey: p.permissionKey,
        permissionName: p.permissionName,
        modules,
        actions,
        grantedByRoleIds: grantedBy.get(p._id) ?? [],
      };
    });
    return {
      group: {
        id: group._id,
        groupId: group.groupId,
        groupName: group.groupName,
      },
      category: group.category,
      actions: [...PERMISSION_ACTION_VALUES],
      roles: roles.map((r) => ({
        id: r._id,
        roleKey: r.roleKey,
        roleName: r.roleName,
        status: r.status,
        viaGroupId: viaGroup.get(r._id) ?? group._id,
        isInherited: (viaGroup.get(r._id) ?? group._id) !== group._id,
      })),
      permissions: matrixPermissions,
      modules: [...grid.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([module, actions]) => ({ module, actions })),
    };
  }

  /** Live form check: is this group ID / name (among siblings) taken? */
  async exists(query: GroupExistsQueryDto): Promise<ExistsResponseDto> {
    const rules: UniqueRule[] = [];
    if (query.groupId) {
      rules.push({
        field: 'groupId',
        filter: { groupId: query.groupId, isDeleted: false },
        message: `Group ID ${query.groupId} already exists`,
      });
    }
    if (query.groupName) {
      rules.push({
        field: 'groupName',
        filter: {
          groupName: query.groupName,
          parentGroupId: query.parentGroupId ?? null,
          isDeleted: false,
        },
        message: query.parentGroupId
          ? `A sub-group named "${query.groupName}" already exists under this parent`
          : `A main group named "${query.groupName}" already exists`,
        isCaseInsensitive: true,
      });
    }
    if (rules.length === 0) {
      throw new ValidationException([
        {
          field: 'groupId',
          message: 'Send groupId and / or groupName to check',
        },
      ]);
    }
    const conflicts = await findConflicts(
      this.groupModel,
      rules,
      query.excludeId,
    );
    return { exists: conflicts.length > 0, conflicts };
  }

  private async namesOf(ids: string[]): Promise<Map<string, string>> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) {
      return new Map();
    }
    const groups = await this.groupModel
      .find({ _id: { $in: unique } }, { groupName: 1 })
      .lean();
    return new Map(groups.map((g) => [g._id, g.groupName]));
  }

  /** "<groupId>|<type>" → number of members / roles. */
  private async mappingCounts(
    groupIds: string[],
  ): Promise<Map<string, number>> {
    const rows = await this.mappingModel.aggregate<{
      _id: { groupId: string; type: string };
      count: number;
    }>([
      {
        $match: {
          groupId: { $in: groupIds },
          type: { $in: [MappingType.GroupUser, MappingType.GroupRole] },
        },
      },
      {
        $group: {
          _id: { groupId: '$groupId', type: '$type' },
          count: { $sum: 1 },
        },
      },
    ]);
    return new Map(
      rows.map((r) => [`${r._id.groupId}|${r._id.type}`, r.count]),
    );
  }

  categories() {
    return GROUP_CATEGORIES.map((c) => ({ ...c }));
  }

  async get(id: string): Promise<GroupResponseDto> {
    const group = await this.findOrThrow(id);
    const ancestors = group.ancestorIds.length
      ? await this.groupModel
          .find(
            { _id: { $in: group.ancestorIds } },
            { groupId: 1, groupName: 1 },
          )
          .lean()
      : [];
    const byId = new Map(ancestors.map((a) => [a._id, a]));
    const path: GroupRefDto[] = group.ancestorIds
      .map((ancestorId) => byId.get(ancestorId))
      .filter((a): a is NonNullable<typeof a> => a !== undefined)
      .map((a) => ({ id: a._id, groupId: a.groupId, groupName: a.groupName }));
    const [childCount, memberCount, roleCount] = await Promise.all([
      this.groupModel.countDocuments({ parentGroupId: id, isDeleted: false }),
      this.mappingModel.countDocuments({
        type: MappingType.GroupUser,
        groupId: id,
      }),
      this.mappingModel.countDocuments({
        type: MappingType.GroupRole,
        groupId: id,
      }),
    ]);
    const roleIds = (
      await this.mappingModel
        .find({ type: MappingType.GroupRole, groupId: id }, { roleId: 1 })
        .lean()
    ).map((l) => l.roleId ?? '');
    const roles = roleIds.length
      ? await this.roleModel
          .find(
            { _id: { $in: roleIds }, isDeleted: false },
            { roleKey: 1, roleName: 1, status: 1 },
          )
          .collation(CASE_INSENSITIVE)
          .sort({ roleName: 1 })
          .lean()
      : [];
    const parent = path.at(-1) ?? null;
    return Object.assign(toListItem(group, parent?.groupName ?? null), {
      roles: roles.map((r) => ({
        id: r._id,
        roleKey: r.roleKey,
        roleName: r.roleName,
        status: r.status,
      })),
      parent,
      path,
      isSystem: group.isSystem,
      version: group.version,
      createdBy: group.createdBy,
      updatedBy: group.updatedBy,
      createdAt: group.createdAt,
      childCount,
      memberCount,
      roleCount,
    });
  }

  /** Direct sub-groups, or the whole subtree with `recursive`. */
  async children(
    id: string,
    query: GroupChildrenQueryDto,
  ): Promise<GroupListItemDto[]> {
    await this.findOrThrow(id);
    const groups = await this.groupModel
      .find({
        isDeleted: false,
        ...(query.recursive ? { ancestorIds: id } : { parentGroupId: id }),
        ...(query.status ? { status: query.status } : {}),
      })
      .collation(CASE_INSENSITIVE)
      .sort({ level: 1, groupName: 1 })
      .limit(MAX_SUBTREE_RESULTS)
      .lean();
    return this.withParentNames(groups);
  }

  async update(
    id: string,
    dto: UpdateGroupDto,
    actor: Actor,
  ): Promise<GroupResponseDto> {
    const group = await this.findOrThrow(id);
    if (group.isSystem) {
      throw AccessErrors.systemProtected(ENTITY);
    }
    if (dto.version !== undefined && dto.version !== group.version) {
      throw AccessErrors.versionConflict(ENTITY);
    }
    const isMoving =
      dto.parentGroupId !== undefined &&
      dto.parentGroupId !== group.parentGroupId;
    const newParent =
      isMoving && dto.parentGroupId
        ? await this.assertValidMove(group, dto.parentGroupId)
        : null;
    const parentGroupId = isMoving
      ? (newParent?._id ?? null)
      : group.parentGroupId;

    const next = {
      groupId: dto.groupId ?? group.groupId,
      groupName: dto.groupName ?? group.groupName,
      category: dto.category ?? group.category,
      parentGroupId,
      description: dto.description ?? group.description,
      tags: dto.tags ?? group.tags,
      status: dto.status ?? group.status,
      isDefault: dto.isDefault ?? group.isDefault,
    };
    const diff = changedValues(auditView(group), next);
    if (Object.keys(diff.after).length === 0) {
      return this.get(id);
    }
    await this.assertUniqueFields(
      next.groupId,
      next.groupName,
      parentGroupId,
      id,
    );
    if (next.isDefault && !group.isDefault) {
      // Every future user gets this group's permissions: only someone who may grant them can do that.
      await this.resolver.assertCanGrant(
        actor,
        await this.resolver.permissionKeysOfGroups([id]),
      );
    }

    const ancestorIds = isMoving
      ? newParent
        ? [...newParent.ancestorIds, newParent._id]
        : []
      : group.ancestorIds;
    const result = await this.groupModel.updateOne(
      { _id: id, isDeleted: false, version: group.version },
      {
        $set: {
          ...next,
          ancestorIds,
          level: ancestorIds.length,
          updatedBy: actor.auth.userId,
        },
        $inc: { version: 1 },
      },
    );
    if (result.modifiedCount === 0) {
      throw AccessErrors.versionConflict(ENTITY);
    }
    if (isMoving) {
      await this.moveSubtree(id, ancestorIds);
    }
    if ('status' in diff.after || isMoving) {
      this.resolver.invalidate();
    }
    await this.auditService.record(actor, [
      {
        entityType: AuditEntity.Group,
        entityId: id,
        action: AuditAction.Update,
        ...diff,
      },
    ]);
    this.logger.log({
      message: 'Group updated',
      groupId: id,
      changedFields: Object.keys(diff.after),
      userId: actor.auth.userId,
    });
    return this.get(id);
  }

  /**
   * Soft delete. Blocked while the group has sub-groups or members (no
   * accidental removal of a whole hierarchy); its role assignments go with it.
   */
  async remove(id: string, actor: Actor): Promise<DeletedResponseDto> {
    const group = await this.findOrThrow(id);
    if (group.isSystem) {
      throw AccessErrors.systemProtected(ENTITY);
    }
    const [childCount, memberCount] = await Promise.all([
      this.groupModel.countDocuments({ parentGroupId: id, isDeleted: false }),
      this.mappingModel.countDocuments({
        type: MappingType.GroupUser,
        groupId: id,
      }),
    ]);
    const blockers = [
      ...(childCount > 0
        ? [
            {
              field: 'children',
              message: `has ${String(childCount)} sub-group(s): move or delete them first`,
            },
          ]
        : []),
      ...(memberCount > 0
        ? [
            {
              field: 'members',
              message: `has ${String(memberCount)} member(s): remove them first`,
            },
          ]
        : []),
    ];
    if (blockers.length > 0) {
      throw AccessErrors.inUse(
        'This group is not empty and cannot be deleted',
        blockers,
      );
    }
    const deletedAt = new Date();
    const result = await this.groupModel.updateOne(
      { _id: id, isDeleted: false },
      {
        $set: {
          isDeleted: true,
          deletedAt,
          deletedBy: actor.auth.userId,
          updatedBy: actor.auth.userId,
        },
        $inc: { version: 1 },
      },
    );
    if (result.modifiedCount === 0) {
      throw AccessErrors.notFound(ENTITY);
    }
    const removed = await this.mappingModel.deleteMany({
      type: MappingType.GroupRole,
      groupId: id,
    });
    this.resolver.invalidate();
    await this.auditService.record(actor, [
      {
        entityType: AuditEntity.Group,
        entityId: id,
        action: AuditAction.Delete,
        before: {
          ...auditView(group),
          roleAssignmentsRemoved: removed.deletedCount,
        },
      },
    ]);
    this.logger.log({
      message: 'Group deleted',
      groupId: id,
      code: group.groupId,
      userId: actor.auth.userId,
    });
    return { id, deletedAt };
  }

  async findOrThrow(id: string): Promise<Group> {
    const group = await this.groupModel
      .findOne({ _id: id, isDeleted: false })
      .lean();
    if (!group) {
      throw AccessErrors.notFound(ENTITY);
    }
    return group;
  }

  /** A usable parent: exists, not deleted, active. */
  private async findParent(parentId: string): Promise<Group> {
    const parent = await this.groupModel
      .findOne({ _id: parentId, isDeleted: false })
      .lean();
    if (!parent) {
      throw AccessErrors.notFound('Parent group', [
        { field: 'parentGroupId', message: 'Parent group not found' },
      ]);
    }
    if (parent.status !== RecordStatus.Active) {
      throw AccessErrors.inactive('The parent group is inactive', [
        { field: 'parentGroupId', message: 'Parent group is inactive' },
      ]);
    }
    return parent;
  }

  /** No self-parenting, no cycles, depth limit for the whole moved subtree. */
  private async assertValidMove(
    group: Group,
    parentId: string,
  ): Promise<Group> {
    if (parentId === group._id) {
      throw AccessErrors.hierarchy('A group cannot be its own parent');
    }
    const parent = await this.findParent(parentId);
    if (parent.ancestorIds.includes(group._id)) {
      throw AccessErrors.hierarchy(
        'A group cannot be moved under one of its own sub-groups',
      );
    }
    const deepest = await this.groupModel
      .findOne({ ancestorIds: group._id, isDeleted: false }, { level: 1 })
      .sort({ level: -1 })
      .lean();
    const subtreeDepth = (deepest?.level ?? group.level) - group.level;
    if (parent.level + 1 + subtreeDepth > MAX_GROUP_DEPTH) {
      throw AccessErrors.hierarchy(
        `Groups can be nested at most ${String(MAX_GROUP_DEPTH)} levels deep`,
      );
    }
    return parent;
  }

  /** Rewrites the materialized path of every descendant after a move. */
  private async moveSubtree(
    id: string,
    newAncestorIds: string[],
  ): Promise<void> {
    const descendants = await this.groupModel
      .find({ ancestorIds: id }, { ancestorIds: 1 })
      .lean();
    if (descendants.length === 0) {
      return;
    }
    await this.groupModel.bulkWrite(
      descendants.map((d) => {
        const below = d.ancestorIds.slice(d.ancestorIds.indexOf(id) + 1);
        const ancestorIds = [...newAncestorIds, id, ...below];
        return {
          updateOne: {
            filter: { _id: d._id },
            update: { $set: { ancestorIds, level: ancestorIds.length } },
          },
        };
      }),
    );
  }

  /** GRP-XXXXXX, retried on the (rare) clash. */
  private async generateGroupId(): Promise<string> {
    for (;;) {
      const suffix = Array.from(
        { length: 6 },
        () => GENERATED_ID_CHARS[randomInt(GENERATED_ID_CHARS.length)],
      ).join('');
      const candidate = `${GROUP_ID_PREFIX}${suffix}`;
      if (
        !(await this.groupModel.exists({
          groupId: candidate,
          isDeleted: false,
        }))
      ) {
        return candidate;
      }
    }
  }

  private async withParentNames(groups: Group[]): Promise<GroupListItemDto[]> {
    const parentIds = [
      ...new Set(
        groups
          .map((g) => g.parentGroupId)
          .filter((id): id is string => id !== null),
      ),
    ];
    const parents = parentIds.length
      ? await this.groupModel
          .find({ _id: { $in: parentIds } }, { groupName: 1 })
          .lean()
      : [];
    const names = new Map(parents.map((p) => [p._id, p.groupName]));
    return groups.map((g) =>
      toListItem(
        g,
        g.parentGroupId ? (names.get(g.parentGroupId) ?? null) : null,
      ),
    );
  }

  private assertUniqueFields(
    groupId: string,
    groupName: string,
    parentGroupId: string | null,
    excludeId?: string,
  ) {
    return assertUnique(
      this.groupModel,
      [
        {
          field: 'groupId',
          filter: { groupId, isDeleted: false },
          message: `Group ID ${groupId} already exists`,
        },
        {
          field: 'groupName',
          filter: { groupName, parentGroupId, isDeleted: false },
          message: parentGroupId
            ? `A sub-group named "${groupName}" already exists under this parent`
            : `A main group named "${groupName}" already exists`,
          isCaseInsensitive: true,
        },
      ],
      excludeId,
    );
  }
}

function auditView(group: Group): Record<string, unknown> {
  return {
    groupId: group.groupId,
    groupName: group.groupName,
    category: group.category,
    parentGroupId: group.parentGroupId,
    description: group.description,
    tags: group.tags,
    status: group.status,
    isDefault: group.isDefault,
  };
}

function toListItem(
  group: Group,
  parentGroupName: string | null,
): GroupListItemDto {
  return {
    id: group._id,
    groupId: group.groupId,
    groupName: group.groupName,
    category: group.category,
    parentGroupId: group.parentGroupId,
    parentGroupName,
    level: group.level,
    description: group.description,
    tags: group.tags,
    status: group.status,
    isDefault: group.isDefault,
    updatedAt: group.updatedAt,
  };
}
